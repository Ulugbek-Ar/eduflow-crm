// Dropdown 'fixed' rejimi uchun: menyu trigger atrofida viewport koordinatalarida
const GAP = 6
const EDGE = 8

// Trigger atrofida menyu uchun joy: pastda sig'masa va tepada sig'sa — tepaga
export function fixedMenuPosition(
  trigger: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
  menu: Pick<DOMRect, 'width' | 'height'>,
  viewport: { width: number; height: number },
  align: 'left' | 'right',
): { top: number; left: number } {
  const below = trigger.bottom + GAP
  const above = trigger.top - GAP - menu.height
  const top = below + menu.height > viewport.height - EDGE && above >= EDGE ? above : below
  const preferred = align === 'right' ? trigger.right - menu.width : trigger.left
  const left = Math.min(Math.max(EDGE, preferred), Math.max(EDGE, viewport.width - menu.width - EDGE))
  return { top, left }
}
