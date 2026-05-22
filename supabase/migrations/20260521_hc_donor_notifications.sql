create table if not exists hc_donor_notifications (
  id uuid primary key default gen_random_uuid(),
  donor_auth_id text not null,
  type text not null check (type in ('new_campaign', 'donation_success')),
  title text not null,
  message text not null,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_hc_donor_notifications_donor
  on hc_donor_notifications (donor_auth_id, created_at desc);

alter table hc_donor_notifications enable row level security;
