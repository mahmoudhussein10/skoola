-- Run this once in Supabase SQL Editor after creating this Vault secret:
--   skoola_cron_secret = the same value as CRON_SECRET in Vercel

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'skoola-subscription-lifecycle';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'skoola-subscription-lifecycle',
  '0 * * * *',
  $job$
    select net.http_post(
      url := 'https://scoolla.com/api/cron/subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'skoola_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron', 'requested_at', now()),
      timeout_milliseconds := 60000
    ) as request_id;
  $job$
);
