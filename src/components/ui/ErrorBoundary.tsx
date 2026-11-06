import { tr } from '../../i18n'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import { APP_NAME } from '../../constants/app'

interface ErrorBoundaryProps {
  children: ReactNode
  // Bo'lim darajasida: butun ilova emas, faqat shu qism almashtiriladi
  compact?: boolean
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${APP_NAME} xatosi:`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={this.props.compact ? 'error-screen is-compact' : 'error-screen'} role="alert">
        <span className="error-icon">
          <Icon name="alert" size={28} />
        </span>
        <h2>{tr('Kutilmagan xato yuz berdi')}</h2>
        <p className="muted">
          {tr('Sahifaning bir qismi ishlamay qoldi. Ma\'lumotlaringiz brauzerda saqlangan — qayta yuklash odatda muammoni hal qiladi.')}
        </p>
        <details>
          <summary>{tr('Texnik tafsilotlar')}</summary>
          <code>{error.message}</code>
        </details>
        <div className="error-actions">
          {this.props.compact && (
            <button type="button" className="btn btn-ghost" onClick={() => this.setState({ error: null })}>
              {tr('Qayta urinish')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={16} />
            {tr('Qayta yuklash')}
          </button>
        </div>
      </div>
    )
  }
}
