import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { EXPORT_FILE_PREFIX } from '../../../constants/app'
import { FUNNEL_STAGES, Icon, SOURCE_LABELS, STATUS_LABELS } from '../../../constants/navigation'
import { useDashboard } from '../../../context/useDashboard'
import { useCan } from '../../../hooks/useAuth'
import { useToday } from '../../../hooks/useToday'
import { tr } from '../../../i18n'
import { dateStamp, downloadFile, toCsv, toSpreadsheetXml } from '../../../services/export.service'
import type { ExportColumn } from '../../../services/export.service'
import type { CustomerSource, CustomerStatus } from '../../../types/customer.types'
import { cx } from '../../../utils/cx'
import { analyzeImport, buildPlan, detectMapping, guessMapping, IMPORT_FIELDS, looksLikeHeader, MAX_IMPORT_ROWS, skippedCsv, TEMPLATE_HEADERS, templateRows } from '../../../utils/import/customers'
import type { ColumnMapping, DuplicatePolicy, ImportField, ImportReceipt, ImportRow } from '../../../utils/import/customers'
import { IMPORT_ACCEPT, ImportFileError, readImportFile } from '../../../utils/import/read'
import type { XlsxSheet } from '../../../utils/import/xlsx'
import { Badge } from '../../ui/Badge'
import type { BadgeTone } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { Select } from '../../ui/Select'
import './import.css'

const FIELD_LABELS: Record<ImportField, string> = {
  name: tr('Ism familiya'),
  phone: tr('Telefon'),
  course: tr('Kurs'),
  source: tr('Manba'),
  status: tr('Holat'),
  note: tr('Izoh'),
  date: tr('Sana'),
}

const ACTION_BADGE: Record<ImportRow['action'], { tone: BadgeTone; label: string }> = {
  create: { tone: 'paid', label: tr('Qo\'shiladi') },
  update: { tone: 'contacted', label: tr('Yangilanadi') },
  skip: { tone: 'neutral', label: tr('O\'tkaziladi') },
  error: { tone: 'expense', label: tr('Xato') },
}

const PREVIEW_ROWS = 20

// 0 -> A, 26 -> AA
function columnLetter(index: number): string {
  let label = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + ((n - 1) % 26)) + label
  return label
}

function initialMapping(rows: readonly string[][]): { header: boolean; mapping: ColumnMapping } {
  const header = rows.length > 0 && looksLikeHeader(rows[0])
  return { header, mapping: header ? detectMapping(rows[0]) : guessMapping(rows) }
}

function downloadTemplate(format: 'csv' | 'xls', delimiter: ';' | ',') {
  const columns: ExportColumn<string[]>[] = TEMPLATE_HEADERS.map((header, i) => ({ header, value: (row) => row[i] ?? '', width: i === 0 ? 160 : 120 }))
  if (format === 'csv') downloadFile(`${EXPORT_FILE_PREFIX}-import-shablon.csv`, toCsv(templateRows(), columns, delimiter), 'text/csv;charset=utf-8')
  else downloadFile(`${EXPORT_FILE_PREFIX}-import-shablon.xls`, toSpreadsheetXml(templateRows(), columns, tr('Mijozlar')), 'application/vnd.ms-excel;charset=utf-8')
}

