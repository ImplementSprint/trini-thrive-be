-- Add status expiration tracking to all profile tables
-- Supports temporary suspensions/bans that automatically expire

ALTER TABLE public.digital_donor_profiles
ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

ALTER TABLE public.beneficiary_profiles
ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

ALTER TABLE public.campaign_manager_profiles
ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.digital_donor_profiles.status_expires_at IS 'Timestamp when suspension/ban expires; NULL indicates permanent ban or active status';
COMMENT ON COLUMN public.beneficiary_profiles.status_expires_at IS 'Timestamp when suspension/ban expires; NULL indicates permanent ban or active status';
COMMENT ON COLUMN public.campaign_manager_profiles.status_expires_at IS 'Timestamp when suspension/ban expires; NULL indicates permanent ban or active status';
