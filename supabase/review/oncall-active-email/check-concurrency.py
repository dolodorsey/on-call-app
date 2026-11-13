from pathlib import Path
import json,subprocess,tempfile,os,time
base=Path(__file__).resolve().parent;s=json.loads((base/'schema.json').read_text())
ddl='create schema private;create schema auth;create table auth.users(id uuid primary key);create sequence oc_provider_application_number_seq;'
cat_type=next(c['type'] for c in s['columns'] if c['table']=='oc_service_catalog' and c['name']=='category_id')
ddl+=f'create table oc_service_categories(id {cat_type} primary key);'
for table in sorted(set(c['table'] for c in s['columns'])):
 cols=[f'"{c["name"]}" {c["type"]}'+(' default '+c['default'] if c['default'] else '')+(' not null' if c['notnull'] else '') for c in s['columns'] if c['table']==table]
 ddl+=f'create table public.{table}('+','.join(cols)+');'
for fk in [False,True]:
 for c in s['constraints']:
  if c['definition'].startswith('FOREIGN KEY')==fk:ddl+=f'alter table public.{c["table"]} add constraint {c["name"]} {c["definition"]};'
ddl+=';'.join(r['definition'] for r in s['routines'])+';'+ ';'.join(s['triggers'])+';'
ddl+=(base/'proposed.sql').read_text()
# Fixture remains immutable; the proposal is loaded separately.
with tempfile.TemporaryDirectory(prefix='oncall-verification-',dir='/tmp') as d:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=d,PGPORT='55459',PGDATABASE='postgres',PATH=os.environ.get('ONCALL_PG_BIN','')+os.pathsep+os.environ['PATH'])
 def run(cmd,**kw):return subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=20,check=True,**kw)
 def sql(q):return run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],input=q).stdout.strip()
 def rejected(q,needle):
  r=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],env=env,input=q,text=True,capture_output=True,timeout=10)
  assert r.returncode!=0 and needle in r.stderr,r.stderr
 def insert(email,status='submitted'):
  return f"insert into oc_provider_applications(first_name,last_name,email,phone,city,state_code,services_requested,years_experience,background_check_consent,status,has_vehicle) values('Synthetic','QA',{email},'5550100000','Atlanta','GA',array['fixture-service'],3,true,'{status}',true);"
 def snapshot():return sql("select json_build_array((select json_agg(t order by id) from oc_provider_applications t),(select json_agg(t order by id) from marketplace_operator_alerts t),(select json_agg(t order by application_id,service_id) from oc_application_service_matches t),(select json_agg(t order by application_id,check_type) from oc_provider_verification_checks t));")
 started=False;checks=[]
 try:
  run(['initdb','-D',d+'/data','-A','trust','--no-locale']);run(['pg_ctl','-D',d+'/data','-l',d+'/log','-o',f"-c listen_addresses='' -k {d} -p 55459",'start']);started=True
  sql(ddl)
  sql("insert into oc_service_categories values('fixture');insert into oc_service_catalog(id,category_id,name,base_price,requires_license,requires_insurance) values('fixture-service','fixture','fixture-service',0,true,true);")
  a=subprocess.Popen(['psql','-X','-At','-v','ON_ERROR_STOP=1'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  a.stdin.write('begin;'+insert("' QA@example.invalid '")+"select pg_sleep(1.5);commit;\n");a.stdin.close()
  for _ in range(100):
   if sql("select count(*) from pg_stat_activity where wait_event='PgSleep';")=='1':break
   time.sleep(.02)
  else:raise AssertionError('barrier')
  rejected(insert("'qa@example.invalid'"),'oc_provider_applications_active_email_unique');a.wait(timeout=10);assert a.returncode==0
  assert sql('select count(*) from oc_provider_applications;')=='1';assert sql('select count(*) from marketplace_operator_alerts;')=='1'
  assert sql('select count(*) from oc_provider_verification_checks;')=='7';assert sql('select count(*) from oc_application_service_matches;')=='1';checks.append('overlapping insert leaves one application, one alert, one match, seven checks')
  assert sql("select count(*) from oc_provider_verification_checks where required and status='pending';")=='7';checks.append('actual catalog requirements and vehicle initialize all seven pending requirements')
  before=snapshot();rejected(insert('null'),'not-null');assert snapshot()==before;checks.append('null email rejected with no four-table change')
  sql(insert("'   '"));checks.append('blank email accepted: existing schema gap characterized, not fixed')
  before=snapshot();rejected(insert("''"),'oc_provider_applications_active_email_unique');assert snapshot()==before;checks.append('second normalized blank rejected without side effects')
  sql(insert("'qa@example.invalid'",'rejected'));before=snapshot();rejected("update oc_provider_applications set status='reviewing' where status='rejected';",'oc_provider_applications_active_email_unique');assert snapshot()==before;checks.append('conflicting reopen preserves exact four-table snapshot')
  sql("update oc_provider_applications set status='withdrawn' where lower(trim(email))='qa@example.invalid' and status='submitted';update oc_provider_applications set status='reviewing' where status='rejected';")
  assert sql('select count(*) from oc_provider_verification_checks;')=='21';assert sql('select count(*) from oc_application_service_matches;')=='3';checks.append('withdraw then reopen preserves existing verification identities')
  result={'version':sql('show server_version;'),'checks':checks,'table_count':5,'constraint_count':len(s['constraints']),'actual_routines':4,'production_writes':0,'deployed':False,'limits':'Five actual table column/default/constraint definitions and four routines; auth.users and service category parents are stubs. RLS/grants, unrelated indexes, external consumers, HTTP and actual operator RPC not exercised.'}
  print(json.dumps(result))
 finally:
  if started:run(['pg_ctl','-D',d+'/data','-m','immediate','stop'])
