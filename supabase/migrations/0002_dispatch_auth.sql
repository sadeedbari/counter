-- The send-messages Edge Function keeps "Verify JWT" on, so the trigger authenticates with the
-- project's publishable (anon) key. That key is public by design; the function only accepts a
-- message id and only sends rows that are still 'queued'.
create or replace function dispatch_message() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://ujlcxbqeywhuiulidfdr.supabase.co/functions/v1/send-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Hhzb_AztAl_6LC9c2aSLqw_g5lz1vwO',
      'apikey', 'sb_publishable_Hhzb_AztAl_6LC9c2aSLqw_g5lz1vwO'
    ),
    body := jsonb_build_object('id', new.id)
  );
  return new;
end $$;
