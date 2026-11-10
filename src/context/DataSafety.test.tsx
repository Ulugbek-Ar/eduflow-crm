// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { readOnlyAllows } from '../auth/permissions'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'
import { ToastProvider } from '../components/ui/Toast'
import { readPreMigrationBackup, removePreMigrationBackup } from '../services/storage.service'
import { makeCustomer, seedData } from '../test/helpers'
import { DashboardProvider } from './DashboardContext'
import { useDashboard } from './useDashboard'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function ClearButton() {
  const { clearAllData, customers } = useDashboard()
  return (
    <button type="button" onClick={clearAllData}>
      clear {customers.length}
    </button>
  )
}

describe('Ma\'lumot xavfsizligi', () => {
  it('muddati tugaganda (faqat o\'qish) ko\'rish va yuklab olish ochiq, o\'zgartirish yopiq', () => {
    expect(readOnlyAllows('customers.view')).toBe(true)
    expect(readOnlyAllows('reports.export')).toBe(true)
    expect(readOnlyAllows('customers.edit')).toBe(false)
    expect(readOnlyAllows('data.manage')).toBe(false)
    expect(readOnlyAllows('staff.manage')).toBe(false)
  })

  it('"Barcha ma\'lumotni tozalash" savatcha va migratsiyadan oldingi nusxani ham o\'chiradi', async () => {
    seedData({ customers: [makeCustomer({ id: 'c1', name: 'Aziza' })] })
    const deleted = makeCustomer({ id: 'c0', name: 'O\'chirilgan Mijoz', phone: '+998 90 000 00 01' })
    localStorage.setItem('apex:trash', JSON.stringify([{ kind: 'customer', id: 'c0', deletedAt: new Date().toISOString(), deletedBy: '', item: deleted }]))
    localStorage.setItem('apex:backup-pre-v11', JSON.stringify({ app: 'apex-crm', version: 10, customers: [deleted] }))
    render(
      <ToastProvider>
        <ConfirmProvider>
          <DashboardProvider>
            <ClearButton />
          </DashboardProvider>
        </ConfirmProvider>
      </ToastProvider>,
    )
    await act(async () => screen.getByRole('button', { name: 'clear 1' }).click())
    const trash = JSON.parse(localStorage.getItem('apex:trash') ?? '[]') as unknown[]
    expect(trash).toEqual([])
    expect(localStorage.getItem('apex:backup-pre-v11')).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain('O\'chirilgan Mijoz')
  })

  it('migratsiyadan oldingi nusxani alohida o\'chirish mumkin', () => {
    localStorage.setItem('apex:backup-pre-v11', JSON.stringify({ version: 10, customers: [] }))
    expect(readPreMigrationBackup()).not.toBeNull()
    removePreMigrationBackup()
    expect(readPreMigrationBackup()).toBeNull()
  })
})
