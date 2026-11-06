import { tr } from '../../i18n'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import { APP_NAME } from '../../constants/app'
import { isChunkLoadError } from '../../utils/lazyRetry'

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
    // Kod bo'lagi yuklanmadi: internet uzilgan yoki yangi versiya chiqqan
    const chunk = isChunkLoadError(error)

    return (
      <div className={this.props.compact ? 'error-screen is-compact' : 'error-screen'} role="alert">
        <span className="error-icon">
          <Icon name="alert" size={28} />
        </span>
        <h2>{chunk ? tr('Bo\'lim yuklanmadi') : tr('Kutilmagan xato yuz berdi')}</h2>
        <p className="muted">
          {chunk
            ? tr('Internet uzilgan yoki dasturning yangi versiyasi chiqqan. Internetni tekshirib, "Qayta yuklash"ni bosing.')
            : tr('Sahifaning bir qismi ishlamay qoldi. Kiritgan ma\'lumotlaringiz saqlangan — "Qayta urinish" odatda yordam beradi.')}
        </p>
        <details>
          <summary>{tr('Texnik tafsilotlar')}</summary>
          <code>{error.message}</code>
        </details>
        <div className="error-actions">
          {this.props.compact && !chunk && (
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
