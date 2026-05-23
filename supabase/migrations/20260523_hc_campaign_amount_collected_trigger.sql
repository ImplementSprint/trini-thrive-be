-- Automatically maintain collected_amount on hc_campaigns whenever a
-- hopecard_purchases row is inserted or its status changes.

CREATE OR REPLACE FUNCTION hc_update_campaign_collected_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment on new paid purchase
  IF TG_OP = 'INSERT' AND NEW.status = 'paid' THEN
    UPDATE hc_campaigns
    SET collected_amount = collected_amount + NEW.amount_paid
    WHERE id = NEW.hopecard_id;

  -- Handle status change to paid (e.g. delayed confirmation)
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    UPDATE hc_campaigns
    SET collected_amount = collected_amount + NEW.amount_paid
    WHERE id = NEW.hopecard_id;

  -- Reverse if a paid row is refunded / status moved away from paid
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    UPDATE hc_campaigns
    SET collected_amount = GREATEST(0, collected_amount - OLD.amount_paid)
    WHERE id = NEW.hopecard_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_purchases_collected_amount ON hopecard_purchases;

CREATE TRIGGER trg_hc_purchases_collected_amount
AFTER INSERT OR UPDATE OF status ON hopecard_purchases
FOR EACH ROW
EXECUTE FUNCTION hc_update_campaign_collected_amount();

-- Backfill: recalculate collected_amount for all campaigns from existing paid purchases.
-- Safe to re-run; it resets to the authoritative sum rather than double-counting.
UPDATE hc_campaigns c
SET collected_amount = (
  SELECT COALESCE(SUM(p.amount_paid), 0)
  FROM hopecard_purchases p
  WHERE p.hopecard_id = c.id
    AND p.status = 'paid'
);
