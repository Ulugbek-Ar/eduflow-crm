// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'
import { ToastProvider } from '../components/ui/Toast'
import type { CloudSnapshot, CloudSync } from '../data/supabase'
import { createEmptyData } from '../services/storage.service'
import { makeCustomer } from '../test/helpers'
import { DashboardProvider } from './DashboardContext'
import type { CloudBinding } from './DashboardContext'
import { useDashboard } from './useDashboard'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function Names() {
  const { customers, addCustomer } = useDashboard()
  return (
    <div>
      <output data-testid="names">{customers.map((c) => c.name).join(',')}</output>
      <button type="button" onClick={() => addCustomer({ name: 'Yangi Mijoz', phone: '+998 93 555 44 33', source: 'website', course: '', note: '', status: 'new' })}>
        add
      </button>
    </div>
  )
}

function snapshot(names: string[]): CloudSnapshot {
  return { data: { ...createEmptyData(), customers: names.map((name, i) => makeCustomer({ id: `c${i}`, name })) }, trash: [] }
}

function renderWith(binding: CloudBinding) {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <DashboardProvider cloud={binding}>
          <Names />
        </DashboardProvider>
      </ConfirmProvider>
    </ToastProvider>,
  )
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('Bulut: internet qaytganda va boshqa xodim o\'zgarishlari', () => {
  it('yuborilmay qolgan o\'zgarish internet qaytganda qayta yuboriladi', async () => {
    let online = false
    const list = vi.fn(async () => {
      if (!online) throw new Error('Failed to fetch')
    })
    const sync = { list, settings: vi.fn(async () => undefined), setTrash: vi.fn(), purge: vi.fn() } as unknown as CloudSync
    renderWith({ initial: snapshot(['Ali']), sync })
    await act(async () => screen.getByText('add').click())
    await flush()
    expect(list).toHaveBeenCalledTimes(1)

    online = true
    await act(async () => window.dispatchEvent(new Event('online')))
    await flush()
    expect(list).toHaveBeenCalledTimes(2)
    // Ikkinchi urinish avvalgi (serverdagi) holatdan yangi holatgacha bo'lgan farqni yuboradi
    const [key, prev, next] = list.mock.calls[1] as unknown as [string, unknown[], Array<{ name: string }>]
    expect(key).toBe('customers')
    expect(prev).toHaveLength(1)
    expect(next.map((c) => c.name)).toContain('Yangi Mijoz')

    // Muvaffaqiyatdan keyin qayta yuborilmaydi
    await act(async () => window.dispatchEvent(new Event('online')))
    await flush()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('serverdagi yangi yozuvlar olib kelinadi; yuborilmagan o\'zgarish ustidan yozilmaydi', async () => {
    let server = snapshot(['Ali', 'Vali'])
    const reload = vi.fn(async () => server)
    let fail = false
    const list = vi.fn(async () => {
      if (fail) throw new Error('Failed to fetch')
    })
    const sync = { list, settings: vi.fn(async () => undefined), setTrash: vi.fn(), purge: vi.fn() } as unknown as CloudSync
    renderWith({ initial: snapshot(['Ali']), sync, reload })

    await act(async () => window.dispatchEvent(new Event('online')))
    await flush()
    expect(screen.getByTestId('names').textContent).toBe('Ali,Vali')
    // Serverdan kelgan holat qayta serverga yuborilmaydi
    expect(list).not.toHaveBeenCalled()
    expect(sync.setTrash).toHaveBeenCalled()

    // Mijoz qo'shildi, lekin yuborilmadi — serverdagi eski ro'yxat uni o'chirib yubormasin
    fail = true
    await act(async () => screen.getByText('add').click())
    await flush()
    server = snapshot(['Ali', 'Vali', 'Sardor'])
    await act(async () => window.dispatchEvent(new Event('online')))
    await flush()
    expect(screen.getByTestId('names').textContent).toContain('Yangi Mijoz')
  })
})
