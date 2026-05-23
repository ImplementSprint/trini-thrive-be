"""
All Athena CTAS queries for the PowerBI-ready result tables.
Each entry in CTAS_QUERIES maps table_name → (drop_sql, create_sql).
Placeholders: {bucket} and {database} are filled at runtime from env vars.
"""

# ── Shared fragments ──────────────────────────────────────────────────────────

_WITH_OPTIONS = """
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/{table}/'
)"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_operational_reliability
# Feeds PowerBI Dashboard: Operational Reliability
# Metrics: Aid Match, Gateway Failure Rate, Refund Leakage (24h),
#          Projected Monthly Revenue
# Refresh trigger: hopecard_purchases | beneficiary_disbursements | hc_campaigns
# ═══════════════════════════════════════════════════════════════════════════════

OPERATIONAL_RELIABILITY = """
CREATE TABLE {database}.pbi_operational_reliability
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_operational_reliability/'
)
AS
WITH daily_variance AS (
  SELECT
    date_trunc('day', d.created_at)          AS day,
    SUM(d.amount) - SUM(p.amount_paid)       AS variance,
    SUM(d.amount)                            AS total_disbursed,
    SUM(p.amount_paid)                       AS total_paid
  FROM beneficiary_disbursements d
  JOIN hc_campaigns       c ON c.id          = d.campaign_id
  JOIN hopecards          h ON h.campaign_id = c.id
  JOIN hopecard_purchases p ON p.hopecard_id = h.id
  WHERE d.created_at   >= current_timestamp - INTERVAL '7' DAY
    AND p.purchased_at >= current_timestamp - INTERVAL '7' DAY
  GROUP BY date_trunc('day', d.created_at)
),
payment_stats_7d AS (
  SELECT
    COUNT(*)                                                          AS total_transactions_7d,
    COUNT(CASE WHEN status = 'failed'  THEN 1 END)                   AS failed_count_7d,
    COUNT(CASE WHEN status = 'success' THEN 1 END)                   AS success_count_7d,
    ROUND(
      COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
      / NULLIF(COUNT(*), 0), 4)                                       AS gateway_failure_rate_pct,
    ROUND(
      SUM(CASE WHEN status = 'success' THEN amount_paid ELSE 0 END), 2
    )                                                                 AS revenue_7d
  FROM hopecard_purchases
  WHERE purchased_at >= current_timestamp - INTERVAL '7' DAY
),
refunds_24h AS (
  SELECT
    COUNT(*)                                AS refund_count_24h,
    ROUND(COALESCE(SUM(amount_paid), 0), 2) AS refund_leakage_24h,
    ROUND(COALESCE(AVG(amount_paid), 0), 2) AS avg_refund_amount_24h
  FROM hopecard_purchases
  WHERE status       = 'refunded'
    AND purchased_at >= current_timestamp - INTERVAL '1' DAY
),
payment_method_breakdown AS (
  SELECT
    payment_method,
    COUNT(*)                                                           AS txn_count,
    ROUND(
      COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
      / NULLIF(COUNT(*), 0), 4)                                        AS method_failure_rate_pct,
    CASE
      WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
           / NULLIF(COUNT(*), 0) > 10 THEN 'HIGH_RISK'
      WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
           / NULLIF(COUNT(*), 0) > 5  THEN 'MEDIUM_RISK'
      ELSE 'LOW_RISK'
    END                                                                AS risk_label
  FROM hopecard_purchases
  WHERE purchased_at >= current_timestamp - INTERVAL '7' DAY
  GROUP BY payment_method
)
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,

  -- Aid Match
  ROUND(AVG(dv.variance), 2)                                          AS avg_issuance_variance_7d,
  ROUND(
    AVG(ABS(dv.variance)) / NULLIF(AVG(dv.total_disbursed), 0) * 100,
    2)                                                                 AS aid_match_deviation_pct,
  ROUND(AVG(dv.total_disbursed), 2)                                   AS avg_daily_disbursed,
  ROUND(AVG(dv.total_paid), 2)                                        AS avg_daily_paid,

  -- Gateway Failure Rate
  ps.total_transactions_7d,
  ps.failed_count_7d,
  ps.success_count_7d,
  ps.gateway_failure_rate_pct,

  -- Refund Leakage 24h
  r.refund_count_24h,
  r.refund_leakage_24h,
  r.avg_refund_amount_24h,

  -- Projected Monthly Revenue
  ROUND(ps.revenue_7d / 7 * 30, 2)                                    AS projected_monthly_revenue,
  ps.revenue_7d                                                        AS actual_revenue_7d

