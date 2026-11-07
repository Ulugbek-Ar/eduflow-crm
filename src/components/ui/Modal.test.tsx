// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

function Disappearing({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <Modal title="Davomat" onClose={onClose}>
      {done ? <p>Belgilandi</p> : <button onClick={() => setDone(true)}>Hammasi keldi</button>}
      <button>Boshqa</button>
    </Modal>
  )
}

describe('Modal', () => {
  it('bosilgan tugma yo\'qolib fokus body\'ga tushsa ham Escape yopadi, Tab oynaga qaytaradi', () => {
    const onClose = vi.fn()
    render(<Disappearing onClose={onClose} />)
    const button = screen.getByRole('button', { name: 'Hammasi keldi' })
    button.focus()
    fireEvent.click(button)
    // Tugma DOM'dan olindi — fokus body'da
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    document.body.focus()
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ichma-ich oynalarda fokus yo\'qolsa faqat eng ustidagisi yopiladi', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    function Nested() {
      const [open, setOpen] = useState(false)
      return (
        <Modal title="Tashqi" onClose={outer}>
          <button onClick={() => setOpen(true)}>Tasdiqlash</button>
          {open && (
            <Modal title="Ichki" onClose={inner} role="alertdialog">
              <p>Matn</p>
            </Modal>
          )}
        </Modal>
      )
    }
    render(<Nested />)
    fireEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })
})
