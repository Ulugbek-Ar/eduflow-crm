// Ilova nomi va identifikatorlari — barcha joyda (sarlavhalar, index.html, zaxira fayllari) shu yerdan olinadi.
// index.html dagi %APP_NAME% va %APP_DESCRIPTION% build paytida vite.config.ts orqali almashtiriladi
export const APP_NAME = 'EduFlow CRM'
export const APP_DESCRIPTION = 'ta\'lim markazlari va kichik biznes uchun CRM: mijozlar bazasi, to\'lovlar, kassa balansi, hisobotlar va analitika bitta panelda'

// JSON zaxira faylidagi "app" maydoni va fayl nomi prefiksi
export const BACKUP_APP_ID = 'eduflow-crm'
export const BACKUP_FILE_PREFIX = 'eduflow-zaxira'
// CSV/Excel hisobotlari: "eduflow-mijozlar-2026-11-02.csv"
export const EXPORT_FILE_PREFIX = 'eduflow'

// Sahifa sarlavhasi: "Mijozlar · EduFlow CRM"
export function pageTitle(section: string): string {
  return `${section} · ${APP_NAME}`
}

