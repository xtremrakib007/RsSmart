-- Backfill only system-managed manager roles. Preserve every existing grant and
-- add the security permissions introduced by the security review.
UPDATE "roles" AS r
SET "permissions" = (
  SELECT COALESCE(jsonb_agg(DISTINCT grant_value), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(r."permissions") = 'array' THEN r."permissions"
      ELSE '[]'::jsonb
    END || '["payments.collect", "payments.refund", "outlets.read"]'::jsonb
  ) AS grants(grant_value)
)
WHERE r."is_system" = TRUE
  AND r."name" = 'manager';
