import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('approved provider activation supports account creation with required email confirmation',()=>{
 const activation=read('src/ProviderAccountActivation.tsx')
 assert.match(activation,/auth\.signUp/)
 assert.match(activation,/emailRedirectTo:'https:\/\/oncallallday\.com\/provider\/activate'/)
 assert.match(activation,/if\(!data\.session\)/)
 assert.match(activation,/Check your email and confirm it first/i)
 assert.match(activation,/auth\.resend/)
 assert.match(activation,/oc_provider_activate_approved_application/)
})

test('provider activation RPC is reached only after a session exists or confirmed sign-in succeeds',()=>{
 const activation=read('src/ProviderAccountActivation.tsx')
 const signupBranch=activation.slice(activation.indexOf("if(mode==='signup')"),activation.indexOf('}else{',activation.indexOf("if(mode==='signup')")))
 assert.match(signupBranch,/if\(!data\.session\)[\s\S]*?return/)
 assert.match(signupBranch,/await activate\(\)/)
 const noSession=signupBranch.indexOf('if(!data.session)')
 const activate=signupBranch.lastIndexOf('await activate()')
 assert.ok(noSession>=0&&activate>noSession,'activation must happen after the no-session confirmation branch')
})

test('Provider Command exposes approved-account activation and the route is mounted',()=>{
 const main=read('src/main.tsx')
 const access=read('src/ProviderActivationAccessHost.tsx')
 assert.match(main,/pathname === '\/provider\/activate'/)
 assert.match(main,/ProviderAccountActivation/)
 assert.match(main,/ProviderActivationAccessHost/)
 assert.match(access,/href="\/provider\/activate"/)
})

test('customer create-account submit is intercepted and confirmation-aware while sign-in is untouched',()=>{
 const guard=read('src/CustomerAuthConfirmationGuard.tsx')
 assert.match(guard,/\.oc2-auth-panel/)
 assert.match(guard,/create account/i)
 assert.match(guard,/event\.preventDefault\(\)/)
 assert.match(guard,/auth\.signUp/)
 assert.match(guard,/if\(data\.session\)/)
 assert.match(guard,/auth\.resend/)
 assert.match(guard,/I confirmed — sign in/)
})
