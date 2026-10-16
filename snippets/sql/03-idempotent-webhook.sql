-- Pattern: the payment webhook is the only thing that can mark an order
-- paid, and it is safe to deliver twice.
--
-- Flow in the route handler (omitted): verify the provider's HMAC
-- signature -> re-fetch the payment from the provider's API (never trust
-- the body) -> call this function with the server-only service role.
--
-- * Idempotent on the provider's event id: a retried webhook is a no-op.
-- * An unknown order raises a distinct SQLSTATE (P0002, no_data_found), so
--   the handler answers 200 instead of 500 and the provider stops retrying
--   forever, while real failures still surface as errors.

create table public.payment_events (
  provider_event_id text primary key,
  order_id uuid not null references public.orders(id),
  received_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;  -- no policies: server only

create or replace function public.record_payment(p_event_id text, p_order_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Unknown order %', p_order_id using errcode = 'P0002';
  end if;

  insert into public.payment_events (provider_event_id, order_id)
  values (p_event_id, p_order_id)
  on conflict (provider_event_id) do nothing;
  if not found then
    return;  -- already processed
  end if;

  update public.orders
  set status = 'paid', paid_amount = p_amount, paid_at = now()
  where id = p_order_id and status <> 'paid';
end;
$$;

revoke execute on function public.record_payment(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.record_payment(text, uuid, numeric) to service_role;
