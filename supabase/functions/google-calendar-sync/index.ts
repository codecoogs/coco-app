import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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
      return new Response(JSON.stringify({ error: 'title, startTime, and endTime are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const descParts = [description?.trim() ?? '', flyerUrl?.trim() ? `Flyer: ${flyerUrl.trim()}` : '']
      .filter(Boolean)
    const fullDescription = descParts.join('\n\n') || undefined

    // 1. Get a fresh Access Token using your Refresh Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
        refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN'),
        grant_type: 'refresh_token',
      }),
    })

    const tokenJson = await tokenResponse.json()
    const access_token = tokenJson.access_token as string | undefined
    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Failed to obtain Google access token', detail: tokenJson }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const eventPayload = {
      summary: title,
      description: fullDescription,
      start: { dateTime: startTime, timeZone: 'America/Chicago' },
      end: { dateTime: endTime, timeZone: 'America/Chicago' },
    }

    // Shared / secondary calendar (e.g. group calendar). Falls back to "primary" if unset.
    const calendarId = (Deno.env.get('GOOGLE_CALENDAR_ID') ?? '').trim() || 'primary'
    const calendarPath = encodeURIComponent(calendarId)
    const eventsBase = `https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events`

    const existingId = typeof googleEventId === 'string' && googleEventId.trim() !== ''
      ? googleEventId.trim()
      : null

    const url = existingId
      ? `${eventsBase}/${encodeURIComponent(existingId)}`
      : eventsBase

    const googleResponse = await fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    })

    const googleData = await googleResponse.json()

    if (!googleResponse.ok) {
      return new Response(JSON.stringify({ error: 'Google Calendar API error', detail: googleData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    return new Response(JSON.stringify({ google_event_id: googleData.id as string }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})