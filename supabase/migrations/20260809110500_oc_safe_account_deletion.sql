create or replace function public.oc_anonymize_account(p_auth_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_user_id uuid;
  v_provider_id uuid;
  v_email text;
  v_booking_count integer := 0;
begin
  select id,email into v_user_id,v_email from public.oc_users where auth_id=p_auth_id for update;
  if v_user_id is null then return jsonb_build_object('ok',true,'found',false,'auth_id',p_auth_id); end if;
  select id into v_provider_id from public.oc_provider_profiles where user_id=v_user_id for update;

  update public.oc_bookings
  set status=case when status in ('completed','canceled','cancelled') then status else 'canceled' end,
      cancelled_at=case when status in ('completed','canceled','cancelled') then cancelled_at else coalesce(cancelled_at,now()) end,
      canceled_at=case when status in ('completed','canceled','cancelled') then canceled_at else coalesce(canceled_at,now()) end,
      cancellation_reason=case when status in ('completed','canceled','cancelled') then cancellation_reason else 'account_deleted' end,
      service_address=null,service_city=null,service_state=null,service_zip=null,service_lat=null,service_lng=null,
      address=null,lat=null,lng=null,service_notes=null,access_instructions=null,before_photos=null,after_photos=null,
      notes=null,customer_notes=null,updated_at=now()
  where customer_id=v_user_id or (v_provider_id is not null and provider_id=v_provider_id);
  get diagnostics v_booking_count=row_count;

  update public.oc_booking_events e set lat=null,lng=null,metadata='{}'::jsonb
  where exists(select 1 from public.oc_bookings b where b.id=e.booking_id and (b.customer_id=v_user_id or (v_provider_id is not null and b.provider_id=v_provider_id)));

  update public.oc_disputes d set description=null,evidence_urls=null,internal_notes=null,
    resolution=case when status='open' then coalesce(resolution,'Account holder deleted profile; preserve financial review only.') else resolution end,updated_at=now()
  where filed_by=v_user_id or resolved_by=v_user_id or exists(select 1 from public.oc_bookings b where b.id=d.booking_id and (b.customer_id=v_user_id or (v_provider_id is not null and b.provider_id=v_provider_id)));

  update public.oc_incident_reports i set description=null,location_address=null,photos=null
  where customer_id=v_user_id or (v_provider_id is not null and provider_id=v_provider_id)
     or exists(select 1 from public.oc_bookings b where b.id=i.booking_id and (b.customer_id=v_user_id or (v_provider_id is not null and b.provider_id=v_provider_id)));

  update public.oc_provider_reviews set review_text=null,provider_response=null,is_featured=false
  where customer_id=v_user_id or (v_provider_id is not null and provider_id=v_provider_id);

  delete from public.oc_notifications where user_id=v_user_id;
  delete from public.oc_saved_addresses where user_id=v_user_id;
  delete from public.oc_customer_payment_methods where user_id=v_user_id;
  delete from public.marketplace_push_subscriptions where auth_id=p_auth_id and app='on_call';
  update public.oc_recurring_schedules set status='canceled',service_address=null,service_city=null,notes=null
  where customer_id=v_user_id or (v_provider_id is not null and provider_id=v_provider_id);

  if v_provider_id is not null then
    delete from public.oc_provider_locations where provider_id=v_provider_id;
    delete from public.oc_provider_portfolio where provider_id=v_provider_id;
    delete from public.oc_provider_equipment where provider_id=v_provider_id;
    update public.oc_provider_certifications set cert_number=null,document_url=null,verified_by=null,verified_at=null,status='withdrawn' where provider_id=v_provider_id;
    update public.oc_provider_profiles set skills='{}'::text[],is_available=false,background_check_status='withdrawn',approval_status='deactivated',
      identity_verified=false,license_verified=false,insurance_verified=false,service_area_verified=false,vehicle_type=null,vehicle_info='{}'::jsonb,
      stripe_charges_enabled=false,stripe_payouts_enabled=false,stripe_onboarding_complete=false,deactivated_at=coalesce(deactivated_at,now()),updated_at=now()
    where id=v_provider_id;
  end if;

  update public.oc_users set auth_id=null,first_name='Deleted',last_name='Account',full_name='Deleted account',email=null,phone=null,phone_verified=false,
    avatar_url=null,address=null,city=null,state=null,state_code=null,zip_code=null,lat=null,lng=null,date_of_birth=null,status='deleted',stripe_customer_id=null,
    referral_code='deleted_'||replace(id::text,'-',''),referred_by=null,preferred_payment=null,
    notification_prefs='{"sms":false,"push":false,"email":false}'::jsonb,last_active_at=null,updated_at=now()
  where id=v_user_id;

  return jsonb_build_object('ok',true,'found',true,'oc_user_id',v_user_id,'provider_id',v_provider_id,'bookings_anonymized',v_booking_count,'profile_anonymized',true);
end;
$$;
revoke all on function public.oc_anonymize_account(uuid) from public,anon,authenticated;
grant execute on function public.oc_anonymize_account(uuid) to service_role;
