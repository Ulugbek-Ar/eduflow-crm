import { tr } from '../../i18n'
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <p className="notice notice-info draft-notice" role="status">
      {tr('Oldingi safar saqlanmay qolgan qoralama tiklandi.')}
      <button type="button" className="link-btn" onClick={onDiscard}>
        {tr('Tozalash')}
      </button>
    </p>
  )
}