FROM daily_variance   dv
CROSS JOIN payment_stats_7d ps
CROSS JOIN refunds_24h      r
GROUP BY
  ps.total_transactions_7d, ps.failed_count_7d, ps.success_count_7d,
  ps.gateway_failure_rate_pct, ps.revenue_7d,
  r.refund_count_24h, r.refund_leakage_24h, r.avg_refund_amount_24h,
  current_date, current_timestamp;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_payment_method_risk
# Feeds PowerBI Dashboard: Operational Reliability → Method Risk breakdown
# Refresh trigger: hopecard_purchases
# ═══════════════════════════════════════════════════════════════════════════════

PAYMENT_METHOD_RISK = """
CREATE TABLE {database}.pbi_payment_method_risk
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_payment_method_risk/'
)
AS
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,
  payment_method,

  -- Volume
  COUNT(*)                                                             AS total_transactions_7d,
  COUNT(CASE WHEN status = 'success'  THEN 1 END)                     AS success_count,
  COUNT(CASE WHEN status = 'failed'   THEN 1 END)                     AS failed_count,
  COUNT(CASE WHEN status = 'refunded' THEN 1 END)                     AS refunded_count,

  -- Rates
  ROUND(
    COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0), 4)                                          AS success_rate_pct,
  ROUND(
    COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0), 4)                                          AS failure_rate_7d_pct,

  -- Amount stats
  ROUND(SUM(CASE WHEN status = 'success' THEN amount_paid ELSE 0 END), 2) AS revenue_7d,
  ROUND(AVG(CASE WHEN status = 'success' THEN amount_paid END), 2)    AS avg_success_amount,

  -- Risk classification
  CASE
    WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
         / NULLIF(COUNT(*), 0) > 10 THEN 'HIGH_RISK'
    WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
         / NULLIF(COUNT(*), 0) > 5  THEN 'MEDIUM_RISK'
    ELSE 'LOW_RISK'
  END                                                                  AS risk_label,

  -- Prescriptive flag
  CASE
    WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0
         / NULLIF(COUNT(*), 0) > 10
    THEN 'Route away — failure rate exceeds 10%'
    ELSE 'Maintain routing'
  END                                                                  AS routing_recommendation

FROM hopecard_purchases
WHERE purchased_at >= current_timestamp - INTERVAL '7' DAY
GROUP BY payment_method
ORDER BY failure_rate_7d_pct DESC;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_mission_delivery
# Feeds PowerBI Dashboard: Mission Delivery / Impact Equity
# Metrics: Aid per Beneficiary, Efficiency Risk Score, Verification Coverage,
#          Aid Sufficiency Forecast, Evacuation Support Total
# Refresh trigger: beneficiary_disbursements | beneficiary_profiles |
#                  hc_campaigns | beneficiaries
# ═══════════════════════════════════════════════════════════════════════════════

MISSION_DELIVERY = """
CREATE TABLE {database}.pbi_mission_delivery
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_mission_delivery/'
)
AS
WITH area_stats AS (
  SELECT
    bp.barangay,
    bp.municipality,

    COUNT(DISTINCT CASE WHEN b.verification_status = 'verified' THEN bp.id END)
                                                                       AS verified_beneficiaries,
    COUNT(DISTINCT bp.id)                                              AS total_beneficiaries,

    ROUND(
      COUNT(DISTINCT CASE WHEN b.verification_status = 'verified' THEN bp.id END) * 100.0
      / NULLIF(COUNT(DISTINCT bp.id), 0), 2)                          AS verification_coverage_rate,

    ROUND(SUM(bd.amount), 2)                                           AS total_disbursed,

    ROUND(
      SUM(bd.amount)
      / NULLIF(COUNT(DISTINCT CASE WHEN b.verification_status = 'verified' THEN bp.id END), 0),
      2)                                                               AS aid_per_verified_beneficiary

  FROM beneficiary_disbursements   bd
  JOIN beneficiary_profiles        bp ON bp.id           = bd.beneficiary_profile_id
  JOIN beneficiaries               b  ON b.auth_user_id  = bp.auth_user_id
  GROUP BY bp.barangay, bp.municipality
),
national AS (
  SELECT
    AVG(aid_per_verified_beneficiary)   AS nat_avg,
    SUM(total_disbursed)                AS national_total_disbursed,
    SUM(verified_beneficiaries)         AS national_verified_beneficiaries
  FROM area_stats
),
campaign_stats AS (
  SELECT
    c.id                                AS campaign_id,
    c.title,
    c.goal_amount,
    c.status,
    COUNT(DISTINCT bd.beneficiary_profile_id) AS unique_beneficiaries_reached,
    ROUND(SUM(bd.amount), 2)            AS total_raised,
    ROUND(
      SUM(bd.amount) * 100.0 / NULLIF(c.goal_amount, 0), 2
    )                                   AS pct_funded
  FROM hc_campaigns c
  LEFT JOIN beneficiary_disbursements bd ON bd.campaign_id = c.id
  GROUP BY c.id, c.title, c.goal_amount, c.status
),
evacuation AS (
  SELECT ROUND(COALESCE(SUM(bd.amount), 0), 2) AS evacuation_support_total
  FROM beneficiary_disbursements bd
  JOIN hc_campaigns c ON c.id = bd.campaign_id
  WHERE lower(c.title) LIKE '%evacuation%'
     OR lower(c.title) LIKE '%disaster%'
     OR lower(c.title) LIKE '%relief%'
     OR lower(c.title) LIKE '%emergency%'
)
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,

  -- Area identifiers
  a.barangay,
  a.municipality,

  -- Beneficiary counts
  a.verified_beneficiaries,
  a.total_beneficiaries,
  a.verification_coverage_rate                                         AS verification_coverage_rate_pct,

  -- Aid disbursement
  a.total_disbursed,
  a.aid_per_verified_beneficiary                                       AS aid_per_beneficiary,

  -- National benchmarks
  ROUND(n.nat_avg, 2)                                                  AS national_avg_aid_per_beneficiary,
  n.national_total_disbursed,
  n.national_verified_beneficiaries,

  -- Deviation from national average
  ROUND(
    (a.aid_per_verified_beneficiary - n.nat_avg)
    / NULLIF(n.nat_avg, 0) * 100, 2)                                  AS deviation_from_national_pct,

  -- Efficiency risk score (for PowerBI conditional formatting)
  CASE
    WHEN a.aid_per_verified_beneficiary < n.nat_avg * 0.75 THEN 'HIGH_RISK'
    WHEN a.aid_per_verified_beneficiary < n.nat_avg * 0.90 THEN 'MEDIUM_RISK'
    ELSE 'LOW_RISK'
  END                                                                  AS efficiency_risk_score,

  -- Numeric risk score for slicers / color scales (0–100, lower = riskier)
  ROUND(
    LEAST(
      a.aid_per_verified_beneficiary / NULLIF(n.nat_avg, 0) * 100,
      100),
    2)                                                                 AS aid_sufficiency_forecast_pct,

  -- Prescriptive flag
  CASE
    WHEN a.aid_per_verified_beneficiary < n.nat_avg * 0.75
    THEN 'Increase verification + disbursement — high leakage risk'
    WHEN a.aid_per_verified_beneficiary < n.nat_avg * 0.90
    THEN 'Monitor — below national average'
    ELSE 'On track'
  END                                                                  AS prescriptive_action,

  -- National totals (for summary cards)
  e.evacuation_support_total

