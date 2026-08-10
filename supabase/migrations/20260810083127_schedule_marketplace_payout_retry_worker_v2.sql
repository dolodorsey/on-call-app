do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='marketplace-payout-retry' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'marketplace-payout-retry',
    '* * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='marketplace_project_url' limit 1) || '/functions/v1/marketplace-payout-retry',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='payout_retry_worker_token' limit 1)
      ),
      body := jsonb_build_object('source','pg_cron','requested_at',now()),
      timeout_milliseconds := 45000
    );
    $job$
  );
end $$;
