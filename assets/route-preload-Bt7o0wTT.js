// Avtomatik yaratilgan (scripts/route-preload.ts) — sahifa bo'lagini index.js bilan parallel yuklash
(function () {
  try {
    var map = {"app":["assets/App-Bqf-Cai3.js","assets/cx-B8hm9Ypl.js","assets/useAuth-DZxpz6-a.js","assets/plans-CsldrJk2.js","assets/Toast-B1iRBoHn.js","assets/Input-CBUfUPq_.js","assets/groups-CESuibOj.js","assets/analytics-CR8Ibyfq.js","assets/list-Br8Xu8hv.js","assets/phone-XjF6LqQ6.js","assets/searchText-DxbNQMvb.js","assets/subscription.service-BX9z8lQR.js","assets/audit.service-tT4ilGSI.js","assets/attribution-DtZUyIRU.js","assets/support-XbhYgHQS.js","assets/glossary-DJGyPK4K.js"],"owner":["assets/OwnerConsole-B9RIEK7V.js","assets/landing-BW--I9E9.css","assets/cx-B8hm9Ypl.js","assets/plans-CsldrJk2.js","assets/Toast-B1iRBoHn.js","assets/Input-CBUfUPq_.js","assets/supabase-B1iYWuo0.js"],"legal":["assets/LegalPage-DD0RAUvN.js","assets/landing-BW--I9E9.css","assets/cx-B8hm9Ypl.js","assets/support-XbhYgHQS.js"],"landing":["assets/LandingPage-3NxR7Vb1.js","assets/landing-BW--I9E9.css","assets/cx-B8hm9Ypl.js","assets/plans-CsldrJk2.js","assets/support-XbhYgHQS.js","assets/apply-sJ39aPyg.js","assets/phone-XjF6LqQ6.js"],"ru":["assets/ru-BSw4-toZ.js"]}
    var base = new URL('..', document.currentScript.src).pathname
    var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : location.pathname.replace(/^\/+/, '')
    var first = rest.split('/')[0].toLowerCase()
    var route = first === 'app' ? 'app' : first === 'owner' ? 'owner' : first === 'privacy' || first === 'terms' ? 'legal' : 'landing'
    var files = (map[route] || []).slice()
    if (localStorage.getItem('apex:lang') === '"ru"') files = (map.ru || []).concat(files)
    for (var i = 0; i < files.length; i++) {
      var link = document.createElement('link')
      if (/\.css$/.test(files[i])) {
        // Faqat oldindan yuklash: Vite bo'lakni ulaganda o'zi qo'llaydi (keshdan)
        link.rel = 'preload'
        link.as = 'style'
      } else {
        link.rel = 'modulepreload'
        link.crossOrigin = ''
      }
      link.href = base + files[i]
      document.head.appendChild(link)
    }
  } catch (e) {
    // Oldindan yuklash — faqat tezlashtirish; xato bo'lsa sahifa odatdagidek yuklanadi
  }
})()
