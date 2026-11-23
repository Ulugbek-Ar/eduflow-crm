// Mavzuni birinchi chizishdan oldin qo'llash (oq "miltillash" bo'lmasligi uchun).
// Alohida faylda: Content-Security-Policy inline skriptlarga ruxsat bermaydi (script-src 'self')
try {
  var theme = JSON.parse(localStorage.getItem('apex:theme'))
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // localStorage bloklangan — tizim mavzusi ishlatiladi
}

// Landing'da asosiy skrinshot JS'dan oldin yuklana boshlaydi (LCP tezlashadi). /app va boshqa sahifalarda — yo'q
try {
  var base = new URL('.', document.currentScript.src).pathname
  var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : location.pathname.replace(/^\/+/, '')
  if (rest === '' || rest === 'index.html') {
    var link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.type = 'image/webp'
    link.setAttribute('imagesrcset', base + 'landing/overview-720.webp 720w, ' + base + 'landing/overview-1440.webp 1440w')
    link.setAttribute('imagesizes', '(max-width: 860px) calc(100vw - 32px), 620px')
    link.setAttribute('fetchpriority', 'high')
    document.head.appendChild(link)
  }
} catch {
  // e'tiborsiz
}
