from pathlib import Path
import json, os, subprocess, tempfile
base=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='oncall-preflight-',dir='/tmp') as d:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 env.update(PGHOST=d,PGPORT='55461',PGDATABASE='postgres',PATH=os.environ.get('ONCALL_PG_BIN','')+os.pathsep+os.environ['PATH'])
 def run(args,**kw):return subprocess.run(args,env=env,text=True,capture_output=True,timeout=20,check=True,**kw)
 def sql(q):return run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=q).stdout.strip()
 def read():
  v=json.loads(sql((base/'preflight.sql').read_text()));assert v['release_authorized'] is False
  return v
 started=False;checks=[]
 try:
  run(['initdb','-D',d+'/data','-A','trust','--no-locale'])
  run(['pg_ctl','-D',d+'/data','-l',d+'/log','-o',f"-c listen_addresses='' -k {d} -p 55461",'start']);started=True
  sql('create table oc_provider_applications(email text,status text);')
  assert read()['named_index'] is None;checks.append('absent index remains absent')
  sql("insert into oc_provider_applications values(' QA@example.invalid ','submitted'),('qa@example.invalid','approved'),('qa@example.invalid','rejected'),('','withdrawn'),(null,'submitted');")
  v=read();assert v['active_duplicates']=={'groups':1,'excess_rows':1};assert v['counts']=={'total_rows':5,'null_emails':1,'blank_emails':1,'active_rows':3};assert 'qa@example.invalid' not in json.dumps(v).lower();checks.append('normalized active duplicate counted; history excluded; no email values returned')
  sql("delete from oc_provider_applications where status='approved';")
  sql((base/'proposed.sql').read_text());v=read()['named_index'];assert all(v[k] for k in ['indisunique','indisvalid','indisready','indislive']);assert v['indexed_table']=='oc_provider_applications';checks.append('actual proposal definition and flags surfaced')
  sql('drop index oc_provider_applications_active_email_unique;create table unrelated(email text);create index oc_provider_applications_active_email_unique on unrelated(email);')
  v=read()['named_index'];assert v['indexed_table']=='unrelated' and not v['indisunique'];checks.append('misleading same-name index exposed without readiness claim')
  sql('create role fixture_reader;grant usage on schema public to fixture_reader;grant select on oc_provider_applications to fixture_reader;alter table oc_provider_applications enable row level security;')
  r=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],env=env,text=True,capture_output=True,input='set role fixture_reader;'+(base/'preflight.sql').read_text(),timeout=20)
  assert r.returncode!=0 and 'row-level security' in r.stderr;checks.append('RLS-filtered reader fails instead of reporting false zero')
  print(json.dumps({'checks':checks,'passed':len(checks),'production_writes':0}))
 finally:
  if started:run(['pg_ctl','-D',d+'/data','-m','immediate','stop'])
