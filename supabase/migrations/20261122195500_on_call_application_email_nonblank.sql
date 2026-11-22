-- Draft ON CALL guard: reject empty and whitespace-only provider application email.
-- Keep this in the existing review PR; do not deploy without independent review
-- and exact release approval. The NOT VALID add is enforced for new writes, then
-- validation checks existing rows without rewriting them.
ALTER TABLE public.oc_provider_applications
  ADD CONSTRAINT oc_provider_applications_email_nonblank
  CHECK (replace(email, chr(65279), '') ~ '[^[:space:]]') NOT VALID;

ALTER TABLE public.oc_provider_applications
  VALIDATE CONSTRAINT oc_provider_applications_email_nonblank;
