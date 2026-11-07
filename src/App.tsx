import { tr } from './i18n'
import { CustomerTable } from './components/customers/CustomerTable'
import { DemoBar } from './components/layout/DemoBar'
import { MobileNav } from './components/layout/MobileNav'
import { OfflineBanner } from './components/layout/OfflineBanner'
import { SubscriptionBanner } from './components/layout/SubscriptionBanner'
import { PeriodBar } from './components/layout/PeriodBar'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { GettingStarted } from './components/overview/GettingStarted'
import { KpiCards } from './components/overview/KpiCards'
import { QuickActions } from './components/overview/QuickActions'
import { RecentActivity } from './components/overview/RecentActivity'
import { RevenueChart } from './components/overview/RevenueChart'
import { SourceDistribution } from './components/overview/SourceDistribution'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { lazy, Suspense, useEffect, useEffectEvent, useState } from 'react'
import { LoginScreen } from './components/auth/LoginScreen'
import { SetupWizard } from './components/onboarding/SetupWizard'
import { ForcePasswordChange } from './components/auth/ForcePasswordChange'
import { SetupAdminScreen } from './components/auth/SetupAdminScreen'
import { CloudDataGate, CloudLoading, CloudSignUpScreen } from './components/auth/CloudScreens'
import { DemoOnlyScreen } from './components/auth/DemoOnlyScreen'
import { isCloudEnabled } from './data/config'
import { ToastProvider } from './components/ui/Toast'
import { sectionLabel } from './constants/navigation'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DashboardProvider } from './context/DashboardContext'
import { useDashboard } from './context/useDashboard'
import { useAuth } from './hooks/useAuth'
import { getStorageNamespace, isFirstRun } from './services/storage.service'
import { pageTitle } from './constants/app'
import { cx } from './utils/cx'
import { loadWithRetry } from './utils/lazyRetry'
import { canOpenSection } from './auth/permissions'

