from pathlib import Path
import json,re,subprocess,tempfile,os,hashlib
base=Path(__file__).resolve().parent
f=(base/'review-function.sql').read_text()
ddl=(base/'fixture.sql').read_text()+(base/'proposed.sql').read_text()
ddl+='''
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
create function private.is_marketplace_operator(uuid) returns boolean language sql as $$select coalesce(current_setting('fixture.operator',true),'false')='true'$$;
create table oc_users(id uuid primary key,email text,created_at timestamptz default now());
create table oc_notifications(user_id uuid,type text,title text,body text,action_url text,metadata jsonb,channel text);
'''+f
with tempfile.TemporaryDirectory(prefix='oncall-review-',dir='/tmp') as d:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=d,PGPORT='55461',PGDATABASE='postgres',PATH=os.environ.get('ONCALL_PG_BIN','')+os.pathsep+os.environ['PATH'])
 def run(cmd,**kw):return subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=20,check=True,**kw)
 def sql(q):return run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],input=q).stdout.strip()
 def snap():return sql("select json_build_array("+','.join(f'(select json_agg(t order by to_jsonb(t)::text) from {t} t)' for t in ['oc_provider_applications','marketplace_operator_alerts','oc_application_service_matches','oc_provider_verification_checks','oc_notifications'])+");")
 auth="set fixture.uid='00000000-0000-0000-0000-000000000001';set fixture.operator='true';"
 def reject(q,needle):
  before=snap();r=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],env=env,input=q,text=True,capture_output=True,timeout=10)
  assert r.returncode and needle in r.stderr,r.stderr
  assert snap()==before
 def review(status):return f"select (oc_ops_review_provider_application('00000000-0000-0000-0000-000000000003','{status}','new note')).status;"
 started=False;checks=[]
 try:
  run(['initdb','-D',d+'/data','-A','trust','--no-locale']);run(['pg_ctl','-D',d+'/data','-l',d+'/log','-o',f"-c listen_addresses='' -k {d} -p 55461",'start']);started=True
  sql(ddl)
  sql("insert into auth.users values('00000000-0000-0000-0000-000000000001');insert into oc_users(id,email) values('00000000-0000-0000-0000-000000000001','qa@example.invalid');")
  for i,status in [(2,'submitted'),(3,'rejected')]:
   sql(f"insert into oc_provider_applications(id,first_name,last_name,email,phone,city,state_code,services_requested,years_experience,background_check_consent,license_attested,insurance_attested,terms_accepted,status,review_notes) values('00000000-0000-0000-0000-00000000000{i}','Synthetic','QA','qa@example.invalid','5550100000','Atlanta','GA',array[]::text[],3,true,true,true,true,'{status}','original note');")
  for status in ['reviewing','approved']:
   reject(auth+review(status),'oc_provider_applications_active_email_unique');checks.append(status+' conflicting RPC preserves all five tables and produces no notification')
  reject("set fixture.operator='false';"+review('reviewing'),'Marketplace operator access required');checks.append('missing subject rejected before mutations (auth fixture)')
  reject(auth.replace("='true'","='false'")+review('reviewing'),'Marketplace operator access required');checks.append('nonoperator rejected before mutations (operator fixture)')
  sql("update oc_provider_applications set status='withdrawn' where id='00000000-0000-0000-0000-000000000002';")
  assert sql(auth+review('reviewing')).endswith('reviewing');assert sql('select count(*) from oc_notifications;')=='0';checks.append('explicit conflict removal allows review without notification')
  assert sql(auth+review('approved')).endswith('approved');assert sql("select count(*) from oc_notifications where type='provider_application_approved' and metadata->>'application_id'='00000000-0000-0000-0000-000000000003';")=='1';checks.append('successful approval follows actual local notification branch once')
  out={'checks':checks,'version':sql('show server_version;'),'function_md5':hashlib.md5(f.encode()).hexdigest(),'production_writes':0,'constraint_deployed':False,'limits':'Actual review function and prior five-table schema/trigger fixture; auth/operator predicates and oc_users/oc_notifications are minimal stubs. Not full RLS, privileges, notification consumer or human authority proof.'}
  print(json.dumps(out))
 finally:
  if started:run(['pg_ctl','-D',d+'/data','-m','immediate','stop'])
