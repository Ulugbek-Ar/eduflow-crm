// Bo'lim lazy yuklanayotgan bo'lishi mumkin — element paydo bo'lguncha bir necha kadr kutiladi
export function scrollToId(id: string, attempts = 30): void {
  const element = document.getElementById(id)
  if (element) {
    // Eski brauzerlar va test muhiti (jsdom) uchun tekshiruv
    if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'start' })
    return
  }
  if (attempts > 0) window.requestAnimationFrame(() => scrollToId(id, attempts - 1))
}
