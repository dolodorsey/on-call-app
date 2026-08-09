create or replace function public.oc_provider_command_snapshot()
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare
 v_provider public.oc_provider_profiles%rowtype; v_user public.oc_users%rowtype;
 v_service_count integer:=0; v_ready_service_count integer:=0; v_offer_count integer:=0; v_active_jobs integer:=0; v_completed_jobs integer:=0;
 v_today numeric:=0; v_week numeric:=0; v_total numeric:=0; v_pending numeric:=0; v_last_location jsonb:=null;
 v_license_required boolean:=false; v_insurance_required boolean:=false; v_required_checks integer:=0; v_passed_checks integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select u.* into v_user from public.oc_users u where u.auth_id=auth.uid() limit 1;
 if not found or v_user.role<>'provider' or v_user.status<>'active' then raise exception 'ON CALL provider account required' using errcode='42501'; end if;
 select * into v_provider from public.oc_provider_profiles where user_id=v_user.id limit 1; if not found then raise exception 'Provider profile not found' using errcode='P0002'; end if;
 select count(*) into v_service_count from public.oc_provider_services where provider_id=v_provider.id and is_active;
 select count(*) into v_ready_service_count from public.oc_provider_services ps where ps.provider_id=v_provider.id and ps.is_active and private.oc_provider_service_dispatch_ready(v_provider.id,ps.service_id);
 select coalesce(bool_or(s.requires_license),false),coalesce(bool_or(s.requires_insurance),false) into v_license_required,v_insurance_required from public.oc_provider_services ps join public.oc_service_catalog s on s.id=ps.service_id where ps.provider_id=v_provider.id and ps.is_active;
 if v_provider.provider_application_id is not null then select count(*) filter(where required),count(*) filter(where required and status in ('passed','waived')) into v_required_checks,v_passed_checks from public.oc_provider_verification_checks where application_id=v_provider.provider_application_id; end if;
 select count(*) into v_active_jobs from public.oc_bookings where provider_id=v_provider.id and status in ('assigned','en_route','on_site','working');
 select count(*) into v_completed_jobs from public.oc_bookings where provider_id=v_provider.id and status='completed';
 if v_provider.is_available and private.oc_provider_core_dispatch_ready(v_provider.id) then select count(*) into v_offer_count from public.oc_booking_offers o join public.oc_bookings b on b.id=o.booking_id where o.provider_id=v_provider.id and o.status='pending' and o.expires_at>now() and b.provider_id is null and b.status in ('pending','matching') and private.oc_provider_service_dispatch_ready(v_provider.id,b.service_id); end if;
 select coalesce(sum(case when p.status='transferred' and coalesce(p.transferred_at,p.created_at)>=date_trunc('day',now()) then p.provider_amount else 0 end),0)/100.0,coalesce(sum(case when p.status='transferred' and coalesce(p.transferred_at,p.created_at)>=date_trunc('week',now()) then p.provider_amount else 0 end),0)/100.0,coalesce(sum(case when p.status='transferred' then p.provider_amount else 0 end),0)/100.0,coalesce(sum(case when p.status in ('authorized','capture_pending','transfer_pending','captured') then p.provider_amount else 0 end),0)/100.0 into v_today,v_week,v_total,v_pending from public.oc_booking_payments p where p.provider_id=v_provider.id;
 select jsonb_build_object('lat',l.lat,'lng',l.lng,'accuracy_meters',l.accuracy_meters,'updated_at',l.updated_at) into v_last_location from public.oc_provider_locations l where l.provider_id=v_provider.id order by l.updated_at desc nulls last,l.id desc limit 1;
 return jsonb_build_object(
  'user',jsonb_build_object('id',v_user.id,'name',coalesce(v_user.full_name,trim(concat(v_user.first_name,' ',v_user.last_name))),'email',v_user.email,'phone',v_user.phone,'city',v_user.city,'state',coalesce(v_user.state_code,v_user.state)),
  'provider',jsonb_build_object('id',v_provider.id,'application_id',v_provider.provider_application_id,'available',v_provider.is_available,'approval_status',v_provider.approval_status,'background_check_status',v_provider.background_check_status,'rating',v_provider.rating,'total_jobs',greatest(v_provider.total_jobs,v_completed_jobs),'service_area_radius',v_provider.service_area_radius,'stripe_onboarding_complete',v_provider.stripe_onboarding_complete,'stripe_payouts_enabled',v_provider.stripe_payouts_enabled,'identity_verified',v_provider.identity_verified,'license_verified',v_provider.license_verified,'insurance_verified',v_provider.insurance_verified,'service_area_verified',v_provider.service_area_verified,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_provider.id),'license_required',v_license_required,'insurance_required',v_insurance_required,'verification_required_checks',v_required_checks,'verification_passed_checks',v_passed_checks),
  'counts',jsonb_build_object('services',v_service_count,'dispatch_ready_services',v_ready_service_count,'opportunities',v_offer_count,'active_jobs',v_active_jobs,'completed_jobs',v_completed_jobs),
  'earnings',jsonb_build_object('today',v_today,'week',v_week,'total',v_total,'pending',v_pending),'location',v_last_location);
end;$$;
