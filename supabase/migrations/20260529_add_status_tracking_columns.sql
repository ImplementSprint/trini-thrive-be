-- Add status tracking columns to digital_donor_profiles
ALTER TABLE public.digital_donor_profiles
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Add status tracking columns to beneficiary_profiles
ALTER TABLE public.beneficiary_profiles
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Add status tracking columns to campaign_manager_profiles
ALTER TABLE public.campaign_manager_profiles
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