// Mijozlarni Excel/CSV'dan import: fayl -> ustunlarni moslashtirish va oldindan ko'rish -> natija (bekor qilish bilan)
export function ImportDialog() {
  const { customers, courses, settings, closeModal, importCustomers, undoImport } = useDashboard()
  const can = useCan()
  const today = useToday()
  const [step, setStep] = useState<'file' | 'map' | 'done'>('file')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<XlsxSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip')
  // Yaratilishi rad etilgan noma'lum kurslar (qolganlari yaratiladi)
  const [declinedCourses, setDeclinedCourses] = useState<ReadonlySet<string>>(() => new Set())
  const [defaultSource, setDefaultSource] = useState<CustomerSource>('telegram')
  const [defaultStatus, setDefaultStatus] = useState<CustomerStatus>('new')
  const [receipt, setReceipt] = useState<ImportReceipt | null>(null)
  const [skippedReport, setSkippedReport] = useState('')
  const [undone, setUndone] = useState(false)
  // Qadam almashganda fokus yangi qadam boshiga (bosilgan tugma yoki fayl maydoni yo'qolganda fokus body'ga tushmasin)
  const stepRef = useRef<HTMLDivElement>(null)
  const firstStep = useRef(true)

  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    stepRef.current?.focus()
  }, [step])

  const canCreateCourses = can('courses.edit')
  const rows = sheets[sheetIndex]?.rows ?? []
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length))
  const header = hasHeader ? (rows[0] ?? []) : []
  const dataRows = Math.max(0, rows.length - (hasHeader ? 1 : 0))
  const tooMany = dataRows > MAX_IMPORT_ROWS

  const baseOptions = { mapping, hasHeader, policy, existing: customers, courses, defaultSource, defaultStatus, today }
  // Avval noma'lum kurslarni aniqlash, keyin — rad etilmaganlarini yaratish rejasi bilan
  const probe = step === 'map' ? analyzeImport(rows, { ...baseOptions, createCourses: new Set() }) : null
  const unknown = probe ? [...probe.unknownCourses.entries()] : []
  const createCourses: ReadonlySet<string> = new Set(canCreateCourses ? unknown.map(([name]) => name).filter((name) => !declinedCourses.has(name)) : [])
  const analysis = probe && createCourses.size > 0 ? analyzeImport(rows, { ...baseOptions, createCourses }) : probe
  const ready = mapping.name !== undefined && mapping.phone !== undefined && !tooMany

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const read = await readImportFile(file)
      const first = Math.max(0, read.findIndex((s) => s.rows.length > 1))
      const initial = initialMapping(read[first].rows)
      setSheets(read)
      setSheetIndex(first)
      setHasHeader(initial.header)
      setMapping(initial.mapping)
      setDeclinedCourses(new Set())
      setFileName(file.name)
      setStep('map')
    } catch (e) {
      setError(e instanceof ImportFileError ? e.message : tr('Faylni o\'qib bo\'lmadi. CSV yoki .xlsx faylini tanlang.'))
    } finally {
      setBusy(false)
    }
  }

  const chooseSheet = (index: number) => {
    const initial = initialMapping(sheets[index]?.rows ?? [])
    setSheetIndex(index)
    setHasHeader(initial.header)
    setMapping(initial.mapping)
  }

  const setField = (field: ImportField, value: string) =>
    setMapping((prev) => {
      const next = { ...prev }
      if (value === '') delete next[field]
      else next[field] = Number(value)
      return next
    })

  const toggleCourse = (name: string) =>
    setDeclinedCourses((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const run = () => {
    if (!analysis || !ready) return
    const result = importCustomers(buildPlan(analysis, { mapping, createCourses }, fileName))
    if (!result) return
    setSkippedReport(analysis.skipped > 0 ? skippedCsv(analysis) : '')
    setReceipt(result)
    setStep('done')
  }

  const columnOptions = [
    { value: '', label: tr('— yo\'q —') },
    ...Array.from({ length: width }, (_, i) => ({ value: String(i), label: `${columnLetter(i)}${header[i]?.trim() ? `: ${header[i].trim().slice(0, 40)}` : ''}` })),
  ]

  const footer =
    step === 'map' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('file')}>
          {tr('Orqaga')}
        </Button>
        <Button icon="upload" disabled={!ready || !analysis || analysis.created + analysis.updated === 0} onClick={run}>
          {tr('Import qilish ({0})', { 0: analysis ? analysis.created + analysis.updated : 0 })}
        </Button>
      </>
    ) : (
      <Button variant={step === 'done' ? 'primary' : 'ghost'} onClick={closeModal}>
        {step === 'done' ? tr('Tayyor') : tr('Bekor qilish')}
      </Button>
    )

  return (
    <Modal
      title={tr('Mijozlarni import qilish')}
      description={step === 'file' ? tr('Excel yoki CSV fayldan: lidlar, o\'quvchilar va ularning kurslari') : fileName}
      onClose={closeModal}
      size="lg"
      footer={footer}
    >
      {step === 'file' && (
        <div className="stack step-focus" ref={stepRef} tabIndex={-1}>
          <label
            className={cx('import-drop', dragging && 'is-dragging', busy && 'is-busy')}
            onDragOver={(e: DragEvent<HTMLLabelElement>) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent<HTMLLabelElement>) => {
              e.preventDefault()
              setDragging(false)
              void loadFile(e.dataTransfer.files[0])
            }}
          >
            <input
              type="file"
              className="sr-only"
              accept={IMPORT_ACCEPT}
              disabled={busy}
              data-autofocus
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                void loadFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Icon name="upload" size={28} />
            <strong>{busy ? tr('Fayl o\'qilmoqda…') : tr('Faylni tanlang yoki shu yerga tashlang')}</strong>
            <span className="muted">{tr('CSV yoki Excel (.xlsx), 5 MB va {0} qatorgacha', { 0: MAX_IMPORT_ROWS })}</span>
          </label>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="import-template">
            <span className="muted">{tr('Shablon: ustunlar — Ism familiya, Telefon, Kurs, Manba, Holat, Izoh, Sana')}</span>
            <div className="toolbar">
              <Button size="sm" variant="ghost" icon="download" onClick={() => downloadTemplate('csv', settings.csvDelimiter)}>
                CSV
              </Button>
              <Button size="sm" variant="ghost" icon="sheet" onClick={() => downloadTemplate('xls', settings.csvDelimiter)}>
                Excel
              </Button>
            </div>
          </div>
          <ul className="import-tips muted">
            <li>{tr('Sarlavhalar o\'zbek, rus yoki ingliz tilida bo\'lishi mumkin: Ism / Имя / Name, Telefon / Телефон / Phone…')}</li>
            <li>{tr('Telefon istalgan ko\'rinishda: +998 90 123 45 67, 998901234567 yoki 901234567.')}</li>
            <li>{tr('Bazada bor raqamlar takror deb belgilanadi — o\'tkazib yuborish yoki yangilashni tanlaysiz.')}</li>
          </ul>
        </div>
      )}

      {step === 'map' && analysis && (
        <div className="stack step-focus" ref={stepRef} tabIndex={-1}>
          <div className="import-options">
            {sheets.length > 1 && (
              <Select
                label={tr('Varaq')}
                value={String(sheetIndex)}
                onChange={(e) => chooseSheet(Number(e.target.value))}
                options={sheets.map((s, i) => ({ value: String(i), label: tr('{0} ({1} qator)', { 0: s.name, 1: s.rows.length }) }))}
              />
            )}
            <label className="check-field">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              <span>{tr('Birinchi qator — sarlavha')}</span>
            </label>
          </div>

          {tooMany && (
            <p className="notice notice-error" role="alert">
              {tr('Faylda {0} tadan ortiq qator bor. Uni bir nechta faylga bo\'ling.', { 0: MAX_IMPORT_ROWS })}
            </p>
          )}

          <fieldset className="import-mapping">
            <legend>{tr('Ustunlarni moslashtirish')}</legend>
            {IMPORT_FIELDS.map((field) => (
              <Select
                key={field}
                label={`${FIELD_LABELS[field]}${field === 'name' || field === 'phone' ? ' *' : ''}`}
                value={mapping[field] === undefined ? '' : String(mapping[field])}
                onChange={(e) => setField(field, e.target.value)}
                options={columnOptions}
              />
            ))}
          </fieldset>
          {!ready && !tooMany && <p className="notice notice-info">{tr('Ism va Telefon ustunlarini tanlang.')}</p>}

          <div className="import-options">
            <Select
              label={tr('Manba ko\'rsatilmagan bo\'lsa')}
              value={defaultSource}
              onChange={(e) => setDefaultSource(e.target.value as CustomerSource)}
              options={(Object.keys(SOURCE_LABELS) as CustomerSource[]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
            />
            <Select
              label={tr('Bosqich ko\'rsatilmagan bo\'lsa')}
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as CustomerStatus)}
              options={FUNNEL_STAGES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
          </div>

          <div className="import-policy">
            <span id="import-policy-label">{tr('Bazada bor telefon raqamlari:')}</span>
            <div className="segmented" role="group" aria-labelledby="import-policy-label">
              <button type="button" aria-pressed={policy === 'skip'} className={cx(policy === 'skip' && 'is-active')} onClick={() => setPolicy('skip')}>
                {tr('O\'tkazib yuborish')}
              </button>
              <button type="button" aria-pressed={policy === 'update'} className={cx(policy === 'update' && 'is-active')} onClick={() => setPolicy('update')}>
                {tr('Yangilash')}
              </button>
            </div>
          </div>

          {unknown.length > 0 && (
            <div className="import-courses">
              <strong>{tr('Bazada yo\'q kurslar')}</strong>
              {canCreateCourses ? (
                unknown.map(([name, count]) => (
                  <label key={name} className="check-field">
                    <input type="checkbox" checked={!declinedCourses.has(name)} onChange={() => toggleCourse(name)} />
                    <span>
                      {tr('Kurs yaratish: «{0}»', { 0: name })} <small className="muted">{tr('({0} ta qator)', { 0: count })}</small>
                    </span>
                  </label>
                ))
              ) : (
                <p className="muted">{tr('Kurs yaratish uchun ruxsat yo\'q — kurs nomi mijoz izohiga yoziladi: {0}', { 0: unknown.map(([name]) => name).join(', ') })}</p>
              )}
              {canCreateCourses && <small className="muted">{tr('Yangi kurs narxsiz yaratiladi — keyin Kurslar bo\'limida narx va muddatini kiriting.')}</small>}
            </div>
          )}

          <p className="import-summary" role="status">
            {tr('Jami {0} qator: {1} ta qo\'shiladi, {2} ta yangilanadi, {3} ta o\'tkazib yuboriladi', { 0: analysis.rows.length, 1: analysis.created, 2: analysis.updated, 3: analysis.skipped })}
            {analysis.errors > 0 && ` (${tr('shundan xato: {0}', { 0: analysis.errors })})`}
          </p>

          <div className="import-table-wrap" tabIndex={0} role="region" aria-label={tr('Oldindan ko\'rish (birinchi {0} qator)', { 0: PREVIEW_ROWS })}>
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{FIELD_LABELS.name}</th>
                  <th scope="col">{FIELD_LABELS.phone}</th>
                  <th scope="col">{FIELD_LABELS.course}</th>
                  <th scope="col">{FIELD_LABELS.status}</th>
                  <th scope="col">{tr('Natija')}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.slice(0, PREVIEW_ROWS).map((row) => (
                  <tr key={row.line} className={cx(`is-${row.action}`)}>
                    <td className="muted">{row.line}</td>
                    <td>{row.name || '—'}</td>
                    <td className="nowrap">{row.phone || '—'}</td>
                    <td>{row.course || '—'}</td>
                    <td>{STATUS_LABELS[row.status]}</td>
                    <td>
                      <Badge tone={ACTION_BADGE[row.action].tone}>{ACTION_BADGE[row.action].label}</Badge>
                      {(row.reason || row.warnings.length > 0) && <small className="import-reason">{[row.action === 'update' ? '' : row.reason, ...row.warnings].filter(Boolean).join(' · ')}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analysis.rows.length > PREVIEW_ROWS && <p className="small-note muted">{tr('Yana {0} qator — import paytida shu qoidalar bo\'yicha tekshiriladi.', { 0: analysis.rows.length - PREVIEW_ROWS })}</p>}
        </div>
      )}

      {step === 'done' && receipt && (
        <div className="stack step-focus" ref={stepRef} tabIndex={-1}>
          <div className="import-result" role="status">
            <div>
              <span>{tr('Qo\'shildi')}</span>
              <strong>{receipt.added}</strong>
            </div>
            <div>
              <span>{tr('Yangilandi')}</span>
              <strong>{receipt.updated}</strong>
            </div>
            <div>
              <span>{tr('O\'tkazib yuborildi')}</span>
              <strong>{receipt.skipped}</strong>
            </div>
          </div>
          {receipt.courseIds.length > 0 && !undone && <p className="notice notice-info">{tr('{0} ta yangi kurs yaratildi — Kurslar bo\'limida narxini kiriting.', { 0: receipt.courseIds.length })}</p>}
          <div className="toolbar">
            {skippedReport && (
              <Button variant="ghost" icon="download" onClick={() => downloadFile(`${EXPORT_FILE_PREFIX}-import-xatolar-${dateStamp()}.csv`, skippedReport, 'text/csv;charset=utf-8')}>
                {tr('O\'tkazilganlar va xatolar (CSV)')}
              </Button>
            )}
            {(receipt.added > 0 || receipt.updated > 0) && (
              <Button
                variant="danger"
                icon="refresh"
                disabled={undone}
                onClick={() => {
                  undoImport(receipt)
                  setUndone(true)
                }}
              >
                {undone ? tr('Import bekor qilindi') : tr('Importni bekor qilish')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
