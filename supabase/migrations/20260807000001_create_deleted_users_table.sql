-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Track deleted user accounts for audit and compliance
CREATE TABLE IF NOT EXISTS public.deleted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  deletion_requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deletion_confirmed_at TIMESTAMP WITH TIME ZONE,
  deletion_completed_at TIMESTAMP WITH TIME ZONE,
  backup_exported BOOLEAN DEFAULT FALSE,
  backup_export_requested_at TIMESTAMP WITH TIME ZONE,
  restored_at TIMESTAMP WITH TIME ZONE,
  restored_by_user_id UUID REFERENCES public.users(id),
  deletion_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'purged', 'restored')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Only superadmin (is_admin = true) can view deleted users audit log
CREATE POLICY "Superadmin can view deleted users"
  ON public.deleted_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- Only superadmin can update deleted users (for restores)
CREATE POLICY "Superadmin can restore deleted users"
  ON public.deleted_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- Create index for tracking audit trail
CREATE INDEX IF NOT EXISTS idx_deleted_users_user_id ON public.deleted_users(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_users_status ON public.deleted_users(status);
CREATE INDEX IF NOT EXISTS idx_deleted_users_deletion_completed_at ON public.deleted_users(deletion_completed_at);

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_deleted_users_updated_at
  BEFORE UPDATE ON public.deleted_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.deleted_users IS 'Audit trail for deleted user accounts. Required for IRS tax-exempt compliance and legal records retention.';
COMMENT ON COLUMN public.deleted_users.status IS 'pending: deletion requested, confirmed: user confirmed via email, purged: data removed after 30 days, restored: account restored by admin';
