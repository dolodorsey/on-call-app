create table if not exists public.oc_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.oc_users(id) on delete restrict,
  booking_id uuid null references public.oc_bookings(id) on delete set null,
  category text not null check (category in ('account','booking','payment','provider','privacy','safety','technical','other')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','reviewing','waiting_customer','resolved','closed')),
  operator_note text null,
  reviewed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);
create index if not exists oc_support_tickets_user_created_idx on public.oc_support_tickets(user_id,created_at desc);
create index if not exists oc_support_tickets_status_priority_idx on public.oc_support_tickets(status,priority,created_at);
create index if not exists oc_support_tickets_booking_idx on public.oc_support_tickets(booking_id) where booking_id is not null;
alter table public.oc_support_tickets enable row level security;
revoke all on public.oc_support_tickets from anon, authenticated;
grant select,insert,update,delete on public.oc_support_tickets to service_role;

create or replace function public.oc_open_support_ticket(p_category text,p_subject text,p_description text,p_priority text default 'normal',p_booking_id uuid default null)
returns table(ticket_id uuid,ticket_number text,status text)
language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_user uuid:=public.oc_current_user_id(); v_number text; v_id uuid;
begin
 if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_category not in ('account','booking','payment','provider','privacy','safety','technical','other') then raise exception 'Unsupported support category'; end if;
 if p_priority not in ('normal','high','urgent') then raise exception 'Invalid priority'; end if;
 if coalesce(length(trim(p_subject)),0)<3 then raise exception 'Support subject is required'; end if;
 if coalesce(length(trim(p_description)),0)<5 then raise exception 'Describe what you need help with'; end if;
 if p_booking_id is not null and not exists(select 1 from public.oc_bookings where id=p_booking_id and customer_id=v_user) then raise exception 'Booking not found' using errcode='42501'; end if;
 v_number:='OC-S-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.oc_support_tickets(ticket_number,user_id,booking_id,category,priority,subject,description,status)
 values(v_number,v_user,p_booking_id,p_category,p_priority,left(trim(p_subject),160),left(trim(p_description),3000),'open') returning id into v_id;
 insert into public.oc_notifications(user_id,booking_id,type,title,body,action_url,metadata,channel)
 values(v_user,p_booking_id,'support_ticket_opened','Support case opened',v_number||' is in the ON CALL support queue.','/support',jsonb_build_object('ticket_id',v_id,'ticket_number',v_number,'status','open'),'push');
 insert into public.marketplace_operator_alerts(product_key,alert_type,entity_id,title,body,metadata)
 values('on_call','support_ticket',v_id,'ON CALL support case · '||v_number,left(trim(p_subject),160),jsonb_build_object('ticket_id',v_id,'ticket_number',v_number,'priority',p_priority,'category',p_category,'booking_id',p_booking_id));
 return query select v_id,v_number,'open'::text;
end;$$;

create or replace function public.oc_my_support_tickets()
returns table(id uuid,ticket_number text,booking_id uuid,category text,priority text,subject text,description text,status text,operator_note text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz)
language sql stable security definer set search_path='pg_catalog','public' as $$
 select t.id,t.ticket_number,t.booking_id,t.category,t.priority,t.subject,t.description,t.status,t.operator_note,t.created_at,t.updated_at,t.resolved_at
 from public.oc_support_tickets t where auth.uid() is not null and t.user_id=public.oc_current_user_id()
 order by case t.status when 'open' then 0 when 'reviewing' then 1 when 'waiting_customer' then 2 when 'resolved' then 3 else 4 end,t.created_at desc;
$$;

create or replace function public.oc_ops_support_tickets(p_status text default null)
returns table(id uuid,ticket_number text,user_id uuid,booking_id uuid,category text,priority text,subject text,description text,status text,operator_note text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz,user_email text,user_name text)
language sql stable security definer set search_path='pg_catalog','public','private' as $$
 select t.id,t.ticket_number,t.user_id,t.booking_id,t.category,t.priority,t.subject,t.description,t.status,t.operator_note,t.created_at,t.updated_at,t.resolved_at,u.email,coalesce(nullif(u.full_name,''),trim(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')))
 from public.oc_support_tickets t join public.oc_users u on u.id=t.user_id
 where private.is_marketplace_operator(auth.uid()) and (p_status is null or t.status=p_status)
 order by case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end,case t.status when 'open' then 0 when 'reviewing' then 1 when 'waiting_customer' then 2 else 3 end,t.created_at;
$$;

create or replace function public.oc_ops_update_support_ticket(p_ticket_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_ticket public.oc_support_tickets%rowtype;
begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('open','reviewing','waiting_customer','resolved','closed') then raise exception 'Invalid support status'; end if;
 update public.oc_support_tickets set status=p_status,operator_note=nullif(left(trim(coalesce(p_note,'')),3000),''),reviewed_by=auth.uid(),resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now() where id=p_ticket_id returning * into v_ticket;
 if not found then raise exception 'Support case not found' using errcode='P0002'; end if;
 insert into public.oc_notifications(user_id,booking_id,type,title,body,action_url,metadata,channel)
 values(v_ticket.user_id,v_ticket.booking_id,'support_ticket_'||p_status,'Support case updated',case when p_status='resolved' then v_ticket.ticket_number||' was resolved.' when p_status='closed' then v_ticket.ticket_number||' was closed.' when p_status='waiting_customer' then v_ticket.ticket_number||' needs information from you.' else v_ticket.ticket_number||' is now '||replace(p_status,'_',' ')||'.' end,'/support',jsonb_build_object('ticket_id',v_ticket.id,'ticket_number',v_ticket.ticket_number,'status',p_status),'push');
 return jsonb_build_object('ticket_id',v_ticket.id,'ticket_number',v_ticket.ticket_number,'status',v_ticket.status,'updated_at',v_ticket.updated_at);
end;$$;

revoke all on function public.oc_open_support_ticket(text,text,text,text,uuid) from public,anon;
revoke all on function public.oc_my_support_tickets() from public,anon;
revoke all on function public.oc_ops_support_tickets(text) from public,anon;
revoke all on function public.oc_ops_update_support_ticket(uuid,text,text) from public,anon;
grant execute on function public.oc_open_support_ticket(text,text,text,text,uuid) to authenticated;
grant execute on function public.oc_my_support_tickets() to authenticated;
grant execute on function public.oc_ops_support_tickets(text) to authenticated;
grant execute on function public.oc_ops_update_support_ticket(uuid,text,text) to authenticated;
