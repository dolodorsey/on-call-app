import './native.js'
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './premium-experience.css'
import './runtime.css'
import './on-call-marketplace.css'
import './production-integrity.css'
import './elite-ui.css'
import './customer-profile-tools.css'
import './customer-coverage-status.css'
import './operations-command.css'
import './provider-verification-ops.css'
import './provider-verification-readiness.css'
import './provider-account-activation.css'
import './marketplace-ops-alerts.css'
import './marketplace-launch-readiness.css'
import './support-center.css'
import './support-ops.css'
import './root-layout-rescue.css'
import './account-recovery.css'
import './on-call-sos-structure.css'
import OnCallEntry from './OnCallEntry'
import OnCallShellControl from './OnCallShellControl'
import OnCallSubcategoryRestoreHost from './OnCallSubcategoryRestoreHost'
import OnCallEnhancementHost from './OnCallEnhancementHost'
import OnCallVisualUpgradeHost from './OnCallVisualUpgradeHost'
import CustomerOperationsHost from './CustomerOperationsHost'
import CustomerCancellationHost from './CustomerCancellationHost'
import CustomerSettlementReviewHost from './CustomerSettlementReviewHost'
import CustomerProfileToolsHost from './CustomerProfileToolsHost'
import CustomerRealtimeBridge from './CustomerRealtimeBridge'
import CustomerReceiptHost from './CustomerReceiptHost'
import CustomerCoverageStatusHost from './CustomerCoverageStatusHost'
import NotificationInboxHost from './NotificationInboxHost'
import ShareTrackingHost from './ShareTrackingHost'
import AccountRecoveryHost from './AccountRecoveryHost'
import AccountDeletionHost from './AccountDeletionHost'
import PushRegistrationHost from './PushRegistrationHost'
import PaymentReadinessHost from './PaymentReadinessHost'
import BookingChatHost from './BookingChatHost'
import ProviderVerificationOpsHost from './ProviderVerificationOpsHost'
import ProviderVerificationReadinessHost from './ProviderVerificationReadinessHost'
import ProviderAccountActivation from './ProviderAccountActivation'
import ProviderActivationAccessHost from './ProviderActivationAccessHost'
import ProviderApplicationActivationLinkHost from './ProviderApplicationActivationLinkHost'
import ProviderCustomerTrustHost from './ProviderCustomerTrustHost'
import MarketplaceOpsAlertsHost from './MarketplaceOpsAlertsHost'
import MarketplaceLaunchReadinessHost from './MarketplaceLaunchReadinessHost'
import SupportOpsHost from './SupportOpsHost'
import SupportCenterRoute from './SupportCenterRoute'
import InteractionContractHost from './InteractionContractHost'
import MarketplaceTruthHost from './MarketplaceTruthHost'
import AuthConfirmationRoute from './AuthConfirmationRoute'
import LegalPage from './LegalPage'
import LegalLinksHost from './LegalLinksHost'

const ProviderCommand = lazy(() => import('./ProviderCommand'))
const ProviderRealtimeBridge = lazy(() => import('./ProviderRealtimeBridge'))
const ProviderIssueHost = lazy(() => import('./ProviderIssueHost'))
const ProviderMatchHost = lazy(() => import('./ProviderMatchHost'))
const ProviderNoShowHost = lazy(() => import('./ProviderNoShowHost'))
const ProviderReliabilityHost = lazy(() => import('./ProviderReliabilityHost'))
const ProviderApply = lazy(() => import('../components/ProviderApply'))
const OperationsCommand = lazy(() => import('./OperationsCommand'))

const pathname = window.location.pathname.replace(/\/$/, '') || '/'
const isProviderApplication = pathname === '/apply'
const isProviderActivation = pathname === '/provider/activate'
const isProviderWorkspace = pathname === '/provider'
const isOperationsWorkspace = pathname === '/ops'
const isPrivacy = pathname === '/privacy'
const isTerms = pathname === '/terms'
const isSupport = pathname === '/support'
const isAuthConfirm = pathname === '/auth/confirm'

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
  const label = isOperationsWorkspace ? 'Opening Marketplace Operations' : isProviderActivation ? 'Opening provider activation' : isProviderApplication ? 'Opening provider application' : 'Opening Provider Command'
  return <div className="oc-route-loading" role="status" aria-live="polite"><div className="oc-route-loading__mark">OC</div><div className="oc-route-loading__pulse"/><span>{label}</span></div>
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('ON CALL root element is missing')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RuntimeBoundary>
      <div className="oc-experience" data-app="on-call">
        <OnCallVisualUpgradeHost/>
        {isAuthConfirm ? <AuthConfirmationRoute/> : isPrivacy ? <LegalPage kind="privacy"/> : isTerms ? <LegalPage kind="terms"/> : isSupport ? <SupportCenterRoute/> : <>
          <InteractionContractHost/>
          <MarketplaceTruthHost/>
          <LegalLinksHost/>
          {isOperationsWorkspace ? (
            <Suspense fallback={<RouteLoading/>}><><OperationsCommand/><ProviderVerificationOpsHost/><MarketplaceOpsAlertsHost/><MarketplaceLaunchReadinessHost/><SupportOpsHost/></></Suspense>
          ) : <>
            <PaymentReadinessHost/>
            <BookingChatHost/>
            <PushRegistrationHost/>
            <AccountRecoveryHost/>
            <AccountDeletionHost/>
            <NotificationInboxHost/>
            {isProviderActivation ? (
              <ProviderAccountActivation/>
            ) : isProviderApplication || isProviderWorkspace ? (
              <Suspense fallback={<RouteLoading />}>
                {isProviderApplication ? <><ProviderApplicationActivationLinkHost/><ProviderApply/></> : <><ProviderActivationAccessHost/><ProviderCommand/><ProviderVerificationReadinessHost/><ProviderRealtimeBridge/><ProviderIssueHost/><ProviderMatchHost/><ProviderNoShowHost/><ProviderReliabilityHost/><ProviderCustomerTrustHost/></>}
              </Suspense>
            ) : <><OnCallEntry/><OnCallShellControl/><OnCallSubcategoryRestoreHost/><CustomerCoverageStatusHost/><CustomerRealtimeBridge/><OnCallEnhancementHost/><CustomerOperationsHost/><CustomerCancellationHost/><CustomerSettlementReviewHost/><CustomerProfileToolsHost/><CustomerReceiptHost/><ShareTrackingHost/></>}
          </>}
        </>}
      </div>
    </RuntimeBoundary>
  </React.StrictMode>,
)
