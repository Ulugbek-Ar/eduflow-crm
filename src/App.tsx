import { CustomerDetail } from './components/customers/CustomerDetail'
import { CustomerFormModal } from './components/customers/CustomerFormModal'
import { CustomerTable } from './components/customers/CustomerTable'
import { TransactionFormModal } from './components/finance/TransactionFormModal'
import { TransactionTable } from './components/finance/TransactionTable'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { KpiCards } from './components/overview/KpiCards'
import { QuickActions } from './components/overview/QuickActions'
import { RecentActivity } from './components/overview/RecentActivity'
import { RevenueChart } from './components/overview/RevenueChart'
import { SourceDistribution } from './components/overview/SourceDistribution'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { useState } from 'react'
import { LoginScreen } from './components/auth/LoginScreen'
import { PasswordPrompt } from './components/auth/PasswordPrompt'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { DashboardProvider } from './context/DashboardContext'
import { useDashboard } from './context/useDashboard'
import { useAuth } from './hooks/useAuth'

function ActiveSection() {
  const { activeSection } = useDashboard()

  switch (activeSection) {
    case 'overview':
      return (
        <div className="stack">
          <KpiCards />
          <div className="overview-grid">
            <RevenueChart />
            <SourceDistribution />
          </div>
          <div className="overview-grid">
            <RecentActivity />
            <QuickActions />
          </div>
        </div>
      )
    case 'customers':
      return <CustomerTable />
    case 'finance':
      return (
        <div className="stack">
          <TransactionTable />
        </div>
      )
    case 'settings':
      return <SettingsPanel />
  }
}

function Shell() {
  const { modal, activeSection, setActiveSection } = useDashboard()
  const { usingDefaultPassword } = useAuth()
  const [promptDismissed, setPromptDismissed] = useState(false)

  const goToSecurity = () => {
    setPromptDismissed(true)
    setActiveSection('settings')
    window.requestAnimationFrame(() => document.getElementById('security')?.scrollIntoView({ block: 'start' }))
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="content">
        <Header />
        <main className="main" id="main-content">
          <ErrorBoundary key={activeSection} compact>
            <ActiveSection />
          </ErrorBoundary>
        </main>
      </div>
      {usingDefaultPassword && !promptDismissed && !modal && (
        <PasswordPrompt onChangeNow={goToSecurity} onLater={() => setPromptDismissed(true)} />
      )}
      {modal?.type === 'customer' && <CustomerFormModal key={modal.payload?.id ?? 'new'} customerId={modal.payload?.id} />}
      {modal?.type === 'customerDetail' && <CustomerDetail key={modal.payload.id} customerId={modal.payload.id} />}
      {modal?.type === 'transaction' && (
        <TransactionFormModal
          key={modal.payload?.id ?? 'new'}
          transactionId={modal.payload?.id}
          kind={modal.payload?.kind}
          customerId={modal.payload?.customerId}
        />
      )}
    </div>
  )
}

function AuthGate() {
  const { session } = useAuth()
  if (!session) return <LoginScreen />
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
