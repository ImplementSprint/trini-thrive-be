Supabase Table & Column Usage Map — TriniThrive HopeCard

  ---
  1. activity_logs

  Purpose: Admin audit trail for all admin actions
  Used in: libs/common/activity-logger.ts, admin-service/analytics/activity.service.ts

  ┌───────────────┬─────────────┬─────────┐
  │    Column     │    Type     │ Status  │
  ├───────────────┼─────────────┼─────────┤
  │ id            │ uuid        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ admin_id      │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ admin_email   │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ action        │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ description   │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ resource_type │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ resource_id   │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ changes       │ jsonb       │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ ip_address    │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ user_agent    │ text        │ ✅ Used │
  ├───────────────┼─────────────┼─────────┤
  │ created_at    │ timestamptz │ ✅ Used │
  └───────────────┴─────────────┴─────────┘

  ---
  2. beneficiaries

  Purpose: Links a disaster event to a beneficiary auth user (legacy Damayan integration)
  Used in: beneficiary-service/withdrawals, beneficiary-service/notifications, frontend request-withdrawal & fund-management pages

  ┌───────────────────────┬─────────────┬─────────────────────────────┐
  │        Column         │    Type     │           Status            │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ id                    │ uuid        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ auth_user_id          │ uuid        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ damayan_disaster_id   │ uuid        │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ damayan_evacuee_id    │ uuid        │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ verification_status   │ text        │ ⚠️ Read indirectly via join │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ verified_by           │ uuid        │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ needs_description     │ text        │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ household_size        │ int         │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ supporting_doc_key    │ text        │ ❌ Not referenced in code   │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ created_at            │ timestamptz │ ⚠️ Implicit only            │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ total_amount_received │ numeric     │ ✅ Used (withdrawal checks) │
  └───────────────────────┴─────────────┴─────────────────────────────┘

  ---
  3. beneficiary_bank_accounts

  Purpose: Stores bank account details for beneficiaries for disbursement
  Used in: beneficiary-service/bank-accounts, admin-service/approvals, campaign-manager/actions/campaign.ts,
  beneficiary/banking-details

  ┌────────────────────────┬─────────────┬─────────────┐
  │         Column         │    Type     │   Status    │
  ├────────────────────────┼─────────────┼─────────────┤
  │ id                     │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ beneficiary_profile_id │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ bank_name              │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ account_holder_name    │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ account_number         │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ is_primary             │ boolean     │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ is_active              │ boolean     │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ created_at             │ timestamptz │ ⚠️ Implicit │
  ├────────────────────────┼─────────────┼─────────────┤
  │ updated_at             │ timestamptz │ ⚠️ Implicit │
  ├────────────────────────┼─────────────┼─────────────┤
  │ status                 │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ rejection_reason       │ text        │ ✅ Used     │
  └────────────────────────┴─────────────┴─────────────┘

  ---
  4. beneficiary_banking_activity

  Purpose: Audit log for bank account events (submissions, approvals, rejections)
  Used in: beneficiary-service/bank-accounts, beneficiary-service/withdrawals, frontend banking-details page

  ┌────────────────────────┬─────────────┬─────────────┐
  │         Column         │    Type     │   Status    │
  ├────────────────────────┼─────────────┼─────────────┤
  │ id                     │ uuid        │ ⚠️ Implicit │
  ├────────────────────────┼─────────────┼─────────────┤
  │ beneficiary_profile_id │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ bank_account_id        │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ event_type             │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ status                 │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ details                │ text        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ event_date             │ timestamptz │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ created_at             │ timestamptz │ ⚠️ Implicit │
  └────────────────────────┴─────────────┴─────────────┘

  ---
  5. beneficiary_disbursements

  Purpose: Tracks fund disbursements to beneficiaries
  Used in: —

  ┌────────────────────────┬─────────────┬───────────────────┐
  │         Column         │    Type     │      Status       │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ id                     │ uuid        │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ campaign_id            │ uuid        │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ beneficiary_profile_id │ uuid        │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ reference_id           │ text        │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ amount                 │ numeric     │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ status                 │ text        │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ disbursed_at           │ timestamptz │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ created_at             │ timestamptz │ ❌ Not referenced │
  ├────────────────────────┼─────────────┼───────────────────┤
  │ notes                  │ text        │ ❌ Not referenced │
  └────────────────────────┴─────────────┴───────────────────┘

  ---
  6. beneficiary_identity_documents

  Purpose: Stores uploaded identity documents for verification
  Used in: beneficiary-service/identity-documents, admin-service/approvals, beneficiary/identity-verification

  ┌────────────────────────┬─────────────┬───────────────────────────┐
  │         Column         │    Type     │          Status           │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ id                     │ uuid        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ beneficiary_profile_id │ uuid        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ document_key           │ text        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ document_label         │ text        │ ⚠️ Stored but rarely read │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ status                 │ text        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ submitted_at           │ timestamptz │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ reviewed_by            │ uuid        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ reviewed_at            │ timestamptz │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ rejection_reason       │ text        │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ created_at             │ timestamptz │ ✅ Used                   │
  ├────────────────────────┼─────────────┼───────────────────────────┤
  │ updated_at             │ timestamptz │ ⚠️ Implicit               │
  └────────────────────────┴─────────────┴───────────────────────────┘

  ---
  7. beneficiary_profiles

  Purpose: Core profile table for all beneficiary users — most referenced table in the system
  Used in: 20+ files across frontend and both beneficiary, campaign-manager, and admin backend services

  ┌─────────────────────┬─────────────┬───────────────────────────────────────────────┐
  │       Column        │    Type     │                    Status                     │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ id                  │ uuid        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ auth_user_id        │ uuid        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ first_name          │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ last_name           │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ phone               │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ address             │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ barangay            │ text        │ ⚠️ Selected in broad queries, rarely targeted │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ municipality        │ text        │ ⚠️ Selected in broad queries, rarely targeted │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ province            │ text        │ ⚠️ Selected in broad queries, rarely targeted │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ profile_photo_key   │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ role                │ text        │ ⚠️ Default only, rarely checked               │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ status              │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ id_verification_key │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ verified_by         │ uuid        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ verified_at         │ timestamptz │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ rejection_reason    │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ created_at          │ timestamptz │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ updated_at          │ timestamptz │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ email               │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ account_number      │ text        │ ✅ Used (banking details)                     │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ account_name        │ text        │ ⚠️ Stored, rarely queried                     │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ bank_name           │ text        │ ✅ Used                                       │
  ├─────────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ campaign_id         │ uuid        │ ✅ Used                                       │
  └─────────────────────┴─────────────┴───────────────────────────────────────────────┘

  ---
  8. beneficiary_transactions

  Purpose: Tracks fund transfers or disbursement transactions for beneficiaries
  Used in: beneficiary-service/notifications, beneficiary-service/withdrawals

  ┌──────────────────┬─────────────┬─────────────────────────────────────┐
  │      Column      │    Type     │               Status                │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ id               │ uuid        │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ beneficiary_id   │ uuid        │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ campaign_id      │ uuid        │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ reference_number │ text        │ ⚠️ Generated but not surfaced in UI │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ amount           │ numeric     │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ status           │ text        │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ approved_by      │ uuid        │ ⚠️ Written but not read in frontend │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ approved_at      │ timestamptz │ ⚠️ Written but not read in frontend │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ rejection_reason │ text        │ ⚠️ Written but not read in frontend │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ notes            │ text        │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ created_at       │ timestamptz │ ✅ Used                             │
  ├──────────────────┼─────────────┼─────────────────────────────────────┤
  │ updated_at       │ timestamptz │ ⚠️ Implicit                         │
  └──────────────────┴─────────────┴─────────────────────────────────────┘

  ---
  9. beneficiary_withdrawals

  Purpose: Withdrawal requests from beneficiaries against their available balance
  Used in: beneficiary-service/withdrawals, frontend request-withdrawal & fund-management pages

  ┌──────────────────┬─────────────┬──────────────────────────────────────┐
  │      Column      │    Type     │                Status                │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ id               │ uuid        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ beneficiary_id   │ uuid        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ bank_account_id  │ uuid        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ reference_number │ text        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ amount           │ numeric     │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ status           │ text        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ processed_by     │ uuid        │ ⚠️ Written, not surfaced in frontend │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ processed_at     │ timestamptz │ ⚠️ Written, not surfaced in frontend │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ rejection_reason │ text        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ notes            │ text        │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ created_at       │ timestamptz │ ✅ Used                              │
  ├──────────────────┼─────────────┼──────────────────────────────────────┤
  │ updated_at       │ timestamptz │ ⚠️ Implicit                          │
  └──────────────────┴─────────────┴──────────────────────────────────────┘

  ---
  10. campaign_beneficiaries

  Purpose: Join table linking campaigns to their assigned beneficiaries (accepted invitations)
  Used in: beneficiary-service/campaigns, campaign-manager-service/campaigns, admin-service/beneficiaries

  ┌────────────────────────┬─────────────┬─────────────┐
  │         Column         │    Type     │   Status    │
  ├────────────────────────┼─────────────┼─────────────┤
  │ id                     │ uuid        │ ⚠️ Implicit │
  ├────────────────────────┼─────────────┼─────────────┤
  │ campaign_id            │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ beneficiary_profile_id │ uuid        │ ✅ Used     │
  ├────────────────────────┼─────────────┼─────────────┤
  │ created_at             │ timestamptz │ ⚠️ Implicit │
  └────────────────────────┴─────────────┴─────────────┘

  ---
  11. campaign_invitations

  Purpose: Tracks invitations sent from campaign managers to beneficiaries
  Used in: campaign-manager/actions/campaign.ts, beneficiary-service/campaigns, beneficiary-service/notifications

  ┌────────────────────────┬─────────────┬─────────────────────────────┐
  │         Column         │    Type     │           Status            │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ id                     │ uuid        │ ✅ Used                     │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ campaign_id            │ uuid        │ ✅ Used                     │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ beneficiary_profile_id │ uuid        │ ✅ Used                     │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ status                 │ text        │ ✅ Used (pending, accepted) │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ invited_at             │ timestamptz │ ✅ Used                     │
  ├────────────────────────┼─────────────┼─────────────────────────────┤
  │ responded_at           │ timestamptz │ ✅ Used                     │
  └────────────────────────┴─────────────┴─────────────────────────────┘

  ---
  12. campaign_manager_profiles

  Purpose: Core profile table for campaign manager users
  Used in: 13+ files across frontend CM portal and admin, campaign-manager backend services

  ┌──────────────────────────────────┬─────────────┬───────────────────────────────────────┐
  │              Column              │    Type     │                Status                 │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ id                               │ uuid        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ auth_user_id                     │ uuid        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ first_name                       │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ last_name                        │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ phone                            │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ address                          │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ barangay                         │ text        │ ❌ Never read or written in any query │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ municipality                     │ text        │ ❌ Never read or written in any query │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ province                         │ text        │ ❌ Never read or written in any query │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ profile_photo_key                │ text        │ ❌ Never read or written in any query │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ role                             │ text        │ ❌ Default only, never queried        │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ status                           │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ sec_registration                 │ text        │ ✅ Used (upload on signup)            │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ organization_name                │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ organization_type                │ text        │ ❌ Never queried                      │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ organization_registration_number │ text        │ ❌ Never queried                      │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ organizational_certificate       │ text        │ ✅ Used (upload on signup)            │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ approved_by                      │ uuid        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ approved_at                      │ timestamptz │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ rejection_reason                 │ text        │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ total_campaigns_created          │ int         │ ❌ Never incremented or read in code  │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ active_campaigns_count           │ int         │ ❌ Never incremented or read in code  │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ total_funds_raised               │ numeric     │ ❌ Never incremented or read in code  │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ created_at                       │ timestamptz │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ updated_at                       │ timestamptz │ ✅ Used                               │
  ├──────────────────────────────────┼─────────────┼───────────────────────────────────────┤
  │ email                            │ text        │ ✅ Used                               │
  └──────────────────────────────────┴─────────────┴───────────────────────────────────────┘

  ---
  13. cart_items

  Purpose: Individual line items inside a donor's shopping cart
  Used in: donor-contexts/CartContext.tsx, donor-service/cart

  ┌─────────────┬─────────────┬──────────────────────────┐
  │   Column    │    Type     │          Status          │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ id          │ uuid        │ ✅ Used                  │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ cart_id     │ uuid        │ ✅ Used                  │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ campaign_id │ uuid        │ ✅ Used                  │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ face_value  │ numeric     │ ✅ Used                  │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ quantity    │ int         │ ✅ Used                  │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ added_at    │ timestamptz │ ⚠️ Stored, not displayed │
  ├─────────────┼─────────────┼──────────────────────────┤
  │ updated_at  │ timestamptz │ ⚠️ Stored, not displayed │
  └─────────────┴─────────────┴──────────────────────────┘

  ---
  14. carts

  Purpose: Shopping cart per donor session
  Used in: donor-contexts/CartContext.tsx, donor-service/cart

  ┌──────────────┬─────────────┬─────────────┐
  │    Column    │    Type     │   Status    │
  ├──────────────┼─────────────┼─────────────┤
  │ id           │ uuid        │ ✅ Used     │
  ├──────────────┼─────────────┼─────────────┤
  │ auth_user_id │ uuid        │ ✅ Used     │
  ├──────────────┼─────────────┼─────────────┤
  │ status       │ text        │ ✅ Used     │
  ├──────────────┼─────────────┼─────────────┤
  │ created_at   │ timestamptz │ ⚠️ Implicit │
  ├──────────────┼─────────────┼─────────────┤
  │ updated_at   │ timestamptz │ ⚠️ Implicit │
  └──────────────┴─────────────┴─────────────┘

  ---
  15. digital_donor_profiles

  Purpose: Core profile table for donor users
  Used in: campaign-manager/actions/reports.ts, donor-service/auth, admin-service/approvals, admin-service/analytics,
  campaign-manager-service/reporting

  ┌──────────────────────────┬─────────────┬───────────────────────────────────────────────────────┐
  │          Column          │    Type     │                        Status                         │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ id                       │ uuid        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ auth_user_id             │ uuid        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ first_name               │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ last_name                │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ phone                    │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ address                  │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ barangay                 │ text        │ ⚠️ In broad selects, never targeted                   │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ municipality             │ text        │ ⚠️ In broad selects, never targeted                   │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ province                 │ text        │ ⚠️ In broad selects, never targeted                   │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ profile_photo_key        │ text        │ ⚠️ Selected, not displayed yet                        │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ role                     │ text        │ ⚠️ Default only                                       │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ preferred_payment_method │ text        │ ✅ Used (donor profile modal)                         │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ email_notifications      │ boolean     │ ❌ Never read or toggled in code                      │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ sms_notifications        │ boolean     │ ❌ Never read or toggled in code                      │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ total_donations_amount   │ numeric     │ ❌ Code computes live from hopecard_purchases instead │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ total_donations_count    │ int         │ ❌ Code computes live from hopecard_purchases instead │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ created_at               │ timestamptz │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ updated_at               │ timestamptz │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ status                   │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ id_verification_key      │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ verified_by              │ uuid        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ verified_at              │ timestamptz │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ rejection_reason         │ text        │ ✅ Used                                               │
  ├──────────────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ email                    │ text        │ ✅ Used                                               │
  └──────────────────────────┴─────────────┴───────────────────────────────────────────────────────┘

  ---
  16. hc_campaigns

  Purpose: Core campaign table — the central entity of the entire system
  Used in: 10+ files across all four services and the CM frontend portal

  ┌───────────────────────┬─────────────┬─────────────────────────────┐
  │        Column         │    Type     │           Status            │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ id                    │ uuid        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ title                 │ text        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ description           │ text        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ target_amount         │ numeric     │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ collected_amount      │ numeric     │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ bayanihub_campaign_id │ uuid        │ ❌ Never queried or written │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ damayan_disaster_id   │ uuid        │ ❌ Never queried or written │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ created_by            │ uuid        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ start_date            │ date        │ ⚠️ Stored, rarely read      │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ end_date              │ date        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ cover_image_key       │ text        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ status                │ text        │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ created_at            │ timestamptz │ ✅ Used                     │
  ├───────────────────────┼─────────────┼─────────────────────────────┤
  │ category              │ text        │ ✅ Used                     │
  └───────────────────────┴─────────────┴─────────────────────────────┘

  ---
  17. hc_donor_notifications

  Purpose: In-app notification records for donors
  Used in: —

  ┌───────────────┬─────────────┬───────────────────┐
  │    Column     │    Type     │      Status       │
  ├───────────────┼─────────────┼───────────────────┤
  │ id            │ uuid        │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ donor_auth_id │ text        │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ type          │ text        │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ title         │ text        │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ message       │ text        │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ metadata      │ jsonb       │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ is_read       │ boolean     │ ❌ Not referenced │
  ├───────────────┼─────────────┼───────────────────┤
  │ created_at    │ timestamptz │ ❌ Not referenced │
  └───────────────┴─────────────┴───────────────────┘

  ---
  18. hopecard_purchases

  Purpose: Records each hopecard purchase transaction by a donor
  Used in: campaign-manager/actions/reports.ts, donor-service/purchases, admin-service/analytics,
  campaign-manager-service/reporting

  ┌───────────────────┬─────────────┬───────────────────────────────────────────────┐
  │      Column       │    Type     │                    Status                     │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ id                │ uuid        │ ✅ Used                                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ buyer_auth_id     │ uuid        │ ✅ Used                                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ hopecard_id       │ uuid        │ ✅ Used                                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ amount_paid       │ numeric     │ ✅ Used                                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ payment_method    │ text        │ ⚠️ Stored, hardcoded as "Card" when read back │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ payment_reference │ text        │ ❌ Never read back in any query               │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ status            │ text        │ ✅ Used                                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────┤
  │ purchased_at      │ timestamptz │ ✅ Used                                       │
  └───────────────────┴─────────────┴───────────────────────────────────────────────┘

  ---
  19. hopecard_redemptions

  Purpose: Tracks when a beneficiary redeems/uses a hopecard
  Used in: campaign-manager-service/reporting (passive reference only)

  ┌────────────────┬─────────────┬───────────────────────────────────────────┐
  │     Column     │    Type     │                  Status                   │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ id             │ uuid        │ ❌ Not actively used                      │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ hopecard_id    │ uuid        │ ⚠️ Referenced in service but not actioned │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ beneficiary_id │ uuid        │ ⚠️ Referenced in service but not actioned │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ amount_used    │ numeric     │ ❌ Never read                             │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ balance_after  │ numeric     │ ❌ Never read                             │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ purpose        │ text        │ ❌ Never read                             │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ verified_by    │ uuid        │ ❌ Never read                             │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ redeemed_at    │ timestamptz │ ❌ Never read                             │
  ├────────────────┼─────────────┼───────────────────────────────────────────┤
  │ status         │ text        │ ❌ Never read                             │
  └────────────────┴─────────────┴───────────────────────────────────────────┘

  ---
  20. hopecards

  Purpose: Individual hopecard units linked to a campaign, with face value and balance
  Used in: campaign-manager/actions/reports.ts, campaign-manager/actions/campaign.ts, donor-service/purchases,
  campaign-manager-service/reporting

  ┌───────────────────┬─────────────┬───────────────────────────────────────────────────┐
  │      Column       │    Type     │                      Status                       │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ id                │ uuid        │ ✅ Used                                           │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ campaign_id       │ uuid        │ ✅ Used                                           │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ card_code         │ text        │ ⚠️ Generated, rarely surfaced                     │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ face_value        │ numeric     │ ✅ Used                                           │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ remaining_balance │ numeric     │ ⚠️ Stored, not computed from                      │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ purchased_by      │ uuid        │ ❌ Superseded by hopecard_purchases.buyer_auth_id │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ purchased_at      │ timestamptz │ ❌ Superseded by hopecard_purchases.purchased_at  │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ expiry_date       │ date        │ ❌ Never queried                                  │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ status            │ text        │ ⚠️ Exists, rarely filtered on                     │
  ├───────────────────┼─────────────┼───────────────────────────────────────────────────┤
  │ created_at        │ timestamptz │ ⚠️ Implicit                                       │
  └───────────────────┴─────────────┴───────────────────────────────────────────────────┘

  ---
  21. otp_sessions

  Purpose: Temporary OTP storage for admin two-factor login flow
  Used in: admin-service/auth, beneficiary-service/auth, donor-service/auth

  ┌───────────────┬─────────────┬─────────────────────────────────┐
  │    Column     │    Type     │             Status              │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ id            │ uuid        │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ email         │ text        │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ otp           │ text        │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ created_at_ms │ bigint      │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ expires_at_ms │ bigint      │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ used          │ boolean     │ ✅ Used                         │
  ├───────────────┼─────────────┼─────────────────────────────────┤
  │ created_at    │ timestamptz │ ⚠️ Redundant with created_at_ms │
  └───────────────┴─────────────┴─────────────────────────────────┘

  ---
  22. user_profiles

  Purpose: Generic user profile table (pre-dates role-specific profile tables)
  Used in: —

  ┌───────────────────┬─────────────┬───────────────────┐
  │      Column       │    Type     │      Status       │
  ├───────────────────┼─────────────┼───────────────────┤
  │ id                │ uuid        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ auth_user_id      │ uuid        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ first_name        │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ last_name         │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ phone             │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ address           │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ barangay          │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ municipality      │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ province          │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ profile_photo_key │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ role              │ text        │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ created_at        │ timestamptz │ ❌ Not referenced │
  ├───────────────────┼─────────────┼───────────────────┤
  │ updated_at        │ timestamptz │ ❌ Not referenced │
  └───────────────────┴─────────────┴───────────────────┘

  ---
  ⛔ Tables With Zero Active Usage

  These tables have no code references anywhere in the frontend or backend:

  ┌───────────────────────────┬─────────────────────────────────────────────────────────────────────────┬─────────────────────┐   
  │           Table           │                            Reason it exists                             │  Safe to archive?   │   
  ├───────────────────────────┼─────────────────────────────────────────────────────────────────────────┼─────────────────────┤   
  │ user_profiles             │ Legacy generic profile table — superseded by beneficiary_profiles,      │ ✅ Yes              │   
  │                           │ campaign_manager_profiles, digital_donor_profiles                       │                     │   
  ├───────────────────────────┼─────────────────────────────────────────────────────────────────────────┼─────────────────────┤   
  │ hc_donor_notifications    │ In-app donor notification system — table exists but the read/write code │ ✅ Yes (feature     │   
  │                           │  was never implemented                                                  │ incomplete)         │   
  ├───────────────────────────┼─────────────────────────────────────────────────────────────────────────┼─────────────────────┤   
  │ beneficiary_disbursements │ Intended for admin-triggered fund releases — backend service never      │ ⚠️ Keep for planned │   
  │                           │ wired up                                                                │  feature            │   
  └───────────────────────────┴─────────────────────────────────────────────────────────────────────────┴─────────────────────┘   

  ⚠️ Tables That Exist But Are Functionally Hollow

  These tables are referenced in code but never meaningfully populated or read end-to-end:

  ┌───────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐  
  │           Table           │                                             Issue                                              │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ hopecard_redemptions      │ Referenced in reporting service but no redemption flow exists in any frontend or backend route │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ beneficiaries             │ Partially used — the damayan_* columns are dead weight from an external integration that was   │  
  │                           │ never completed                                                                                │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ hc_campaigns              │ bayanihub_campaign_id and damayan_disaster_id columns are orphaned foreign keys to systems     │  
  │                           │ never integrated                                                                               │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ campaign_manager_profiles │ total_campaigns_created, active_campaigns_count, total_funds_raised are denormalized counters  │  
  │                           │ that are never incremented — all stats are computed live from hc_campaigns instead             │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ digital_donor_profiles    │ total_donations_amount and total_donations_count are denormalized counters never updated —     │  
  │                           │ code always re-queries hopecard_purchases raw                                                  │  
  ├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ hopecards                 │ purchased_by, purchased_at, expiry_date are unused — purchase tracking moved entirely to       │  
  │                           │ hopecard_purchases                                                                             │  
  └───────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘  
