import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

// ---------------------------------------------------------------------------
// Service account auth
//
// The calendar is shared with the service account directly ("Make changes to
// events"), so there is no domain-wide delegation and no `sub` impersonation
// claim -- the service account acts as itself.
// ---------------------------------------------------------------------------

/** Access tokens last an hour; reuse across invocations while the isolate is warm. */
let cachedToken: { value: string; expiresAt: number } | null = null

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeSegment(value: string): string {
  return base64url(new TextEncoder().encode(value))
}

/** Accepts the PEM with real newlines, or with the escapes a single-line env var keeps. */
function pkcs8FromPem(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(body)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value

  const clientEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')?.trim()
  const privateKeyPem = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  if (!clientEmail || !privateKeyPem) {
    throw new Error('Service account credentials are not configured')
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8FromPem(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signingInput = [
    encodeSegment(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    encodeSegment(JSON.stringify({
      iss: clientEmail,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    })),
  ].join('.')

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signingInput),
    ),
  )

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${base64url(signature)}`,
    }),
  })

  const tokenJson = await response.json()
  if (!response.ok || typeof tokenJson.access_token !== 'string') {
    // Logged rather than returned: Google's error text names the service account.
    console.error('Google token exchange failed', tokenJson)
    throw new Error('Failed to obtain Google access token')
  }

  cachedToken = {
    value: tokenJson.access_token,
    expiresAt: now + (Number(tokenJson.expires_in) || 3600),
  }
  return cachedToken.value
}

/**
 * verify_jwt only proves the caller holds a valid token, not that they may
 * manage events. has_permission() is SECURITY DEFINER and reads auth.uid(),
 * so forwarding the caller's Authorization header answers it for that user.
 */
async function callerCanManageEvents(authHeader: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase environment is not configured')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/has_permission`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ perm_name: 'manage_events' }),
  })

  if (!response.ok) {
    console.error('has_permission lookup failed', response.status, await response.text())
    return false
  }
  return (await response.json()) === true
}

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }
    if (!(await callerCanManageEvents(authHeader))) {
      return json({ error: 'You do not have permission to manage events.' }, 403)
    }

    const body = await req.json()
    const {
      title,
      description,
      startTime,
      endTime,
      flyerUrl,
      googleEventId,
    } = body as {
      title?: string
      description?: string | null
      startTime?: string
      endTime?: string
      flyerUrl?: string | null
      googleEventId?: string | null
    }

    if (!title?.trim() || !startTime || !endTime) {
      return json({ error: 'title, startTime, and endTime are required' }, 400)
    }

    const descParts = [description?.trim() ?? '', flyerUrl?.trim() ? `Flyer: ${flyerUrl.trim()}` : '']
      .filter(Boolean)
    const fullDescription = descParts.join('\n\n') || undefined

    const access_token = await getAccessToken()

    const eventPayload = {
      summary: title,
      description: fullDescription,
      start: { dateTime: startTime, timeZone: 'America/Chicago' },
      end: { dateTime: endTime, timeZone: 'America/Chicago' },
    }

    // Shared / secondary calendar (e.g. group calendar). Falls back to "primary",
    // which for a service account is its own empty calendar -- always set this.
    const calendarId = (Deno.env.get('GOOGLE_CALENDAR_ID') ?? '').trim() || 'primary'
    const eventsBase =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

    const existingId = typeof googleEventId === 'string' && googleEventId.trim() !== ''
      ? googleEventId.trim()
      : null

    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }

    let googleResponse = existingId
      ? await fetch(`${eventsBase}/${encodeURIComponent(existingId)}`, {
          method: 'PATCH',
          ...requestOptions,
        })
      : await fetch(eventsBase, { method: 'POST', ...requestOptions })

    // The stored id belongs to a calendar we no longer write to, or the event was
    // deleted in Google's UI. Recreate it rather than failing the whole edit.
    if (existingId && (googleResponse.status === 404 || googleResponse.status === 410)) {
      googleResponse = await fetch(eventsBase, { method: 'POST', ...requestOptions })
    }

    const googleData = await googleResponse.json()

    if (!googleResponse.ok) {
      console.error('Google Calendar API error', googleResponse.status, googleData)
      return json({ error: 'Google Calendar API error' }, 502)
    }

    return json({ google_event_id: googleData.id as string }, 200)

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('google-calendar-sync failed', msg)
    return json({ error: msg }, 400)
  }
})
