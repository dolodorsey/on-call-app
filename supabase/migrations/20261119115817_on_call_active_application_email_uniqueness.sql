-- Draft migration for ON CALL active application deduplication.
-- Keep unmerged and unapplied until independent review and exact release approval.
-- Refuse to proceed if existing active duplicates need human reconciliation.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.oc_provider_applications
    WHERE status IN ('submitted', 'reviewing', 'approved')
      AND email IS NOT NULL
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Active ON CALL applications contain duplicate normalized emails; review records before applying uniqueness.'
      USING ERRCODE = '23514';
  END IF;
END
$migration$;

CREATE UNIQUE INDEX oc_provider_applications_active_email_unique
  ON public.oc_provider_applications (lower(trim(email)))
  WHERE status IN ('submitted', 'reviewing', 'approved');
