export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <p className="notice notice-info draft-notice" role="status">
      Oldingi safar saqlanmay qolgan qoralama tiklandi.
      <button type="button" className="link-btn" onClick={onDiscard}>
        Tozalash
      </button>
    </p>
  )
}
