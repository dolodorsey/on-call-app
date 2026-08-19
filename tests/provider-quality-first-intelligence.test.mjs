import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync(new URL('../supabase/migrations/20260819024800_oncall_quality_first_matching.sql',import.meta.url),'utf8')

test('ON CALL provider qualification and live availability stay hard gates',()=>{
  assert.match(sql,/private\.oc_provider_service_dispatch_ready\(p\.id,b\.service_id\)/)
  assert.match(sql,/p\.is_available/)
  assert.match(sql,/is_on_duty/)
  assert.match(sql,/updated_at>=now\(\)-interval '5 minutes'/)
})

test('ON CALL quality outranks distance',()=>{
  assert.match(sql,/p_rating,5\)\/5\.0\*100\)\)\*0\.55/)
  assert.match(sql,/p_total_jobs,0\)::numeric\*2\)\)\*0\.35/)
  assert.match(sql,/p_distance_miles.*\*0\.10/s)
  assert.match(sql,/order by match_score desc/)
  assert.doesNotMatch(sql,/\*0\.60/)
})
