import { CustomerDetail } from './components/customers/CustomerDetail'
import { CustomerFormModal } from './components/customers/CustomerFormModal'
import { CustomerTable } from './components/customers/CustomerTable'
import { TransactionFormModal } from './components/finance/TransactionFormModal'
import { TransactionTable } from './components/finance/TransactionTable'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { KpiCards } from './components/overview/KpiCards'
import { QuickActions } from './components/overview/QuickActions'
import { RevenueChart } from './components/overview/RevenueChart'
import { SourceDistribution } from './components/overview/SourceDistribution'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { DashboardProvider } from './context/DashboardContext'
import { useDashboard } from './context/useDashboard'

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
          <QuickActions />
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
  const { modal } = useDashboard()

  return (
    <div className="app">
      <Sidebar />
      <div className="content">
        <Header />
        <main className="main">
          <ActiveSection />
        </main>
      </div>
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

export default function App() {
  return (
    <ConfirmProvider>
      <DashboardProvider>
        <Shell />
      </DashboardProvider>
    </ConfirmProvider>
  )
}
