-- Partner API keys for read-only public campaign access
CREATE TABLE IF NOT EXISTS public.partner_api_keys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT UNIQUE NOT NULL,
  partner_name   TEXT NOT NULL,
  allowed_origin TEXT,               -- optional CORS origin e.g. 'https://partner.com'
  is_active      BOOLEAN NOT NULL DEFAULT true,
  daily_limit    INT NOT NULL DEFAULT 1000,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS — this table is only ever read by the service-role key on the backend
ALTER TABLE public.partner_api_keys DISABLE ROW LEVEL SECURITY;

-- Seed one test key for development
INSERT INTO public.partner_api_keys (key, partner_name, daily_limit)
VALUES ('pk_test_hopecard_partner_dev', 'Dev Partner', 1000)
ON CONFLICT (key) DO NOTHING;