FROM area_stats  a
CROSS JOIN national   n
CROSS JOIN evacuation e
ORDER BY a.aid_per_verified_beneficiary ASC;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_user_experience
# Feeds PowerBI Dashboard: User Experience & Adoption
# Metrics: Cart Abandonment Rate, Refund Leakage (24h),
#          Lifetime Aid Received, Payment Success Variance
# Refresh trigger: carts | cart_items | hopecard_purchases |
#                  beneficiary_disbursements | beneficiary_withdrawals
# ═══════════════════════════════════════════════════════════════════════════════

USER_EXPERIENCE = """
CREATE TABLE {database}.pbi_user_experience
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_user_experience/'
)
AS
WITH cart_stats AS (
  SELECT
    COUNT(*)                                                           AS total_carts,
    COUNT(CASE WHEN status IN ('abandoned','expired') THEN 1 END)     AS abandoned_carts,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)                  AS completed_carts,
    ROUND(
      COUNT(CASE WHEN status IN ('abandoned','expired') THEN 1 END) * 100.0
      / NULLIF(COUNT(*), 0), 2)                                        AS cart_abandonment_rate_pct
  FROM carts
),
refund_24h AS (
  SELECT
    COUNT(*)                                AS refund_count_24h,
    ROUND(COALESCE(SUM(amount_paid), 0), 2) AS refund_leakage_24h,
    ROUND(COALESCE(AVG(amount_paid), 0), 2) AS avg_refund_24h
  FROM hopecard_purchases
  WHERE status       = 'refunded'
    AND purchased_at >= current_timestamp - INTERVAL '1' DAY
),
lifetime_aid AS (
  SELECT
    b.auth_user_id,
    ROUND(COALESCE(SUM(bd.amount), 0), 2)   AS lifetime_aid_received,
    COUNT(DISTINCT bd.campaign_id)           AS campaigns_received_from,
    MAX(bd.disbursed_at)                     AS last_aid_date
  FROM beneficiaries               b
  JOIN beneficiary_profiles        bp ON bp.auth_user_id = b.auth_user_id
  JOIN beneficiary_disbursements   bd ON bd.beneficiary_profile_id = bp.id
  GROUP BY b.auth_user_id
),
payment_variance AS (
  SELECT
    ROUND(STDDEV(amount_paid), 2)            AS payment_success_variance,
    ROUND(AVG(amount_paid), 2)               AS avg_success_amount,
    ROUND(MIN(amount_paid), 2)               AS min_success_amount,
    ROUND(MAX(amount_paid), 2)               AS max_success_amount,
    COUNT(*)                                 AS total_success_count
  FROM hopecard_purchases
  WHERE status = 'success'
),
withdrawal_refund_risk AS (
  SELECT
    bw.beneficiary_id,
    COUNT(bw.id)                             AS total_withdrawals,
    COUNT(bw.id) OVER (
      PARTITION BY bw.beneficiary_id
      ORDER BY bw.created_at
      RANGE BETWEEN INTERVAL '30' DAY PRECEDING AND CURRENT ROW
    )                                        AS withdrawals_30d,
    COALESCE(bw.notes, bw.rejection_reason, 'unspecified') AS reason_proxy
  FROM beneficiary_withdrawals bw
)
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,

  -- Cart Abandonment
  cs.total_carts,
  cs.abandoned_carts,
  cs.completed_carts,
  cs.cart_abandonment_rate_pct,

  -- Refund Leakage 24h
  r.refund_count_24h,
  r.refund_leakage_24h,
  r.avg_refund_24h,

  -- Lifetime Aid (aggregate across all beneficiaries)
  ROUND(AVG(la.lifetime_aid_received), 2)                             AS avg_lifetime_aid_received,
  ROUND(MAX(la.lifetime_aid_received), 2)                             AS max_lifetime_aid_received,
  ROUND(MIN(la.lifetime_aid_received), 2)                             AS min_lifetime_aid_received,
  COUNT(DISTINCT la.auth_user_id)                                     AS total_beneficiaries_with_aid,

  -- Payment Variance
  pv.payment_success_variance,
  pv.avg_success_amount,
  pv.min_success_amount,
  pv.max_success_amount,
  pv.total_success_count

FROM cart_stats        cs
CROSS JOIN refund_24h  r
CROSS JOIN payment_variance pv
CROSS JOIN lifetime_aid     la
GROUP BY
  cs.total_carts, cs.abandoned_carts, cs.completed_carts, cs.cart_abandonment_rate_pct,
  r.refund_count_24h, r.refund_leakage_24h, r.avg_refund_24h,
  pv.payment_success_variance, pv.avg_success_amount, pv.min_success_amount,
  pv.max_success_amount, pv.total_success_count,
  current_date, current_timestamp;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_cart_abandonment_detail
# Per-user abandonment risk signals for PowerBI drill-through
# Refresh trigger: carts | cart_items | activity_logs
# ═══════════════════════════════════════════════════════════════════════════════

CART_ABANDONMENT_DETAIL = """
CREATE TABLE {database}.pbi_cart_abandonment_detail
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_cart_abandonment_detail/'
)
AS
WITH cart_load AS (
  SELECT
    ci.cart_id,
    COUNT(DISTINCT ci.id)                                AS item_types,
    SUM(ci.quantity)                                     AS total_items,
    ROUND(SUM(ci.quantity * ci.unit_price), 2)           AS cart_value
  FROM cart_items ci
  GROUP BY ci.cart_id
),
prior_abandonment AS (
  SELECT
    auth_user_id,
    COUNT(*)                                             AS prior_abandoned_count
  FROM carts
  WHERE status IN ('abandoned','expired')
  GROUP BY auth_user_id
),
device AS (
  SELECT DISTINCT
    CAST(resource_id AS VARCHAR)                         AS cart_id,
    user_agent                                           AS device_channel
  FROM activity_logs
  WHERE resource_type = 'cart'
)
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,
  c.id                                                                 AS cart_id,
  c.auth_user_id,
  c.status,

  -- Feature 1: inactivity duration
  date_diff('minute', c.created_at, c.updated_at)                    AS cart_inactivity_minutes,

  -- Feature 2: cart load
  COALESCE(cl.item_types, 0)                                          AS distinct_item_types,
  COALESCE(cl.total_items, 0)                                         AS total_items_in_cart,
  COALESCE(cl.cart_value, 0)                                          AS cart_total_value,

  -- Feature 3: prior abandonment history
  COALESCE(pa.prior_abandoned_count, 0)                               AS prior_abandonment_count,

  -- Feature 4: device channel
  COALESCE(d.device_channel, 'unknown')                               AS device_channel,

  -- Composite abandonment risk
  CASE
    WHEN date_diff('minute', c.created_at, c.updated_at) > 60
     AND COALESCE(pa.prior_abandoned_count, 0) >= 2                   THEN 'HIGH'
    WHEN date_diff('minute', c.created_at, c.updated_at) > 30
      OR COALESCE(pa.prior_abandoned_count, 0) >= 1                   THEN 'MEDIUM'
    ELSE 'LOW'
  END                                                                  AS abandonment_risk,

  -- Prescriptive action
  CASE
    WHEN date_diff('minute', c.created_at, c.updated_at) > 60
     AND COALESCE(pa.prior_abandoned_count, 0) >= 2
    THEN 'Send re-engagement push notification with discount'
    WHEN date_diff('minute', c.created_at, c.updated_at) > 30
    THEN 'Simplify checkout — user shows inactivity pattern'
    ELSE 'No action needed'
  END                                                                  AS prescriptive_action

