import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'

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
    console.error('Apex Dashboard xatosi:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={this.props.compact ? 'error-screen is-compact' : 'error-screen'} role="alert">
        <span className="error-icon">
          <Icon name="alert" size={28} />
        </span>
        <h2>Kutilmagan xato yuz berdi</h2>
        <p className="muted">
          Sahifaning bir qismi ishlamay qoldi. Ma'lumotlaringiz brauzerda saqlangan — qayta yuklash odatda muammoni hal qiladi.
        </p>
        <details>
          <summary>Texnik tafsilotlar</summary>
          <code>{error.message}</code>
        </details>
        <div className="error-actions">
          {this.props.compact && (
            <button type="button" className="btn btn-ghost" onClick={() => this.setState({ error: null })}>
              Qayta urinish
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={16} />
            Qayta yuklash
          </button>
        </div>
      </div>
    )
  }
}
