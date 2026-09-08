-- Fix: payment_intent.payment_failed can never fire alongside
-- checkout.session.completed (the session never completes on failure), so
-- payments.stripe_payment_intent_id is never backfilled by the time this
-- event arrives - matching on it (the original implementation) always
-- missed. Match on metadata.user_id + metadata.plan_id instead, which the
-- checkout-creation action now sets explicitly via payment_intent_data
-- (Checkout Session metadata is not copied to the PaymentIntent
-- automatically - confirmed empirically, not just from docs).
create or replace function public.process_stripe_event(
  p_event_id text,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
          insert into public.memberships (user_id, plan_id, status, starts_at, ends_at, payment_id)
          select p.user_id, v_plan.id, 'active', v_plan.starts_at, v_plan.ends_at, p.id
          from public.payments p
          where p.id = v_payment_id
          returning id into v_new_membership_id;

          update public.payments set membership_id = v_new_membership_id where id = v_payment_id;
        end if;
      end if;

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
$$;

comment on function public.process_stripe_event(text, text, jsonb) is
  'Webhook dispatch for membership Stripe events. Idempotent on stripe_events.stripe_event_id. Call only via the service-role client.';
