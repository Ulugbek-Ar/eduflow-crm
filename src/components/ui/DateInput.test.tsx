// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DateInput } from './DateInput'

afterEach(cleanup)

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DateInput label="Sana" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue('')}>
        Tozalash
      </button>
    </>
  )
}

describe('DateInput', () => {
  it('kk.oo.yyyy ko\'rinishida yoziladi, ichkarida YYYY-MM-DD', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('Sana') as HTMLInputElement
    expect(input.placeholder).toBe('kk.oo.yyyy')
    await user.type(input, '05112026')
    expect(input.value).toBe('05.11.2026')
    expect(screen.getByTestId('value').textContent).toBe('2026-11-05')
  })

  it('chala yoki noto\'g\'ri sanada qiymat bo\'sh va tushunarli xato', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-01-15" />)
    const input = screen.getByLabelText('Sana') as HTMLInputElement
    expect(input.value).toBe('15.01.2026')
    await user.clear(input)
    await user.type(input, '31022026')
    expect(screen.getByTestId('value').textContent).toBe('')
    await user.tab()
    expect(screen.getByRole('alert').textContent).toBe('Sanani kk.oo.yyyy ko\'rinishida kiriting')
  })

  it('tashqaridan qiymat o\'zgarsa matn yangilanadi', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-01-15" />)
    await user.click(screen.getByRole('button', { name: 'Tozalash' }))
    expect((screen.getByLabelText('Sana') as HTMLInputElement).value).toBe('')
  })
})