FROM carts c
LEFT JOIN cart_load         cl ON cl.cart_id      = c.id
LEFT JOIN prior_abandonment pa ON pa.auth_user_id = c.auth_user_id
LEFT JOIN device            d  ON d.cart_id       = CAST(c.id AS VARCHAR);
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE: pbi_refund_likelihood
# Per-withdrawal refund risk signals for PowerBI drill-through
# Refresh trigger: beneficiary_withdrawals | beneficiary_disbursements
# ═══════════════════════════════════════════════════════════════════════════════

REFUND_LIKELIHOOD = """
CREATE TABLE {database}.pbi_refund_likelihood
WITH (
  format              = 'PARQUET',
  parquet_compression = 'SNAPPY',
  external_location   = 's3://{bucket}/powerbi-ready/pbi_refund_likelihood/'
)
AS
WITH last_disbursement AS (
  SELECT
    bp.auth_user_id,
    MAX(bd.disbursed_at)                                 AS last_disbursed_at,
    ROUND(SUM(bd.amount), 2)                             AS total_lifetime_disbursed
  FROM beneficiary_disbursements bd
  JOIN beneficiary_profiles bp ON bp.id = bd.beneficiary_profile_id
  GROUP BY bp.auth_user_id
),
withdrawal_window AS (
  SELECT
    bw.id                                                AS withdrawal_id,
    bw.beneficiary_id,
    bw.created_at,
    bw.notes,
    bw.rejection_reason,
    bw.status                                            AS withdrawal_status,
    -- 30-day rolling frequency
    COUNT(*) OVER (
      PARTITION BY bw.beneficiary_id
      ORDER BY bw.created_at
      RANGE BETWEEN INTERVAL '30' DAY PRECEDING AND CURRENT ROW
    )                                                    AS withdrawal_frequency_30d
  FROM beneficiary_withdrawals bw
)
SELECT
  current_date                                                         AS report_date,
  current_timestamp                                                    AS refreshed_at,
  ww.withdrawal_id,
  ww.beneficiary_id,
  ww.withdrawal_status,

  -- Feature 1: frequency
  ww.withdrawal_frequency_30d,

  -- Feature 2: recency relative to last disbursement
  date_diff('day', ld.last_disbursed_at, ww.created_at)              AS days_since_last_disbursement,
  ld.last_disbursed_at,
  ld.total_lifetime_disbursed,

  -- Feature 3: reason proxy
  COALESCE(ww.notes, ww.rejection_reason, 'unspecified')             AS withdrawal_reason_proxy,

  -- Composite refund likelihood
  CASE
    WHEN ww.withdrawal_frequency_30d >= 3
     AND date_diff('day', ld.last_disbursed_at, ww.created_at) < 7   THEN 'HIGH'
    WHEN ww.withdrawal_frequency_30d >= 2                             THEN 'MEDIUM'
    ELSE 'LOW'
  END                                                                  AS refund_likelihood,

  -- Prescriptive action
  CASE
    WHEN ww.withdrawal_frequency_30d >= 3
     AND date_diff('day', ld.last_disbursed_at, ww.created_at) < 7
    THEN 'Auto-flag for proactive review — high frequency + recent disbursement'
    WHEN ww.withdrawal_frequency_30d >= 2
    THEN 'Queue for manual approval — elevated withdrawal pattern'
    ELSE 'Auto-approve eligible'
  END                                                                  AS prescriptive_action

FROM withdrawal_window ww
LEFT JOIN last_disbursement ld ON ld.auth_user_id = ww.beneficiary_id;
"""

