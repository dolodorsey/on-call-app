-- Make provider activation reconciliation safe for both INSERT and UPDATE triggers.
create or replace function public.oc_reconcile_provider_activation()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_has_service boolean;
  v_ready boolean;
begin
  select exists(
    select 1 from public.oc_provider_services ps
    where ps.provider_id=new.id and ps.is_active
  ) into v_has_service;

  v_ready:=
    new.background_check_status='passed'
    and new.identity_verified
    and new.insurance_verified
    and new.service_area_verified
    and new.stripe_onboarding_complete
    and new.stripe_charges_enabled
    and new.stripe_payouts_enabled
    and v_has_service;

  if new.approval_status in ('suspended','rejected') then
    new.is_available:=false;
    new.deactivated_at:=coalesce(new.deactivated_at,now());
  elsif v_ready then
    new.approval_status:='active';
    new.activated_at:=coalesce(new.activated_at,now());
    new.deactivated_at:=null;
  else
    if new.approval_status not in ('pending','verification') then
      new.approval_status:='approved';
    end if;
    new.is_available:=false;
    if tg_op='UPDATE' and old.approval_status='active' then
      new.deactivated_at:=now();
    end if;
    new.activated_at:=null;
  end if;
  return new;
end;
$function$;
