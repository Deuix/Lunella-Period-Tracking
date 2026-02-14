create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'send-cycle-support-notifications-hourly'
  ) then
    perform cron.unschedule('send-cycle-support-notifications-hourly');
  end if;
end
$$;

select cron.schedule(
  'send-cycle-support-notifications-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://mbfhuzpznwjtlbrewhtv.supabase.co/functions/v1/send-cycle-support-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
