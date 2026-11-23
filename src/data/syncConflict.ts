// B-04: boshqa xodim serverda o'zgartirgan yozuv ustidan yozilmadi (supabase-js'siz — asosiy chunk'ka og'irlik qo'shmaydi)
export class SyncConflictError extends Error {
  readonly ids: string[]
  constructor(ids: string[]) {
    super(`conflict: ${ids.join(',')}`)
    this.ids = ids
  }
}
