-- Ensure that deleting an auth user automatically removes their beneficiary profile.
-- If beneficiary_profiles.id already references auth.users(id), this is a no-op
-- that adds the ON DELETE CASCADE behaviour if it was missing.
--
-- Run this only if beneficiary_profiles.id is the auth user UUID.
-- If your table uses a separate PK with an auth_user_id FK column, adjust accordingly.

ALTER TABLE beneficiary_profiles
  DROP CONSTRAINT IF EXISTS beneficiary_profiles_id_fkey;

ALTER TABLE beneficiary_profiles
  ADD CONSTRAINT beneficiary_profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
