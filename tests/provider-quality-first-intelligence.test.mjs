import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dispatchSql=fs.readFileSync(new URL('../supabase/migrations/20260819024800_oncall_quality_first_matching.sql',import.meta.url),'utf8')
const scoreV3=fs.readFileSync(new URL('../supabase/migrations/20260819040500_oncall_provider_quality_v3.sql',import.meta.url),'utf8')

test('ON CALL provider qualification and live availability stay hard gates',()=>{
  assert.match(dispatchSql,/private\.oc_provider_service_dispatch_ready\(p\.id,b\.service_id\)/)
  assert.match(dispatchSql,/p\.is_available/)
  assert.match(dispatchSql,/is_on_duty/)
  assert.match(dispatchSql,/updated_at>=now\(\)-interval '5 minutes'/)
})

test('ON CALL quality outranks distance and proximity is capped at five percent',()=>{
  assert.match(scoreV3,/p_rating,5\)\/5\.0\*100\)\)\*0\.50/)
  assert.match(scoreV3,/p_total_jobs,0\)::numeric\*2\)\)\*0\.45/)
  const distanceLine=scoreV3.split('\n').find(line=>line.includes('p_distance_miles')&&line.includes('*0.'))||''
  assert.match(distanceLine,/\*0\.05/)
  assert.doesNotMatch(distanceLine,/\*0\.(?:0[6-9]|[1-9][0-9])/)
  assert.match(dispatchSql,/order by match_score desc/)
})

test('ON CALL does not use SEO or generic popularity as provider authority',()=>{
  assert.doesNotMatch(scoreV3,/seo|search_rank|followers|sponsored|featured/i)
})
