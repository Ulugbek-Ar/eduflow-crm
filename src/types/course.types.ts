export type CourseType = 'course' | 'service'

export type CourseStatus = 'active' | 'archived'

// v6: Sozlamalardagi oddiy kurslar ro'yxati o'rniga to'liq entity.
// Lid qiziqqan kursga nom orqali bog'lanadi (Customer.course); kurs nomi o'zgarsa, mijozlardagi nom ham yangilanadi.
// v11: faol guruhlar soni saqlanmaydi — guruhlardan hisoblanadi (utils/groups.ts)
export interface Course {
  id: string
  name: string
  type: CourseType
  // Davomiyligi, oy
  durationMonths: number
  // Oylik narx (asosiy valyutada); 0 — narx hali kiritilmagan
  monthlyPrice: number
  status: CourseStatus
  createdAt: string
  updatedAt?: string
}

export type CourseInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt'>
