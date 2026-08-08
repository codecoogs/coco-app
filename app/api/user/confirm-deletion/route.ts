import { createServerSupabaseClient } from '@/utils/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { deletionId, exportBackup } = await request.json()

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

    // Verify still in pending status
    if (deletionRecord.status !== 'pending') {
      return NextResponse.json(
        { error: 'Deletion request already processed' },
        { status: 400 }
      )
    }

    // If user requested backup, export data
    if (exportBackup) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', deletionRecord.user_id)
        .single()

      const backupData = {
        exported_at: new Date().toISOString(),
        user: userData,
        // Add other relevant data tables here
      }

      // TODO: Store backup or return as download
      // For now, just mark that backup was requested
      await supabase
        .from('deleted_users')
        .update({
          backup_exported: true,
          backup_export_requested_at: new Date(),
        })
        .eq('id', deletionId)
    }

    // Update deletion record status
    await supabase
      .from('deleted_users')
      .update({
        status: 'confirmed',
        deletion_confirmed_at: new Date(),
      })
      .eq('id', deletionId)

    // Revoke all sessions - sign out user immediately
    await supabase.auth.signOut()

    // Schedule deletion in 30 days (via a scheduled job/function)
    // This would be handled by a separate cron job or scheduled function
    // that runs daily and purges accounts where deletion_confirmed_at + 30 days < now

    return NextResponse.json(
      {
        success: true,
        message: 'Account deletion confirmed. Your data will be purged in 30 days.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error confirming deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
