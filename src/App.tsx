import { AddCustomerModal } from './components/customers/AddCustomerModal'
import { CustomerTable } from './components/customers/CustomerTable'
import { AddPaymentModal } from './components/finance/AddPaymentModal'
import { TransactionTable } from './components/finance/TransactionTable'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { KpiCards } from './components/overview/KpiCards'
import { QuickActions } from './components/overview/QuickActions'
import { RevenueChart } from './components/overview/RevenueChart'
import { SourceDistribution } from './components/overview/SourceDistribution'
import { SettingsPanel } from './components/settings/SettingsPanel'
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
      {modal === 'customer' && <AddCustomerModal />}
      {modal === 'payment' && <AddPaymentModal />}
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}
