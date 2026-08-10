-- Preserve the original authorization amount while allowing cancellation/no-show
-- settlements to use the smaller active compensation split. The original split is
-- retained in original_* columns by the settlement code.

alter table public.oc_booking_payments drop constraint if exists oc_booking_payments_split_exact;
alter table public.oc_booking_payments add constraint oc_booking_payments_split_exact check (
  case
    when settlement_type in ('customer_cancellation','customer_no_show') then
      platform_fee + provider_amount = cancellation_fee_cents
    else
      platform_fee + provider_amount + tax_cents = amount_authorized
  end
);

alter table public.sos_payments drop constraint if exists sos_payments_amounts_nonnegative;
alter table public.sos_payments add constraint sos_payments_amounts_nonnegative check (
  amount > 0
  and coalesce(platform_fee,0) >= 0
  and coalesce(hero_payout,0) >= 0
  and coalesce(tip,0) >= 0
  and coalesce(tax,0) >= 0
  and coalesce(refund_amount,0) >= 0
  and (
    case
      when settlement_type in ('customer_cancellation','customer_no_show') then
        round(coalesce(platform_fee,0) + coalesce(hero_payout,0),2) = round(coalesce(cancellation_fee,0),2)
      else
        round(coalesce(platform_fee,0) + coalesce(hero_payout,0),2) = round(amount + coalesce(tip,0),2)
    end
  )
  and coalesce(refund_amount,0) <= amount + coalesce(tip,0) + coalesce(tax,0)
);
