import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('verification bucket is private, size-limited, and restricted to safe document/image types',()=>{
 const migration=read('supabase/migrations/20260809062500_private_verification_documents.sql')
 assert.match(migration,/marketplace-verification/)
 assert.match(migration,/false,10485760/)
 for(const mime of ['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])assert.match(migration,new RegExp(mime.replace('/','\\/')))
})

test('provider uploads are scoped to their authenticated path and operator reads remain private',()=>{
 const migration=read('supabase/migrations/20260809062500_private_verification_documents.sql')
 assert.match(migration,/storage\.foldername\(name\)\)\[2\]=auth\.uid\(\)::text/)
 assert.match(migration,/public\.marketplace_operator_check\(\)/)
 assert.doesNotMatch(migration,/public=true/)
})

test('evidence submission can only mark a check submitted, never passed',()=>{
 const migration=read('supabase/migrations/20260809062500_private_verification_documents.sql')
 assert.match(migration,/oc_provider_submit_verification_evidence/)
 assert.match(migration,/status=case when status='passed' then status else 'submitted' end/)
 assert.match(migration,/on_call\/.*auth\.uid\(\).*application_id/i)
})

test('provider UI uploads private evidence and operations views it through short-lived signed URLs',()=>{
 const provider=read('src/ProviderVerificationReadinessHost.tsx')
 const ops=read('src/ProviderVerificationOpsHost.tsx')
 assert.match(provider,/marketplace-verification/)
 assert.match(provider,/oc_provider_submit_verification_evidence/)
 assert.match(provider,/10\*1024\*1024/)
 assert.match(provider,/Upload evidence/)
 assert.match(ops,/createSignedUrl\(path,300\)/)
 assert.match(ops,/View file/)
})