function ActiveSection() {
  const { activeSection } = useDashboard()
  const { user, can } = useAuth()
  // Ruxsat yo'q bo'lim (masalan, rol o'zgargan) — bosh sahifa ko'rsatiladi
  const section = canOpenSection(user?.role, activeSection) ? activeSection : 'overview'

  switch (section) {
    case 'overview':
      // O'qituvchi: "Bugun" — darslar va davomat (moliya ko'rsatkichlarisiz)
      if (user?.role === 'teacher') return <TeacherToday />
      return (
        <div className="stack">
          <GettingStarted />
          <KpiCards />
          {can('groups.view') && (
            <Suspense fallback={null}>
              <TodayLessons />
            </Suspense>
          )}
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
    case 'groups':
      return <GroupsPanel />
    case 'attendance':
      return <AttendancePanel />
    case 'schedule':
      return <SchedulePanel />
    case 'finance':
      return (
        <div className="stack">
          <TransactionTable />
        </div>
      )
    case 'courses':
      return <CoursesPanel />
    case 'teachers':
      return <TeachersPanel />
    case 'analytics':
      return <AnalyticsPanel />
    case 'admin':
      return <AdminPanel />
    case 'help':
      return <HelpPanel />
    case 'settings':
      return <SettingsPanel />
  }
}


// Og'irroq bo'limlar va modallar alohida chunk'larda: birinchi ochilishda yuklanadigan JS kamayadi
const loadTransactionTable = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/finance/TransactionTable'), opts)
const loadSettingsPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/settings/SettingsPanel'), opts)
const loadCustomerForm = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/customers/CustomerFormModal'), opts)
const loadCustomerDetail = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/customers/CustomerDetail'), opts)
const loadTransactionForm = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/finance/TransactionFormModal'), opts)
const loadCoursesPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/courses/CoursesPanel'), opts)
const loadAnalyticsPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/analytics/AnalyticsPanel'), opts)
const loadCourseForm = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/courses/CourseFormModal'), opts)
const loadAdminPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/admin/AdminPanel'), opts)
const loadReceipt = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/print/ReceiptModal'), opts)
const loadHelpPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/help/HelpPanel'), opts)
const loadGroupsPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/groups/GroupsPanel'), opts)
const loadGroupDetail = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/groups/GroupDetail'), opts)
const loadGroupForm = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/groups/GroupFormModal'), opts)
const loadTeachersPanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/teachers/TeachersPanel'), opts)
const loadTodayLessons = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/attendance/TodayLessons'), opts)
const loadAttendancePanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/attendance/AttendancePanel'), opts)
const loadSchedulePanel = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/schedule/SchedulePanel'), opts)
const loadTeacherForm = (opts?: { reload: boolean }) => loadWithRetry(() => import('./components/teachers/TeacherFormModal'), opts)

const TransactionTable = lazy(() => loadTransactionTable().then((m) => ({ default: m.TransactionTable })))
const SettingsPanel = lazy(() => loadSettingsPanel().then((m) => ({ default: m.SettingsPanel })))
const CustomerFormModal = lazy(() => loadCustomerForm().then((m) => ({ default: m.CustomerFormModal })))
const CustomerDetail = lazy(() => loadCustomerDetail().then((m) => ({ default: m.CustomerDetail })))
const TransactionFormModal = lazy(() => loadTransactionForm().then((m) => ({ default: m.TransactionFormModal })))
const CoursesPanel = lazy(() => loadCoursesPanel().then((m) => ({ default: m.CoursesPanel })))
const AnalyticsPanel = lazy(() => loadAnalyticsPanel().then((m) => ({ default: m.AnalyticsPanel })))
const CourseFormModal = lazy(() => loadCourseForm().then((m) => ({ default: m.CourseFormModal })))
const AdminPanel = lazy(() => loadAdminPanel().then((m) => ({ default: m.AdminPanel })))
const ReceiptModal = lazy(() => loadReceipt().then((m) => ({ default: m.ReceiptModal })))
const HelpPanel = lazy(() => loadHelpPanel().then((m) => ({ default: m.HelpPanel })))
const GroupsPanel = lazy(() => loadGroupsPanel().then((m) => ({ default: m.GroupsPanel })))
const GroupDetail = lazy(() => loadGroupDetail().then((m) => ({ default: m.GroupDetail })))
const GroupFormModal = lazy(() => loadGroupForm().then((m) => ({ default: m.GroupFormModal })))
const TeachersPanel = lazy(() => loadTeachersPanel().then((m) => ({ default: m.TeachersPanel })))
const TodayLessons = lazy(() => loadTodayLessons().then((m) => ({ default: m.TodayLessons })))
const TeacherToday = lazy(() => loadTodayLessons().then((m) => ({ default: m.TeacherToday })))
const AttendancePanel = lazy(() => loadAttendancePanel().then((m) => ({ default: m.AttendancePanel })))
const SchedulePanel = lazy(() => loadSchedulePanel().then((m) => ({ default: m.SchedulePanel })))
const TeacherFormModal = lazy(() => loadTeacherForm().then((m) => ({ default: m.TeacherFormModal })))
const ImportDialog = lazy(() => loadWithRetry(() => import('./components/customers/import/ImportDialog')).then((m) => ({ default: m.ImportDialog })))
const ProductTour = lazy(() => loadWithRetry(() => import('./components/onboarding/ProductTour')).then((m) => ({ default: m.ProductTour })))

// Asosiy sahifa chizilgandan keyin bo'sh vaqtda oldindan yuklab qo'yiladi — birinchi ochilishda kechikish bo'lmaydi
function prefetchChunks() {
  for (const load of [loadCustomerForm, loadTransactionForm, loadCustomerDetail, loadTransactionTable, loadSettingsPanel, loadCoursesPanel, loadCourseForm, loadAnalyticsPanel, loadGroupsPanel, loadGroupDetail]) {
    load({ reload: false }).catch(() => {
      // Tarmoq xatosi bo'lsa, bo'lim ochilganda qayta urinib ko'riladi
    })
  }
}

function SectionFallback() {
  return (
    <div className="section-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {tr('Yuklanmoqda...')}
    </div>
  )
}

// Yozish maydoni ichida bo'lsa tezkor tugmalar ishlamaydi
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function Shell() {
  const { modal, activeSection, openModal, sidebarCollapsed, tourOpen, endTour } = useDashboard()
  const { can, user } = useAuth()
  const userRole = user?.role

  useEffect(() => {
    const timer = window.setTimeout(prefetchChunks, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const label = sectionLabel(activeSection, userRole)
    document.title = pageTitle(label)
  }, [activeSection, userRole])

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
      if (
        event.key.toLowerCase() === 'n' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !modalOpen &&
        !isTypingTarget(event.target) &&
        can('customers.edit')
      ) {
        event.preventDefault()
        openModal({ type: 'customer' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal, can])

  return (
    <div className={cx('app', sidebarCollapsed && 'is-collapsed')}>
      <a href="#main-content" className="skip-link">
        {tr('Asosiy kontentga o\'tish')}
      </a>
      <Sidebar />
      <MobileNav />
      <div className="content">
        <DemoBar />
        <OfflineBanner />
        <SubscriptionBanner />
        <Header />
        <main className="main" id="main-content" tabIndex={-1}>
          <PeriodBar />
          <ErrorBoundary key={activeSection} compact>
            <Suspense fallback={<SectionFallback />}>
              <ActiveSection />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <Suspense fallback={null}>
        {tourOpen && !modal && <ProductTour onClose={endTour} />}
        {modal?.type === 'customer' && <CustomerFormModal key={modal.payload?.id ?? 'new'} customerId={modal.payload?.id} />}
        {modal?.type === 'course' && <CourseFormModal key={modal.payload?.id ?? 'new'} courseId={modal.payload?.id} />}
        {modal?.type === 'customerDetail' && <CustomerDetail key={modal.payload.id} customerId={modal.payload.id} />}
        {modal?.type === 'receipt' && <ReceiptModal key={modal.payload.id} transactionId={modal.payload.id} />}
        {modal?.type === 'group' && <GroupFormModal key={modal.payload?.id ?? 'new'} groupId={modal.payload?.id} />}
        {modal?.type === 'teacher' && <TeacherFormModal key={modal.payload?.id ?? 'new'} teacherId={modal.payload?.id} />}
        {modal?.type === 'import' && <ImportDialog />}
        {modal?.type === 'groupDetail' && <GroupDetail key={modal.payload.id} groupId={modal.payload.id} tab={modal.payload.tab} />}
        {modal?.type === 'transaction' && (
          <TransactionFormModal
            key={modal.payload?.id ?? 'new'}
            transactionId={modal.payload?.id}
            kind={modal.payload?.kind}
            customerId={modal.payload?.customerId}
            amount={modal.payload?.amount}
            enrollmentId={modal.payload?.enrollmentId}
            period={modal.payload?.period}
          />
        )}
      </Suspense>
    </div>
  )
}

function AuthGate() {
  const { user, needsSetup, mode, enterDemo, loading, cloud } = useAuth()
  const [firstRunDone, setFirstRunDone] = useState(false)
  const [signUp, setSignUp] = useState(false)
  // Landing'dagi "Demo'ni ko'rish" -> /app?demo=1: kirilmagan bo'lsa demo markaz darhol ochiladi
  const openDemoFromLink = useEffectEvent(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    window.history.replaceState(null, '', window.location.pathname)
    if (!user) enterDemo()
  })
  useEffect(() => openDemoFromLink(), [])
  if (loading) return <CloudLoading />
  if (!user) {
    if (DEMO_ONLY) return <DemoOnlyScreen />
    if (cloud && signUp) return <CloudSignUpScreen cloud={cloud} onBack={() => setSignUp(false)} />
    return needsSetup ? <SetupAdminScreen /> : <LoginScreen onSignUp={cloud ? () => setSignUp(true) : undefined} />
  }
  // Vaqtinchalik parol bilan kirilgan — avval yangi parol
  if (user.mustChange) return <ForcePasswordChange />
  // Bulutli rejim: ma'lumot serverdan (sozlash ustasi o'rniga — Bosh sahifadagi "Boshlash" ro'yxati)
  if (cloud) {
    return (
      <CloudDataGate key={user.id} cloud={cloud}>
        <Shell />
      </CloudDataGate>
    )
  }
  // Birinchi kirish: sozlash ustasi (markaz, kurslar, xodimlar, ma'lumot). Ma'lumot avtomatik yozilmaydi
  if (!firstRunDone && isFirstRun()) return <SetupWizard onDone={() => setFirstRunDone(true)} />
  // Rejim yoki xodim almashsa, panel holati (bo'lim, filtrlar) noldan boshlanadi
  return (
    <DashboardProvider key={`${mode}:${user.id}`}>
      <Shell />
    </DashboardProvider>
  )
}

// Kalitlar berilgan va tab demo rejimda emas — bulutli (Supabase) rejim; supabase-js faqat shunda yuklanadi
const CLOUD_MODE = isCloudEnabled() && getStorageNamespace() !== 'demo'
// Namoyish sayti (GitHub Pages): faqat demo markaz
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === '1'
const CloudAuthProvider = lazy(() => loadWithRetry(() => import('./context/CloudAuthProvider')).then((m) => ({ default: m.CloudAuthProvider })))

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            {CLOUD_MODE ? (
              <Suspense fallback={<CloudLoading />}>
                <CloudAuthProvider>
                  <AuthGate />
                </CloudAuthProvider>
              </Suspense>
            ) : (
              <AuthProvider>
                <AuthGate />
              </AuthProvider>
            )}
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
