create table public.role_permissions (
  id uuid not null default extensions.uuid_generate_v4 (),
  role_id bigint null,
  permission_id uuid null,
  updated_at timestamp with time zone null default now(),
  updated_by uuid null default '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone null default now(),
  created_by uuid null default '00000000-0000-0000-0000-000000000001'::uuid,
  constraint role_permissions_pkey primary key (id),
  constraint role_permissions_position_id_permission_id_key unique (role_id, permission_id),
  constraint role_permissions_created_by_fkey foreign KEY (created_by) references users (id),
  constraint role_permissions_role_id_fkey foreign KEY (role_id) references roles (id),
  constraint role_permissions_updated_by_fkey foreign KEY (updated_by) references users (id),
  constraint role_permissions_position_id_fkey foreign KEY (role_id) references positions (id) on delete CASCADE,
  constraint role_permissions_permission_id_fkey foreign KEY (permission_id) references permissions (id) on delete CASCADE
) TABLESPACE pg_default;