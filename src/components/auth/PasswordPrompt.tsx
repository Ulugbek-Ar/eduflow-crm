import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface PasswordPromptProps {
  onChangeNow: () => void
  onLater: () => void
}

export function PasswordPrompt({ onChangeNow, onLater }: PasswordPromptProps) {
  return (
    <Modal
      title="Parolni almashtiring"
      onClose={onLater}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onLater}>
            Keyinroq
          </Button>
          <Button icon="lock" onClick={onChangeNow} data-autofocus>
            Hozir almashtirish
          </Button>
        </>
      }
    >
      <p className="confirm-message">
        Siz standart parol (admin123) bilan kirdingiz. Ma'lumotlaringizni himoya qilish uchun uni kamida 8 belgidan iborat yangi parolga
        almashtiring.
      </p>
    </Modal>
  )
}
