import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL recovery is mounted on customer/provider auth surfaces',()=>{
 const main=read('src/main.tsx')
 const host=read('src/AccountRecoveryHost.tsx')
 assert.match(main,/AccountRecoveryHost/)
 assert.match(host,/\.oc2-auth-panel,\.ocp-auth-card,\.ocpa-card/)
 assert.match(host,/Forgot password\?/)
})

test('reset email uses primary ON CALL domain and Supabase password recovery event',()=>{
 const host=read('src/AccountRecoveryHost.tsx')
 assert.match(host,/resetPasswordForEmail/)
 assert.match(host,/redirectTo:'https:\/\/oncallallday\.com\/\?recovery=1'/)
 assert.match(host,/PASSWORD_RECOVERY/)
})

test('new password is set only through authenticated recovery session',()=>{
 const host=read('src/AccountRecoveryHost.tsx')
 assert.match(host,/auth\.updateUser\(\{password\}\)/)
 assert.match(host,/password\.length<8/)
 assert.match(host,/password!==confirm/)
 assert.match(host,/Recovery never changes provider approval, verification, bookings, or payout state/)
})
