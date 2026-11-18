// Filial (v12): markazning alohida manzili. Guruh, o'quvchi va to'lov filialga biriktiriladi; xodimni bitta filialga
// cheklash mumkin — u faqat shu filial ma'lumotini ko'radi (bulutda RLS bilan ham). Filial o'chirilmaydi, arxivlanadi
// (ishlatilmagan filialni o'chirish mumkin)
export type BranchStatus = 'active' | 'archived'

export interface Branch {
  id: string
  name: string
  // '' — ko'rsatilmagan
  address: string
  phone: string
  status: BranchStatus
  createdAt: string
  updatedAt?: string
}

export type BranchInput = Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>
