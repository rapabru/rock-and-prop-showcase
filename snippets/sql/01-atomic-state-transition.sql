-- Pattern: state changes go through one SECURITY DEFINER function,
-- never through an UPDATE policy.
--
-- There is deliberately no UPDATE policy on `offers`: a crafted API call
-- cannot flip a status, because the only way to change one is this
-- function, which re-checks ownership itself. Accepting an offer reserves
-- the listing and turns down every rival offer in the same transaction, so
-- there is no window where two offers are both accepted.
--
-- `set search_path = ''` + fully qualified names: a definer function must
-- not resolve objects through a search path the caller could influence.

create or replace function public.set_offer_status(
  p_offer_id uuid, p_new_status public.offer_status
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target_listing uuid;
begin
  if p_new_status = 'pending' then
    raise exception 'An offer cannot be moved back to pending';
  end if;

  -- Only a pending offer on a listing the caller owns.
  update public.offers o
  set status = p_new_status
  where o.id = p_offer_id
    and o.status = 'pending'
    and exists (
      select 1 from public.listings l
      where l.id = o.listing_id and l.owner_id = auth.uid()
    )
  returning o.listing_id into target_listing;

  if target_listing is null then
    raise exception 'No pending offer of yours with that id';
  end if;

  if p_new_status = 'accepted' then
    update public.listings set status = 'reserved'
    where id = target_listing and status = 'available';

    update public.offers set status = 'rejected'
    where listing_id = target_listing and id <> p_offer_id and status = 'pending';
  end if;
end;
$$;

-- Functions are executable by PUBLIC by default in Postgres. Take it back,
-- then grant only to signed-in users.
revoke execute on function public.set_offer_status(uuid, public.offer_status) from public, anon;
grant execute on function public.set_offer_status(uuid, public.offer_status) to authenticated;

-- And since the listing is now 'reserved', the INSERT policies on offers
-- and visits (which require status = 'available') refuse new ones on it.
