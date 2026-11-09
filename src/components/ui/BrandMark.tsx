import { BRAND_LOGO_URL } from '../../constants/app'
import { Icon } from '../../constants/navigation'

// Mahsulot (sayt) logosi: VITE_BRAND_LOGO berilsa — o'sha rasm, aks holda ichki belgi. Nom — APP_NAME
export function BrandMark({ size = 20 }: { size?: number }) {
  return BRAND_LOGO_URL ? <img src={BRAND_LOGO_URL} alt="" className="logo-image brand-logo" /> : <Icon name="logo" size={size} />
}
