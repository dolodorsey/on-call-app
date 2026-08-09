alter table public.oc_provider_applications
  add column if not exists license_attested boolean not null default false,
  add column if not exists insurance_attested boolean not null default false,
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists certifications text,
  add column if not exists license_details text,
  add column if not exists insurance_details text;

alter table public.oc_provider_applications
  drop constraint if exists oc_provider_applications_certifications_length,
  add constraint oc_provider_applications_certifications_length check(certifications is null or char_length(certifications)<=2000),
  drop constraint if exists oc_provider_applications_license_details_length,
  add constraint oc_provider_applications_license_details_length check(license_details is null or char_length(license_details)<=2000),
  drop constraint if exists oc_provider_applications_insurance_details_length,
  add constraint oc_provider_applications_insurance_details_length check(insurance_details is null or char_length(insurance_details)<=2000);

create or replace function public.oc_ops_review_provider_application(p_application_id uuid,p_status text,p_notes text default null)
returns public.oc_provider_applications language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_app public.oc_provider_applications%rowtype;v_user uuid;
begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501';end if;
 if p_status not in ('reviewing','approved','rejected') then raise exception 'Invalid review status';end if;
 select * into v_app from public.oc_provider_applications where id=p_application_id for update;if not found then raise exception 'Application not found' using errcode='P0002';end if;
 if p_status='approved' and not(v_app.background_check_consent and v_app.license_attested and v_app.insurance_attested and v_app.terms_accepted) then raise exception 'Provider attestations and consent are incomplete. Approval is blocked.' using errcode='23514';end if;
 update public.oc_provider_applications set status=p_status,reviewed_at=case when p_status in ('approved','rejected') then now() else reviewed_at end,reviewed_by=auth.uid(),review_notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),updated_at=now() where id=p_application_id returning * into v_app;
 select u.id into v_user from public.oc_users u where lower(u.email)=lower(v_app.email) order by u.created_at desc limit 1;
 if v_user is not null and p_status in ('approved','rejected') then insert into public.oc_notifications(user_id,type,title,body,action_url,metadata,channel) values(v_user,'provider_application_'||p_status,case when p_status='approved' then 'Your ON CALL provider application is approved' else 'ON CALL provider application update' end,case when p_status='approved' then 'Open Provider Command with this same email to activate your approved provider profile. Verification and payout readiness are still required before accepting work.' else coalesce(nullif(trim(p_notes),''),'Your provider application was not approved at this time.') end,'/provider',jsonb_build_object('application_id',v_app.id,'application_number',v_app.application_number,'status',p_status),'push');end if;
 return v_app;
end;$$;