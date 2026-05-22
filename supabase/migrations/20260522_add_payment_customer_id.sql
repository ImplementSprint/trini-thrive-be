alter table digital_donor_profiles
  add column if not exists payment_customer_id text;
