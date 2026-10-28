import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { getPeriod, groupByMonth, groupByWeek, niceScale, overlaps } from '../../utils/analytics'
import { cx } from '../../utils/cx'
import { formatCompact } from '../../utils/format'

type Mode = 'month' | 'week'

const WIDTH = 640
const HEIGHT = 260
const PAD_LEFT = 92
const PAD_RIGHT = 8
const PAD_TOP = 12
const PAD_BOTTOM = 30
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM

export function RevenueChart() {
  const { transactions, dateRange, money } = useDashboard()
  const [mode, setMode] = useState<Mode>('month')
  const [active, setActive] = useState<number | null>(null)
  const groupRefs = useRef<Array<SVGGElement | null>>([])

  const buckets = mode === 'month' ? groupByMonth(transactions, 6) : groupByWeek(transactions, 8)
  const period = getPeriod(dateRange)
  const scale = niceScale(Math.max(...buckets.map((b) => Math.max(b.income, b.expense))))
  const ticks = Array.from({ length: Math.round(scale.max / scale.step) + 1 }, (_, i) => i * scale.step)
  const slot = PLOT_W / buckets.length
  const barW = Math.min(slot * 0.3, 28)
  const y = (value: number) => PAD_TOP + PLOT_H - (value / scale.max) * PLOT_H
  const totalIncome = buckets.reduce((sum, b) => sum + b.income, 0)
  const totalExpense = buckets.reduce((sum, b) => sum + b.expense, 0)

  const focusGroup = (index: number) => {
    const next = Math.max(0, Math.min(buckets.length - 1, index))
    groupRefs.current[next]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buckets.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      focusGroup(moves[event.key])
    }
  }

  const activeBucket = active === null ? null : buckets[active]
  const tooltipLeft = active === null ? 0 : ((PAD_LEFT + (active + 0.5) * slot) / WIDTH) * 100

  return (
    <section className="card" aria-labelledby="revenue-title">
      <div className="card-head">
        <div>
          <h2 id="revenue-title">Kirim va chiqim</h2>
          <span className="muted">
            {mode === 'month' ? 'Oxirgi 6 oy' : 'Oxirgi 8 hafta'} · kirim <strong className="text-success">{money(totalIncome)}</strong>, chiqim{' '}
            <strong className="text-danger">{money(totalExpense)}</strong>
          </span>
        </div>
        <div className="segmented" role="group" aria-label="Guruhlash">
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={cx(mode === m && 'is-active')}
              onClick={() => {
                setMode(m)
                setActive(null)
              }}
            >
              {m === 'month' ? 'Oylik' : 'Haftalik'}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item legend-income">Kirim</span>
        <span className="legend-item legend-expense">Chiqim</span>
        <span className="legend-note">Tanlangan davr ajratib ko'rsatilgan</span>
      </div>

      <div className="chart-wrap">
        <svg
          className="chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="group"
          aria-label="Kirim va chiqim grafigi. Ustunlar orasida chap va o'ng strelkalar bilan harakatlaning"
        >
          {ticks.map((tick) => (
            <g key={tick} aria-hidden="true">
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'chart-axis' : 'chart-grid'} />
              <text x={PAD_LEFT - 8} y={y(tick) + 4} textAnchor="end" className="chart-tick">
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const x = PAD_LEFT + i * slot
            const center = x + slot / 2
            const inRange = overlaps(b, period)
            return (
              <g
                key={b.key}
                ref={(el) => {
                  groupRefs.current[i] = el
                }}
                className={cx('chart-group', !inRange && 'is-dim', active === i && 'is-active')}
                tabIndex={i === (active ?? buckets.length - 1) ? 0 : -1}
                role="img"
                aria-label={`${b.longLabel}: kirim ${money(b.income)}, chiqim ${money(b.expense)}, sof ${money(b.income - b.expense)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => handleKeyDown(e, i)}
              >
                <rect x={x} y={PAD_TOP} width={slot} height={PLOT_H} className="chart-hit" />
                <rect x={center - barW - 2} y={y(b.income)} width={barW} height={Math.max(PAD_TOP + PLOT_H - y(b.income), 1)} rx={4} className="bar-income" />
                <rect x={center + 2} y={y(b.expense)} width={barW} height={Math.max(PAD_TOP + PLOT_H - y(b.expense), 1)} rx={4} className="bar-expense" />
                <text x={center} y={HEIGHT - 10} textAnchor="middle" className={cx('chart-label', mode === 'week' && i % 2 === 1 && 'is-odd')}>
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>

        {activeBucket && (
          <div
            className={cx('chart-tooltip', active === 0 && 'is-start', active === buckets.length - 1 && 'is-end')}
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <strong>{activeBucket.longLabel}</strong>
            <span>
              <i className="dot dot-income" /> Kirim: {money(activeBucket.income)}
            </span>
            <span>
              <i className="dot dot-expense" /> Chiqim: {money(activeBucket.expense)}
            </span>
            <span className={activeBucket.income - activeBucket.expense < 0 ? 'text-danger' : 'text-success'}>
              Sof: {money(activeBucket.income - activeBucket.expense)}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
