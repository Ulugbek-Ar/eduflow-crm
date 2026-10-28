# Apex Dashboard

Ta'lim markazlari va kichik biznes uchun CRM dashboard (React 19 + TypeScript + Vite, React Compiler).

```bash
npm install
npm run dev     # ishlab chiqish serveri
npm run build   # tsc -b && vite build -> dist/
npm run lint    # oxlint
```

Ma'lumotlar brauzerning `localStorage`'ida saqlanadi (`apex:*` kalitlari); birinchi ochilishda demo ma'lumotlar yoziladi.
Vercel/Netlify: build buyrug'i `npm run build`, chiqish papkasi `dist`.
