create schema private;create schema auth;create table auth.users(id uuid primary key);create sequence oc_provider_application_number_seq;create table oc_service_categories(id text primary key);create table public.marketplace_operator_alerts("id" uuid default gen_random_uuid() not null,"product_key" text not null,"alert_type" text not null,"entity_id" uuid,"title" text not null,"body" text,"metadata" jsonb default '{}'::jsonb not null,"created_at" timestamp with time zone default now() not null);create table public.oc_application_service_matches("application_id" uuid not null,"service_id" text not null,"match_method" text not null,"approved" boolean default false not null,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);create table public.oc_provider_applications("id" uuid default gen_random_uuid() not null,"application_number" text default ((('OC-'::text || to_char(now(), 'YYYYMMDD'::text)) || '-'::text) || lpad((nextval('oc_provider_application_number_seq'::regclass))::text, 6, '0'::text)) not null,"first_name" text not null,"last_name" text not null,"email" text not null,"phone" text not null,"city" text not null,"state_code" text not null,"zip_code" text,"services_requested" text[] not null,"years_experience" integer not null,"experience_description" text,"has_vehicle" boolean default false not null,"vehicle_type" text,"background_check_consent" boolean not null,"status" text default 'submitted'::text not null,"source_ip_hash" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"reviewed_at" timestamp with time zone,"reviewed_by" uuid,"review_notes" text,"license_attested" boolean default false not null,"insurance_attested" boolean default false not null,"terms_accepted" boolean default false not null,"certifications" text,"license_details" text,"insurance_details" text,"status_token_hash" text);create table public.oc_provider_verification_checks("application_id" uuid not null,"check_type" text not null,"required" boolean default true not null,"status" text default 'pending'::text not null,"evidence_urls" text[] default '{}'::text[] not null,"expires_at" timestamp with time zone,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"notes" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);create table public.oc_service_catalog("id" text not null,"category_id" text not null,"name" text not null,"description" text,"base_price" numeric(10,2) not null,"pricing_unit" text default 'starting'::text not null,"duration_minutes" integer,"on_demand_available" boolean default false not null,"scheduled_available" boolean default true not null,"recurring_available" boolean default false not null,"icon_key" text,"image_url" text,"tags" text[] default '{}'::text[] not null,"sort_order" integer default 0 not null,"is_active" boolean default true not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"requires_license" boolean default false not null,"requires_insurance" boolean default false not null);alter table public.oc_service_catalog add constraint oc_service_catalog_base_price_check CHECK ((base_price >= (0)::numeric));alter table public.oc_service_catalog add constraint oc_service_catalog_name_key UNIQUE (name);alter table public.oc_service_catalog add constraint oc_service_catalog_pkey PRIMARY KEY (id);alter table public.oc_provider_applications add constraint oc_provider_applications_application_number_key UNIQUE (application_number);alter table public.oc_provider_applications add constraint oc_provider_applications_certifications_length CHECK (((certifications IS NULL) OR (char_length(certifications) <= 2000)));alter table public.oc_provider_applications add constraint oc_provider_applications_insurance_details_length CHECK (((insurance_details IS NULL) OR (char_length(insurance_details) <= 2000)));alter table public.oc_provider_applications add constraint oc_provider_applications_license_details_length CHECK (((license_details IS NULL) OR (char_length(license_details) <= 2000)));alter table public.oc_provider_applications add constraint oc_provider_applications_pkey PRIMARY KEY (id);alter table public.oc_provider_applications add constraint oc_provider_applications_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text])));alter table public.oc_application_service_matches add constraint oc_application_service_matches_match_method_check CHECK ((match_method = ANY (ARRAY['exact_id'::text, 'exact_name'::text, 'manual'::text])));alter table public.oc_application_service_matches add constraint oc_application_service_matches_pkey PRIMARY KEY (application_id, service_id);alter table public.oc_provider_verification_checks add constraint oc_provider_verification_checks_check_type_check CHECK ((check_type = ANY (ARRAY['identity'::text, 'background'::text, 'license'::text, 'insurance'::text, 'skills'::text, 'service_area'::text, 'vehicle'::text])));alter table public.oc_provider_verification_checks add constraint oc_provider_verification_checks_pkey PRIMARY KEY (application_id, check_type);alter table public.oc_provider_verification_checks add constraint oc_provider_verification_checks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'under_review'::text, 'passed'::text, 'failed'::text, 'waived'::text, 'expired'::text])));alter table public.marketplace_operator_alerts add constraint marketplace_operator_alerts_pkey PRIMARY KEY (id);alter table public.marketplace_operator_alerts add constraint marketplace_operator_alerts_product_key_check CHECK ((product_key = ANY (ARRAY['on_call'::text, 'sos'::text])));alter table public.oc_service_catalog add constraint oc_service_catalog_category_id_fkey FOREIGN KEY (category_id) REFERENCES oc_service_categories(id);alter table public.oc_provider_applications add constraint oc_provider_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;alter table public.oc_application_service_matches add constraint oc_application_service_matches_application_id_fkey FOREIGN KEY (application_id) REFERENCES oc_provider_applications(id) ON DELETE CASCADE;alter table public.oc_application_service_matches add constraint oc_application_service_matches_service_id_fkey FOREIGN KEY (service_id) REFERENCES oc_service_catalog(id) ON DELETE CASCADE;alter table public.oc_provider_verification_checks add constraint oc_provider_verification_checks_application_id_fkey FOREIGN KEY (application_id) REFERENCES oc_provider_applications(id) ON DELETE CASCADE;CREATE OR REPLACE FUNCTION private.marketplace_emit_operator_alert(p_product_key text, p_alert_type text, p_entity_id uuid, p_title text, p_body text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if p_product_key not in ('on_call','sos') then raise exception 'Invalid product key'; end if;
  insert into public.marketplace_operator_alerts(product_key,alert_type,entity_id,title,body,metadata)
  values(p_product_key,left(p_alert_type,80),p_entity_id,left(p_title,180),left(coalesce(p_body,''),1000),coalesce(p_metadata,'{}'::jsonb));
end;$function$
;CREATE OR REPLACE FUNCTION private.oc_initialize_application_verification(p_application_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_app public.oc_provider_applications%rowtype; v_requires_license boolean:=false; v_requires_insurance boolean:=false;
begin
  select * into v_app from public.oc_provider_applications where id=p_application_id;
  if not found then return; end if;

  insert into public.oc_application_service_matches(application_id,service_id,match_method)
  select v_app.id,s.id,
    case when exists(select 1 from unnest(v_app.services_requested) r where lower(trim(r))=lower(s.id)) then 'exact_id' else 'exact_name' end
  from public.oc_service_catalog s
  where s.is_active and exists(
    select 1 from unnest(v_app.services_requested) r
    where lower(regexp_replace(trim(r),'[^a-z0-9]+','','g')) in (
      lower(regexp_replace(s.id,'[^a-z0-9]+','','g')),
      lower(regexp_replace(s.name,'[^a-z0-9]+','','g'))
    )
  )
  on conflict(application_id,service_id) do nothing;

  select coalesce(bool_or(s.requires_license),false),coalesce(bool_or(s.requires_insurance),false)
    into v_requires_license,v_requires_insurance
  from public.oc_application_service_matches m join public.oc_service_catalog s on s.id=m.service_id
  where m.application_id=v_app.id;

  insert into public.oc_provider_verification_checks(application_id,check_type,required)
  values
    (v_app.id,'identity',true),
    (v_app.id,'background',true),
    (v_app.id,'skills',true),
    (v_app.id,'service_area',true),
    (v_app.id,'license',v_requires_license),
    (v_app.id,'insurance',v_requires_insurance),
    (v_app.id,'vehicle',v_app.has_vehicle)
  on conflict(application_id,check_type) do update set required=excluded.required,updated_at=now();
end;$function$
;CREATE OR REPLACE FUNCTION public.oc_initialize_application_verification_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  perform private.oc_initialize_application_verification(new.id);
  return new;
end;$function$
;CREATE OR REPLACE FUNCTION public.oc_provider_application_operator_alert_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
 if tg_op='INSERT' then
   perform private.marketplace_emit_operator_alert('on_call','provider_application_submitted',new.id,'New ON CALL provider application',coalesce(new.first_name,'')||' '||coalesce(new.last_name,'')||' · '||coalesce(new.city,'')||', '||coalesce(new.state_code,''),jsonb_build_object('application_number',new.application_number,'status',new.status));
 elsif old.status is distinct from new.status then
   perform private.marketplace_emit_operator_alert('on_call','provider_application_status',new.id,'ON CALL provider application updated',coalesce(new.application_number,'Application')||' → '||new.status,jsonb_build_object('application_number',new.application_number,'old_status',old.status,'new_status',new.status));
 end if;
 return new;
end;$function$
;CREATE TRIGGER oc_provider_application_operator_alert AFTER INSERT OR UPDATE OF status ON public.oc_provider_applications FOR EACH ROW EXECUTE FUNCTION oc_provider_application_operator_alert_trigger();CREATE TRIGGER oc_provider_application_verification_init AFTER INSERT OR UPDATE OF services_requested, has_vehicle ON public.oc_provider_applications FOR EACH ROW EXECUTE FUNCTION oc_initialize_application_verification_trigger();