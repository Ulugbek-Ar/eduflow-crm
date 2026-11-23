import { changeLang, getLang, LANG_LABELS } from '../../i18n'
import type { Lang } from '../../i18n'
import { cx } from '../../utils/cx'

const SHORT: Record<Lang, string> = { uz: 'O‘z', ru: 'Ру' }

// Kirish ekranlari uchun ixcham til tanlovi: O'z | Ру (tanlansa sahifa yangi tilda qayta ochiladi)
export function LanguageSwitch({ className }: { className?: string }) {
  const current = getLang()
  return (
    <div className={cx('segmented lang-switch', className)} role="group" aria-label="Til / Язык">
      {(Object.keys(LANG_LABELS) as Lang[]).map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={current === lang}
          aria-label={LANG_LABELS[lang]}
          title={LANG_LABELS[lang]}
          className={cx(current === lang && 'is-active')}
          onClick={() => current !== lang && changeLang(lang)}
        >
          {SHORT[lang]}
        </button>
      ))}
    </div>
  )
}