# ═══════════════════════════════════════════════════════════════════════════════
# Registry: maps table name → (drop SQL, create SQL, S3 result prefix)
# ═══════════════════════════════════════════════════════════════════════════════

CTAS_REGISTRY = {
    'pbi_operational_reliability': {
        'sql':      OPERATIONAL_RELIABILITY,
        'triggers': {
            'hopecard_purchases',
            'beneficiary_disbursements',
            'hc_campaigns',
            'hopecards',
        },
    },
    'pbi_payment_method_risk': {
        'sql':      PAYMENT_METHOD_RISK,
        'triggers': {
            'hopecard_purchases',
        },
    },
    'pbi_mission_delivery': {
        'sql':      MISSION_DELIVERY,
        'triggers': {
            'beneficiary_disbursements',
            'beneficiary_profiles',
            'hc_campaigns',
            'beneficiaries',
            'hopecards',
        },
    },
    'pbi_user_experience': {
        'sql':      USER_EXPERIENCE,
        'triggers': {
            'carts',
            'cart_items',
            'hopecard_purchases',
            'beneficiary_disbursements',
            'beneficiary_withdrawals',
        },
    },
    'pbi_cart_abandonment_detail': {
        'sql':      CART_ABANDONMENT_DETAIL,
        'triggers': {
            'carts',
            'cart_items',
            'activity_logs',
        },
    },
    'pbi_refund_likelihood': {
        'sql':      REFUND_LIKELIHOOD,
        'triggers': {
            'beneficiary_withdrawals',
            'beneficiary_disbursements',
            'beneficiary_profiles',
        },
    },
}

# Reverse index: source table → which result tables to refresh
SOURCE_TO_RESULT_TABLES: dict[str, set[str]] = {}
for result_table, cfg in CTAS_REGISTRY.items():
    for src in cfg['triggers']:
        SOURCE_TO_RESULT_TABLES.setdefault(src, set()).add(result_table)
