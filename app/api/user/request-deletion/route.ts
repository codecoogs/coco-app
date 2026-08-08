import { createServerSupabaseClient } from '@/utils/supabase'
import {
  generateDeletionLink,
  sendDeletionConfirmationEmail,
} from '@/utils/deletion-link'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if deletion already requested
    const { data: existingRequest } = await supabase
      .from('deleted_users')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Deletion request already in progress' },
        { status: 400 }
      )
    }

    // Get user email for confirmation
    const { data: userData } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Create deletion request record
    const { data: deletionRecord, error: dbError } = await supabase
      .from('deleted_users')
      .insert({
        user_id: user.id,
        auth_id: user.id,
        email: userData.email,
        full_name: `${userData.first_name} ${userData.last_name}`,
        deletion_requested_at: new Date(),
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error creating deletion record:', dbError)
      return NextResponse.json(
        { error: 'Failed to process deletion request' },
        { status: 500 }
      )
    }

    // Update users table with deletion_requested_at
    await supabase
      .from('users')
      .update({ deletion_requested_at: new Date() })
      .eq('auth_id', user.id)

    // Generate confirmation link
    const deletionLink = generateDeletionLink({
      deletionId: deletionRecord.id,
      userEmail: userData.email,
      expiresIn: 86400, // 24 hours
    })

    // Send confirmation email via Supabase email service
    try {
      await sendDeletionConfirmationEmail(
        userData.email,
        userData.first_name || 'User',
        deletionRecord.id,
        deletionLink
      )
    } catch (emailError) {
      console.error('Error sending deletion confirmation email:', emailError)
      // Delete the record since email wasn't sent
      await supabase
        .from('deleted_users')
        .delete()
        .eq('id', deletionRecord.id)

      return NextResponse.json(
        { error: 'Failed to send confirmation email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Deletion request created. Check your email for confirmation link.',
        deletionId: deletionRecord.id,
        expiresAt: deletionLink.expiresAt,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error requesting deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
