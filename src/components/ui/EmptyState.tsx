import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  variant?: 'empty' | 'search'
  action?: ReactNode
}

function Illustration({ variant }: { variant: 'empty' | 'search' }) {
  return (
    <svg className="empty-illustration" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse cx="80" cy="104" rx="56" ry="8" className="ill-shadow" />
      <rect x="34" y="18" width="92" height="74" rx="10" className="ill-card" />
      <rect x="46" y="32" width="40" height="8" rx="4" className="ill-line-strong" />
      <rect x="46" y="48" width="68" height="6" rx="3" className="ill-line" />
      <rect x="46" y="60" width="56" height="6" rx="3" className="ill-line" />
      <rect x="46" y="72" width="36" height="6" rx="3" className="ill-line" />
      {variant === 'search' ? (
        <g className="ill-accent">
          <circle cx="112" cy="72" r="16" fill="none" strokeWidth="6" />
          <path d="m124 84 12 12" strokeWidth="7" strokeLinecap="round" />
        </g>
      ) : (
        <g className="ill-accent">
          <circle cx="116" cy="26" r="14" />
          <path d="M116 19v14M109 26h14" className="ill-plus" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

export function EmptyState({ title, description, variant = 'empty', action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Illustration variant={variant} />
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  )
}
