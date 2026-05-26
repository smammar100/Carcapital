-- 0016 — Unique vendor name per company (case-insensitive).
--
-- Follow-up F-D4 from Module D UAT: the inline "Add new vendor" dialog
-- could happily insert "Ali's Garage" twice for the same company. This
-- index makes the DB the authority and lets the service surface a
-- friendly "vendor already exists" error.
--
-- Safe on prod: pre-migration probe confirmed zero existing duplicates
-- across the live `Carcapital` project, so the dedup step is a no-op.
-- The dedup CTE is still included so this migration is idempotent on
-- any future dataset (collapses everything but the oldest row per name
-- by suffixing the newer rows with their short id).
--
-- Idempotent: index uses IF NOT EXISTS; the dedup UPDATE has a
-- WHERE-clause that excludes already-suffixed rows.

BEGIN;

-- Step 1 — dedup pre-existing rows (no-op on live today, defensive for
-- future replays). We tag duplicates by suffixing " (#xxxxxxxx)" so
-- the unique index in Step 2 can land cleanly.
WITH ranked AS (
  SELECT
    id,
    company_id,
    lower(name) AS lname,
    row_number() OVER (
      PARTITION BY company_id, lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM vendors
)
UPDATE vendors v
   SET name = v.name || ' (#' || substr(v.id::text, 1, 8) || ')'
  FROM ranked r
 WHERE v.id = r.id
   AND r.rn > 1
   AND v.name NOT LIKE '% (#%)';

-- Step 2 — unique (company_id, lower(name)).
CREATE UNIQUE INDEX IF NOT EXISTS vendors_unique_name_per_company
ON vendors (company_id, lower(name));

COMMIT;
