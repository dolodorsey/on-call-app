-- Guard approved-application activation against disabled accounts and provider
-- lifecycle states. This migration is pending review; it has not been applied.
create or replace function public.oc_provider_activate_approved_application()
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare
 v_user public.oc_users%rowtype;
 v_app public.oc_provider_applications%rowtype;
 v_profile public.oc_provider_profiles%rowtype;
 v_provider_id uuid;
 v_bg text:='pending';
 v_identity boolean:=false;
 v_license boolean:=false;
 v_insurance boolean:=false;
 v_area boolean:=false;
 v_profile_exists boolean:=false;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.oc_users where auth_id=auth.uid() limit 1 for update;
 if not found then raise exception 'ON CALL account not found' using errcode='P0002'; end if;
 if v_user.status is distinct from 'active' then raise exception 'An active ON CALL account is required for provider activation' using errcode='42501'; end if;

 select * into v_app from public.oc_provider_applications where lower(email)=lower(coalesce(v_user.email,'')) order by created_at desc limit 1 for update;
 if not found then raise exception 'Submit a provider application first' using errcode='P0002'; end if;
 if v_app.status<>'approved' then return jsonb_build_object('activated',false,'application_number',v_app.application_number,'application_status',v_app.status); end if;

 select * into v_profile from public.oc_provider_profiles where user_id=v_user.id for update;
 v_profile_exists:=found;
 if v_profile_exists then
   if v_profile.approval_status in ('suspended','rejected','deactivated') then
     raise exception 'Provider profile requires authorized lifecycle review before activation' using errcode='42501';
   end if;
   -- A repeated portal/session call must not reset availability, profile facts,
   -- or service selections for a provider who is already active.
   if v_profile.approval_status='active' then
     return jsonb_build_object('activated',true,'provider_id',v_profile.id,'application_number',v_app.application_number,'application_status',v_app.status,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_profile.id),'dispatch_ready_services',(select count(*) from public.oc_provider_services ps where ps.provider_id=v_profile.id and ps.is_active and private.oc_provider_service_dispatch_ready(v_profile.id,ps.service_id)));
   end if;
 end if;

 perform private.oc_initialize_application_verification(v_app.id);
 select case when status in ('passed','waived') then 'passed' when status='failed' then 'failed' else 'pending' end into v_bg from public.oc_provider_verification_checks where application_id=v_app.id and check_type='background';
 select coalesce(bool_or(status in ('passed','waived')) filter(where check_type='identity'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='license'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='insurance'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='service_area'),false)
 into v_identity,v_license,v_insurance,v_area from public.oc_provider_verification_checks where application_id=v_app.id;
 update public.oc_users set role='provider',first_name=coalesce(nullif(v_app.first_name,''),first_name),last_name=coalesce(nullif(v_app.last_name,''),last_name),full_name=trim(concat(v_app.first_name,' ',v_app.last_name)),phone=coalesce(nullif(v_app.phone,''),phone),city=coalesce(nullif(v_app.city,''),city),state_code=coalesce(nullif(v_app.state_code,''),state_code),updated_at=now() where id=v_user.id;
 insert into public.oc_provider_profiles(user_id,provider_application_id,skills,service_area_radius,is_available,background_check_status,approval_status,identity_verified,license_verified,insurance_verified,service_area_verified,vehicle_type,activated_at,updated_at)
 values(v_user.id,v_app.id,coalesce(v_app.services_requested,'{}'::text[]),25,false,coalesce(v_bg,'pending'),'active',v_identity,v_license,v_insurance,v_area,v_app.vehicle_type,now(),now())
 on conflict(user_id) do update set provider_application_id=excluded.provider_application_id,skills=excluded.skills,background_check_status=excluded.background_check_status,approval_status='active',identity_verified=excluded.identity_verified,license_verified=excluded.license_verified,insurance_verified=excluded.insurance_verified,service_area_verified=excluded.service_area_verified,vehicle_type=coalesce(excluded.vehicle_type,public.oc_provider_profiles.vehicle_type),activated_at=coalesce(public.oc_provider_profiles.activated_at,now()),is_available=false,updated_at=now()
 where public.oc_provider_profiles.approval_status not in ('suspended','rejected','deactivated')
 returning id into v_provider_id;
 if v_provider_id is null then raise exception 'Provider profile requires authorized lifecycle review before activation' using errcode='42501'; end if;
 insert into public.oc_provider_services(provider_id,service_id,is_active)
 select v_provider_id,m.service_id,true from public.oc_application_service_matches m join public.oc_service_catalog c on c.id=m.service_id and c.is_active where m.application_id=v_app.id
 on conflict(provider_id,service_id) do nothing;
 return jsonb_build_object('activated',true,'provider_id',v_provider_id,'application_number',v_app.application_number,'application_status',v_app.status,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_provider_id),'dispatch_ready_services',(select count(*) from public.oc_provider_services ps where ps.provider_id=v_provider_id and ps.is_active and private.oc_provider_service_dispatch_ready(v_provider_id,ps.service_id)));
end;$$;

revoke all on function public.oc_provider_activate_approved_application() from public,anon;
grant execute on function public.oc_provider_activate_approved_application() to authenticated;
