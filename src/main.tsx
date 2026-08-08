import './native.js'
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './premium-experience.css'
import './runtime.css'
import './on-call-marketplace.css'
import './production-integrity.css'
import './elite-ui.css'
import OnCallEntry from './OnCallEntry'
import OnCallEnhancementHost from './OnCallEnhancementHost'
import CustomerOperationsHost from './CustomerOperationsHost'

const ProviderCommand = lazy(() => import('./ProviderCommand'))
const ProviderRealtimeBridge = lazy(() => import('./ProviderRealtimeBridge'))
const ProviderIssueHost = lazy(() => import('./ProviderIssueHost'))
const ProviderMatchHost = lazy(() => import('./ProviderMatchHost'))
const ProviderApply = lazy(() => import('../components/ProviderApply'))

const pathname = window.location.pathname.replace(/\/$/, '') || '/'
const isProviderApplication = pathname === '/apply'
const isProviderWorkspace = pathname === '/provider'

class RuntimeBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, details: React.ErrorInfo) { console.error('ON CALL runtime failure', error, details) }
  render() {
    if (!this.state.hasError) return this.props.children
    return <div className="oc-runtime-fallback" role="alert"><div className="oc-runtime-fallback__mark">OC</div><div className="oc-runtime-fallback__eyebrow">Service connection interrupted</div><h1>Let’s reconnect ON CALL.</h1><p>Your account and booking history remain available. Reload to reconnect to the service network.</p><button type="button" onClick={() => window.location.reload()}>Reload ON CALL</button></div>
  }
}

function RouteLoading() {
  const label = isProviderApplication ? 'Opening provider application' : 'Opening Provider Command'
  return <div className="oc-route-loading" role="status" aria-live="polite"><div className="oc-route-loading__mark">OC</div><div className="oc-route-loading__pulse"/><span>{label}</span></div>
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('ON CALL root element is missing')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RuntimeBoundary>
      <div className="oc-experience" data-app="on-call">
        {isProviderApplication || isProviderWorkspace ? (
          <Suspense fallback={<RouteLoading />}>
            {isProviderApplication ? <ProviderApply /> : <><ProviderCommand/><ProviderRealtimeBridge/><ProviderIssueHost/><ProviderMatchHost/></>}
          </Suspense>
        ) : <><OnCallEntry/><OnCallEnhancementHost/><CustomerOperationsHost/></>}
      </div>
    </RuntimeBoundary>
  </React.StrictMode>,
)