create or replace function public.oc_open_support_ticket(
  p_category text,
  p_subject text,
  p_description text,
  p_priority text default 'normal',
  p_booking_id uuid default null
)
returns table(ticket_id uuid,ticket_number text,status text)
language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_user uuid:=public.oc_current_user_id(); v_number text; v_id uuid;
begin
 if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_category not in ('account','booking','payment','provider','privacy','safety','technical','other') then raise exception 'Unsupported support category'; end if;
 if p_priority not in ('normal','high','urgent') then raise exception 'Invalid priority'; end if;
 if coalesce(length(trim(p_subject)),0)<3 then raise exception 'Support subject is required'; end if;
 if coalesce(length(trim(p_description)),0)<5 then raise exception 'Describe what you need help with'; end if;
 if p_booking_id is not null and not exists(
   select 1 from public.oc_bookings b
   left join public.oc_provider_profiles p on p.id=b.provider_id
   where b.id=p_booking_id and (b.customer_id=v_user or p.user_id=v_user)
 ) then raise exception 'Booking not found' using errcode='42501'; end if;
 v_number:='OC-S-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.oc_support_tickets(ticket_number,user_id,booking_id,category,priority,subject,description,status)
 values(v_number,v_user,p_booking_id,p_category,p_priority,left(trim(p_subject),160),left(trim(p_description),3000),'open') returning id into v_id;
 insert into public.oc_notifications(user_id,booking_id,type,title,body,action_url,metadata,channel)
 values(v_user,p_booking_id,'support_ticket_opened','Support case opened',v_number||' is in the ON CALL support queue.','/support',jsonb_build_object('ticket_id',v_id,'ticket_number',v_number,'status','open'),'push');
 insert into public.marketplace_operator_alerts(product_key,alert_type,entity_id,title,body,metadata)
 values('on_call','support_ticket',v_id,'ON CALL support case · '||v_number,left(trim(p_subject),160),jsonb_build_object('ticket_id',v_id,'ticket_number',v_number,'priority',p_priority,'category',p_category,'booking_id',p_booking_id));
 return query select v_id,v_number,'open'::text;
end;$$;

create or replace function public.oc_my_supportable_bookings()
returns table(id uuid,service_name text,status text,created_at timestamptz,relationship text)
language sql stable security definer set search_path='pg_catalog','public' as $$
 with me as (select public.oc_current_user_id() as user_id),
 providers as (select p.id from public.oc_provider_profiles p,me where p.user_id=me.user_id)
 select b.id,b.service_name,b.status,b.created_at,case when b.customer_id=me.user_id then 'customer'::text else 'provider'::text end
 from public.oc_bookings b,me
 where auth.uid() is not null and (b.customer_id=me.user_id or b.provider_id in (select id from providers))
 order by b.created_at desc limit 50;
$$;

revoke all on function public.oc_open_support_ticket(text,text,text,text,uuid) from public,anon;
revoke all on function public.oc_my_supportable_bookings() from public,anon;
grant execute on function public.oc_open_support_ticket(text,text,text,text,uuid) to authenticated;
grant execute on function public.oc_my_supportable_bookings() to authenticated;
