-- Manual payment entry: record a membership payment that happened outside the
-- app's own checkout (an official Stripe link, a Payment Link) so the member
-- actually gets their membership.
--
-- The webhook cannot do this on its own: process_stripe_event UPDATEs a
-- payments row matched by stripe_checkout_session_id, and an external payment
-- never had one inserted, so the update matches nothing and no membership is
-- created. This adds the missing entry point.

-- The membership period is derived from the plan's linked semester or academic
-- year. process_stripe_event owned that rule inline; both callers now share it
-- so a change to how periods are resolved cannot apply to only one of them.
create or replace function public.membership_plan_period(p_plan_id uuid)
returns table (starts_at date, ends_at date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    case when mp.kind = 'semester' then s.start_date else ay.start_date end,
    case when mp.kind = 'semester' then s.end_date else ay.end_date end
  from public.membership_plans mp
  left join public.semesters s on s.id = mp.semester_id
  left join public.academic_years ay on ay.id = mp.academic_year_id
  where mp.id = p_plan_id;
$$;

comment on function public.membership_plan_period(uuid) is
  'Start/end dates a membership on this plan should cover, from its semester or academic year.';

-- Unchanged except that the inline period lookup is now the shared function.
create or replace function public.process_stripe_event(
  p_event_id text,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted_id uuid;
  v_object jsonb;
  v_metadata jsonb;
  v_checkout_session_id text;
  v_payment_intent_id text;
  v_plan_id uuid;
  v_user_id uuid;
  v_payment_id uuid;
  v_existing_membership_id uuid;
  v_plan public.membership_plans%rowtype;
  v_period_start date;
  v_period_end date;
  v_new_membership_id uuid;
begin
  insert into public.stripe_events (stripe_event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (stripe_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Already processed this event id.
    return;
  end if;

  v_object := p_payload -> 'data' -> 'object';

  begin
    if p_type = 'checkout.session.completed' then
      v_checkout_session_id := v_object ->> 'id';
      v_payment_intent_id := v_object ->> 'payment_intent';
      v_metadata := v_object -> 'metadata';
      v_plan_id := nullif(v_metadata ->> 'plan_id', '')::uuid;

      update public.payments
      set status = 'succeeded',
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, v_payment_intent_id)
      where stripe_checkout_session_id = v_checkout_session_id
      returning id, membership_id into v_payment_id, v_existing_membership_id;

      if v_payment_id is not null and v_existing_membership_id is null and v_plan_id is not null then
        select * into v_plan from public.membership_plans where id = v_plan_id;

        if found then
          select mpp.starts_at, mpp.ends_at into v_period_start, v_period_end
          from public.membership_plan_period(v_plan.id) mpp;

          if v_period_start is not null and v_period_end is not null then
            insert into public.memberships (user_id, plan_id, status, starts_at, ends_at, payment_id)
            select p.user_id, v_plan.id, 'active', v_period_start, v_period_end, p.id
            from public.payments p
            where p.id = v_payment_id
            returning id into v_new_membership_id;

            update public.payments set membership_id = v_new_membership_id where id = v_payment_id;
          end if;
        end if;
      end if;

    elsif p_type = 'checkout.session.expired' then
      v_checkout_session_id := v_object ->> 'id';

      update public.payments
      set status = 'failed'
      where stripe_checkout_session_id = v_checkout_session_id
        and status = 'pending';

    elsif p_type = 'payment_intent.payment_failed' then
      v_payment_intent_id := v_object ->> 'id';
      v_metadata := v_object -> 'metadata';
      v_user_id := nullif(v_metadata ->> 'user_id', '')::uuid;
      v_plan_id := nullif(v_metadata ->> 'plan_id', '')::uuid;

      update public.payments
      set status = 'failed',
          stripe_payment_intent_id = coalesce(stripe_payment_intent_id, v_payment_intent_id)
      where user_id = v_user_id
        and plan_id = v_plan_id
        and status = 'pending';

    elsif p_type = 'charge.refunded' then
      -- Refund policy: let the paid period run out rather than revoking
      -- membership immediately (plan doc Section 11, confirmed decision).
      -- Only the payment's own status changes here.
      v_payment_intent_id := v_object ->> 'payment_intent';
      update public.payments
      set status = 'refunded'
      where stripe_payment_intent_id = v_payment_intent_id;

    elsif p_type = 'payment_intent.succeeded' then
      -- Secondary confirmation only; checkout.session.completed is the
      -- primary trigger and already marks the payment succeeded. No-op here,
      -- kept purely for the stripe_events audit trail.
      null;
    end if;

    update public.stripe_events
    set status = 'processed', processed_at = now()
    where id = v_inserted_id;
  exception when others then
    update public.stripe_events
    set status = 'failed', error = sqlerrm, processed_at = now()
    where id = v_inserted_id;
  end;
end;
$function$;

-- Records an already-collected payment and the membership it buys, in one
-- transaction, landing in the same state the webhook would have produced.
-- Raises on every rejection so the caller gets a message rather than a silent
-- no-op; the unique indexes on the Stripe ids are the last line of defence
-- against the same payment being entered twice.
create or replace function public.record_manual_payment(
  p_user_id uuid,
  p_plan_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period_start date;
  v_period_end date;
  v_payment_id uuid;
  v_membership_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  if coalesce(trim(p_stripe_checkout_session_id), '') = ''
     and coalesce(trim(p_stripe_payment_intent_id), '') = '' then
    raise exception 'A Stripe checkout session id or payment intent id is required.';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'That member no longer exists.';
  end if;

  -- Refuse rather than extend or replace: overlapping memberships are a
  -- reconciliation problem, and the operator should decide what to do.
  if exists (
    select 1 from public.memberships m
    where m.user_id = p_user_id
      and m.status = 'active'
      and m.ends_at >= current_date
  ) then
    raise exception 'That member already has an active membership.';
  end if;

  select mpp.starts_at, mpp.ends_at into v_period_start, v_period_end
  from public.membership_plan_period(p_plan_id) mpp;

  if v_period_start is null or v_period_end is null then
    raise exception 'That plan has no semester or academic year attached, so its membership period is unknown.';
  end if;

  insert into public.payments (
    user_id, plan_id, status, payment_type, amount, currency,
    stripe_checkout_session_id, stripe_payment_intent_id, created_by, updated_by
  )
  select p_user_id, p_plan_id, 'succeeded', mp.kind, p_amount_cents,
         coalesce(nullif(trim(p_currency), ''), 'usd'),
         nullif(trim(p_stripe_checkout_session_id), ''),
         nullif(trim(p_stripe_payment_intent_id), ''),
         p_actor_id, p_actor_id
  from public.membership_plans mp
  where mp.id = p_plan_id
  returning id into v_payment_id;

  if v_payment_id is null then
    raise exception 'That membership plan does not exist.';
  end if;

  insert into public.memberships (user_id, plan_id, status, starts_at, ends_at, payment_id)
  values (p_user_id, p_plan_id, 'active', v_period_start, v_period_end, v_payment_id)
  returning id into v_membership_id;

  update public.payments set membership_id = v_membership_id where id = v_payment_id;

  return v_payment_id;
end;
$$;

comment on function public.record_manual_payment(uuid, uuid, bigint, text, text, text, uuid) is
  'Records a membership payment collected outside the app checkout, plus the membership it buys. Gated in the app by manage_payments.';

revoke all on function public.record_manual_payment(uuid, uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
