-- Shared SOS / ON CALL marketplace infrastructure.
-- Notification inserts already invoke private.marketplace_kick_push_delivery(), so
-- this cron is only a reliability fallback. Reduce idle Edge Function churn and
-- bound pg_cron history growth.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'marketplace-push-delivery'),
  schedule := '*/5 * * * *'
);

select cron.schedule(
  'marketplace-cron-history-cleanup',
  '15 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

delete from cron.job_run_details
where end_time < now() - interval '7 days';
