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

test('customer create-account stops for required email confirmation instead of forcing password sign-in',()=>{
 const entry=read('src/OnCallEntry.tsx')
 assert.match(entry,/auth\.signUp/)
 assert.match(entry,/emailRedirectTo:'https:\/\/oncallallday\.com\/auth\/confirm'/)
 assert.match(entry,/if\(data\.session\)\{setSession\(data\.session\);return\}/)
 assert.match(entry,/Check your email to confirm your address, then sign in/)
})

test('/auth/confirm is a dedicated callback that accepts PKCE, token-hash, and implicit session flows',()=>{
 const main=read('src/main.tsx')
 const callback=read('src/AuthConfirmationRoute.tsx')
 assert.match(main,/const isAuthConfirm = pathname === '\/auth\/confirm'/)
 assert.match(main,/isAuthConfirm \? <AuthConfirmationRoute\/>/)
 assert.match(callback,/exchangeCodeForSession\(code\)/)
 assert.match(callback,/verifyOtp\(\{token_hash:tokenHash,type:type as any\}\)/)
 assert.match(callback,/auth\.getSession\(\)/)
 assert.match(callback,/onAuthStateChange/)
 assert.match(callback,/Email confirmed\. Your ON CALL account is ready\./)
 assert.match(callback,/location\.replace\('\/'\)/)
})
