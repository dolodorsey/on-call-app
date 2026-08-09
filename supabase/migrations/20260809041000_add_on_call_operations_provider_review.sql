create schema if not exists private;

create table if not exists private.marketplace_operators(
  auth_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.marketplace_operators(auth_id,email,display_name)
select id,lower(email),'Marketplace Owner'
from auth.users
where lower(email)='thedoctordorsey@gmail.com'
on conflict(auth_id) do update set email=excluded.email,is_active=true,updated_at=now();

alter table public.oc_provider_applications add column if not exists reviewed_at timestamptz;
alter table public.oc_provider_applications add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.oc_provider_applications add column if not exists review_notes text;

create or replace function private.is_marketplace_operator(p_auth_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path to 'pg_catalog','private'
as $$select exists(select 1 from private.marketplace_operators o where o.auth_id=p_auth_id and o.is_active);$$;

create or replace function public.oc_ops_provider_applications(p_status text default null)
returns table(id uuid,application_number text,first_name text,last_name text,email text,phone text,city text,state_code text,zip_code text,services_requested text[],years_experience integer,experience_description text,has_vehicle boolean,vehicle_type text,status text,created_at timestamptz,updated_at timestamptz,reviewed_at timestamptz,review_notes text)
language sql security definer set search_path to 'pg_catalog','public','private'
as $$select a.id,a.application_number,a.first_name,a.last_name,a.email,a.phone,a.city,a.state_code,a.zip_code,a.services_requested,a.years_experience,a.experience_description,a.has_vehicle,a.vehicle_type,a.status,a.created_at,a.updated_at,a.reviewed_at,a.review_notes from public.oc_provider_applications a where private.is_marketplace_operator(auth.uid()) and (p_status is null or a.status=p_status) order by case a.status when 'submitted' then 0 when 'reviewing' then 1 when 'approved' then 2 else 3 end,a.created_at asc;$$;

create or replace function public.oc_ops_review_provider_application(p_application_id uuid,p_status text,p_notes text default null)
returns public.oc_provider_applications language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_app public.oc_provider_applications%rowtype; v_user uuid; begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('reviewing','approved','rejected') then raise exception 'Invalid review status'; end if;
 update public.oc_provider_applications set status=p_status,reviewed_at=case when p_status in ('approved','rejected') then now() else reviewed_at end,reviewed_by=auth.uid(),review_notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),updated_at=now() where id=p_application_id returning * into v_app;
 if not found then raise exception 'Application not found' using errcode='P0002'; end if;
 select u.id into v_user from public.oc_users u where lower(u.email)=lower(v_app.email) order by u.created_at desc limit 1;
 if v_user is not null and p_status in ('approved','rejected') then insert into public.oc_notifications(user_id,type,title,body,action_url,metadata,channel) values(v_user,'provider_application_'||p_status,case when p_status='approved' then 'Your ON CALL provider application is approved' else 'ON CALL provider application update' end,case when p_status='approved' then 'Open Provider Command with this same email to activate your approved provider profile.' else coalesce(nullif(trim(p_notes),''),'Your provider application was not approved at this time.') end,'/provider',jsonb_build_object('application_id',v_app.id,'application_number',v_app.application_number,'status',p_status),'push'); end if;
 return v_app;
end;$$;

revoke all on private.marketplace_operators from public,anon,authenticated;
revoke all on function private.is_marketplace_operator(uuid) from public,anon,authenticated;
grant execute on function public.oc_ops_provider_applications(text) to authenticated;
grant execute on function public.oc_ops_review_provider_application(uuid,text,text) to authenticated;
revoke execute on function public.oc_ops_provider_applications(text) from public,anon;
revoke execute on function public.oc_ops_review_provider_application(uuid,text,text) from public,anon;
