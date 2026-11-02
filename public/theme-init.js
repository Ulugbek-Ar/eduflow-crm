// Mavzuni birinchi chizishdan oldin qo'llash (oq "miltillash" bo'lmasligi uchun).
// Alohida faylda: Content-Security-Policy inline skriptlarga ruxsat bermaydi (script-src 'self')
try {
  var theme = JSON.parse(localStorage.getItem('apex:theme'))
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // localStorage bloklangan — tizim mavzusi ishlatiladi
}
