import { CustomerTable } from './components/customers/CustomerTable'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { KpiCards } from './components/overview/KpiCards'
import { QuickActions } from './components/overview/QuickActions'
import { RecentActivity } from './components/overview/RecentActivity'
import { RevenueChart } from './components/overview/RevenueChart'
import { SourceDistribution } from './components/overview/SourceDistribution'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { EmptyState } from './components/ui/EmptyState'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { lazy, Suspense, useEffect, useState } from 'react'
import { LoginScreen } from './components/auth/LoginScreen'
import { FirstRunScreen } from './components/onboarding/FirstRunScreen'
import { PasswordPrompt } from './components/auth/PasswordPrompt'
import { ToastProvider } from './components/ui/Toast'
import { NAV_ITEMS } from './constants/navigation'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DashboardProvider } from './context/DashboardContext'
import { useDashboard } from './context/useDashboard'
import { useAuth } from './hooks/useAuth'
import { isFirstRun } from './services/storage.service'
import { pageTitle } from './constants/app'
import { cx } from './utils/cx'
import { scrollToId } from './utils/scroll'

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
    case 'courses':
      return <CoursesPanel />
    case 'analytics':
      return <SectionPlaceholder section={activeSection} />
    case 'settings':
      return <SettingsPanel />
  }
}

// Yangi bo'limlar to'liq tayyor bo'lgunga qadar vaqtinchalik ekran
function SectionPlaceholder({ section }: { section: 'analytics' }) {
  const label = NAV_ITEMS.find((item) => item.id === section)?.label ?? ''
  return (
    <section className="card">
      <EmptyState title={label} description="Bu bo'lim tayyorlanmoqda." />
    </section>
  )
}

// Og'irroq bo'limlar va modallar alohida chunk'larda: birinchi ochilishda yuklanadigan JS kamayadi
const loadTransactionTable = () => import('./components/finance/TransactionTable')
const loadSettingsPanel = () => import('./components/settings/SettingsPanel')
const loadCustomerForm = () => import('./components/customers/CustomerFormModal')
const loadCustomerDetail = () => import('./components/customers/CustomerDetail')
const loadTransactionForm = () => import('./components/finance/TransactionFormModal')
const loadCoursesPanel = () => import('./components/courses/CoursesPanel')
const loadCourseForm = () => import('./components/courses/CourseFormModal')

const TransactionTable = lazy(() => loadTransactionTable().then((m) => ({ default: m.TransactionTable })))
const SettingsPanel = lazy(() => loadSettingsPanel().then((m) => ({ default: m.SettingsPanel })))
const CustomerFormModal = lazy(() => loadCustomerForm().then((m) => ({ default: m.CustomerFormModal })))
const CustomerDetail = lazy(() => loadCustomerDetail().then((m) => ({ default: m.CustomerDetail })))
const TransactionFormModal = lazy(() => loadTransactionForm().then((m) => ({ default: m.TransactionFormModal })))
const CoursesPanel = lazy(() => loadCoursesPanel().then((m) => ({ default: m.CoursesPanel })))
const CourseFormModal = lazy(() => loadCourseForm().then((m) => ({ default: m.CourseFormModal })))

// Asosiy sahifa chizilgandan keyin bo'sh vaqtda oldindan yuklab qo'yiladi — birinchi ochilishda kechikish bo'lmaydi
function prefetchChunks() {
  for (const load of [loadCustomerForm, loadTransactionForm, loadCustomerDetail, loadTransactionTable, loadSettingsPanel, loadCoursesPanel, loadCourseForm]) {
    load().catch(() => {
      // Tarmoq xatosi bo'lsa, bo'lim ochilganda qayta urinib ko'riladi
    })
  }
}

function SectionFallback() {
  return (
    <div className="section-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      Yuklanmoqda...
    </div>
  )
}

// Yozish maydoni ichida bo'lsa tezkor tugmalar ishlamaydi
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function Shell() {
  const { modal, activeSection, setActiveSection, openModal, sidebarCollapsed } = useDashboard()
  const { usingDefaultPassword } = useAuth()
  const [promptDismissed, setPromptDismissed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(prefetchChunks, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const label = NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? ''
    document.title = pageTitle(label)
  }, [activeSection])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const search = document.getElementById('global-search')
        if (search instanceof HTMLInputElement) {
          search.focus()
          search.select()
        }
        return
      }
      const modalOpen = document.querySelector('.modal-overlay') !== null
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !modalOpen && !isTypingTarget(event.target)) {
        event.preventDefault()
        openModal({ type: 'customer' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal])

  const goToSecurity = () => {
    setPromptDismissed(true)
    setActiveSection('settings')
    scrollToId('profile')
  }

  return (
    <div className={cx('app', sidebarCollapsed && 'is-collapsed')}>
      <a href="#main-content" className="skip-link">
        Asosiy kontentga o'tish
      </a>
      <Sidebar />
      <div className="content">
        <Header />
        <main className="main" id="main-content" tabIndex={-1}>
          <ErrorBoundary key={activeSection} compact>
            <Suspense fallback={<SectionFallback />}>
              <ActiveSection />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {usingDefaultPassword && !promptDismissed && !modal && (
        <PasswordPrompt onChangeNow={goToSecurity} onLater={() => setPromptDismissed(true)} />
      )}
      <Suspense fallback={null}>
        {modal?.type === 'customer' && <CustomerFormModal key={modal.payload?.id ?? 'new'} customerId={modal.payload?.id} />}
        {modal?.type === 'course' && <CourseFormModal key={modal.payload?.id ?? 'new'} courseId={modal.payload?.id} />}
        {modal?.type === 'customerDetail' && <CustomerDetail key={modal.payload.id} customerId={modal.payload.id} />}
        {modal?.type === 'transaction' && (
          <TransactionFormModal
            key={modal.payload?.id ?? 'new'}
            transactionId={modal.payload?.id}
            kind={modal.payload?.kind}
            customerId={modal.payload?.customerId}
            amount={modal.payload?.amount}
          />
        )}
      </Suspense>
    </div>
  )
}

function AuthGate() {
  const { session } = useAuth()
  const [firstRun, setFirstRun] = useState(isFirstRun)
  if (!session) return <LoginScreen />
  // Ma'lumot avtomatik yozilmaydi: avval "bo'sh" yoki "demo" tanlanadi
  if (firstRun) return <FirstRunScreen onDone={() => setFirstRun(false)} />
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
