-- Pattern: rate limiting enforced by Row-Level Security itself.
--
-- Every write is already scoped to the caller's own id by policy, but a
-- script holding one valid session could still file a thousand offers and
-- bury an agent in them. The cap lives where every other rule lives: in
-- the INSERT policy.
--
-- Postgres refuses a policy that queries its own table inline (infinite
-- recursion), so the counting moves into a STABLE definer function. It only
-- ever counts the caller's own rows and returns a number — it cannot be used
-- to read anyone else's data.

create or replace function public.recent_submissions(p_kind text)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  n integer;
begin
  case p_kind
    when 'offers' then
      select count(*) into n from public.offers
      where user_id = auth.uid() and created_at > now() - interval '1 hour';
    when 'messages' then
      select count(*) into n from public.messages
      where sender_id = auth.uid() and created_at > now() - interval '1 hour';
    else
      raise exception 'Unknown kind: %', p_kind;
  end case;
  return n;
end;
$$;

revoke execute on function public.recent_submissions(text) from public, anon;
grant execute on function public.recent_submissions(text) to authenticated;

create policy "a user may make an offer on an available listing"
  on public.offers for insert to authenticated with check (
    user_id = (select auth.uid())          -- only as yourself
    and exists (                           -- only on something for sale
      select 1 from public.listings
      where id = listing_id and status = 'available'
    )
    and public.recent_submissions('offers') < 10   -- and not too many
  );
