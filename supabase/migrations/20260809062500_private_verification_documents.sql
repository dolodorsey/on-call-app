insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('marketplace-verification','marketplace-verification',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types,updated_at=now();

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='marketplace verification own upload') then
  create policy "marketplace verification own upload" on storage.objects for insert to authenticated
  with check(bucket_id='marketplace-verification' and (storage.foldername(name))[2]=auth.uid()::text and (storage.foldername(name))[1] in ('on_call','sos'));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='marketplace verification own or operator read') then
  create policy "marketplace verification own or operator read" on storage.objects for select to authenticated
  using(bucket_id='marketplace-verification' and ((storage.foldername(name))[2]=auth.uid()::text or public.marketplace_operator_check()));
 end if;
end $$;

create or replace function public.oc_provider_submit_verification_evidence(p_check_type text,p_path text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','storage' as $$
declare v_provider public.oc_provider_profiles%rowtype; v_app_id uuid; v_check public.oc_provider_verification_checks%rowtype; v_prefix text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.* into v_provider from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' limit 1;
 if not found or v_provider.provider_application_id is null then raise exception 'Active ON CALL provider application required' using errcode='42501'; end if;
 v_app_id:=v_provider.provider_application_id;
 select * into v_check from public.oc_provider_verification_checks where application_id=v_app_id and check_type=p_check_type; if not found then raise exception 'Verification check not found'; end if;
 v_prefix:='on_call/'||auth.uid()::text||'/'||v_app_id::text||'/'||p_check_type||'/';
 if p_path is null or p_path not like v_prefix||'%' or position('..' in p_path)>0 then raise exception 'Invalid verification evidence path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded verification file not found'; end if;
 update public.oc_provider_verification_checks set evidence_urls=case when p_path=any(evidence_urls) then evidence_urls else array_append(evidence_urls,p_path) end,status=case when status='passed' then status else 'submitted' end,updated_at=now() where application_id=v_app_id and check_type=p_check_type;
 return jsonb_build_object('application_id',v_app_id,'check_type',p_check_type,'status',case when v_check.status='passed' then 'passed' else 'submitted' end,'path',p_path);
end;$$;
revoke all on function public.oc_provider_submit_verification_evidence(text,text) from public,anon; grant execute on function public.oc_provider_submit_verification_evidence(text,text) to authenticated;

create or replace function public.oc_provider_verification_status()
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare v_provider public.oc_provider_profiles%rowtype; v_app public.oc_provider_applications%rowtype; v_checks jsonb:='[]'::jsonb; v_ready integer:=0; v_services integer:=0; v_license_required boolean:=false; v_insurance_required boolean:=false;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.* into v_provider from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' limit 1;
 if not found then return jsonb_build_object('state','not_provider'); end if;
 if v_provider.provider_application_id is not null then select * into v_app from public.oc_provider_applications where id=v_provider.provider_application_id; select coalesce(jsonb_agg(jsonb_build_object('check_type',v.check_type,'required',v.required,'status',v.status,'notes',v.notes,'reviewed_at',v.reviewed_at,'evidence_urls',v.evidence_urls) order by v.check_type),'[]'::jsonb) into v_checks from public.oc_provider_verification_checks v where v.application_id=v_provider.provider_application_id; end if;
 select count(*),count(*) filter(where private.oc_provider_service_dispatch_ready(v_provider.id,ps.service_id)),coalesce(bool_or(s.requires_license),false),coalesce(bool_or(s.requires_insurance),false) into v_services,v_ready,v_license_required,v_insurance_required from public.oc_provider_services ps join public.oc_service_catalog s on s.id=ps.service_id where ps.provider_id=v_provider.id and ps.is_active;
 return jsonb_build_object('state','provider','application_id',v_provider.provider_application_id,'application_number',v_app.application_number,'application_status',v_app.status,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_provider.id),'services',v_services,'dispatch_ready_services',v_ready,'license_required',v_license_required,'insurance_required',v_insurance_required,'stripe_onboarding_complete',v_provider.stripe_onboarding_complete,'stripe_payouts_enabled',v_provider.stripe_payouts_enabled,'checks',v_checks);
end;$$;
