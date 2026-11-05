import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initStorageNamespace } from './services/storage.service'

// Tab demo rejimda ochilgan bo'lsa (sessionStorage), demo ma'lumot bilan davom etadi
initStorageNamespace()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
