import { createServerSupabaseClient } from '@/utils/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is superadmin
    const { data: adminPosition } = await supabase
      .from('user_positions')
      .select('position_id')
      .eq('user_id', adminUser.id)
      .single()

    const { data: position } = await supabase
      .from('positions')
      .select('name')
      .eq('id', adminPosition?.position_id)
      .single()

    if (position?.name !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Only superadmins can restore deleted accounts' },
        { status: 403 }
      )
    }

    const { deletionId } = await request.json()

    if (!deletionId) {
      return NextResponse.json(
        { error: 'Deletion ID required' },
        { status: 400 }
      )
    }

    // Get deletion record
    const { data: deletionRecord, error: fetchError } = await supabase
      .from('deleted_users')
      .select('*')
      .eq('id', deletionId)
      .single()

    if (fetchError || !deletionRecord) {
      return NextResponse.json(
        { error: 'Deletion request not found' },
        { status: 404 }
      )
    }

    // Only allow restore if not yet purged
    if (deletionRecord.status === 'purged') {
      return NextResponse.json(
        { error: 'Account data has been purged and cannot be restored' },
        { status: 400 }
      )
    }

    // Only allow restore within grace period (30 days)
    const graceEndDate = new Date(
      new Date(deletionRecord.deletion_confirmed_at).getTime() + 30 * 24 * 60 * 60 * 1000
    )

    if (new Date() > graceEndDate) {
      return NextResponse.json(
        { error: 'Grace period expired. Account cannot be restored.' },
        { status: 400 }
      )
    }

    // Restore the user
    await supabase
      .from('users')
      .update({
        deleted_at: null,
        deletion_requested_at: null,
      })
      .eq('id', deletionRecord.user_id)

    // Update deletion record
    await supabase
      .from('deleted_users')
      .update({
        status: 'restored',
        restored_at: new Date(),
        restored_by_user_id: adminUser.id,
      })
      .eq('id', deletionId)

    return NextResponse.json(
      {
        success: true,
        message: `Account restored by ${adminUser.email}`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error restoring deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
