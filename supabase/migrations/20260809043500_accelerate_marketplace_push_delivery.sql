-- Provider offer leases can expire in ~45 seconds; minute-level delivery is too slow.
-- pg_cron 1.6 supports second-based schedules.
select cron.alter_job(job_id:=3,schedule:='10 seconds');
