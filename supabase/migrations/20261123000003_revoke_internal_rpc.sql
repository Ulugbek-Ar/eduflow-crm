-- B-01 (QA 2026-11): write_audit(p_org, …) faqat ichki (SECURITY DEFINER funksiyalar va triggerlar) — tashqaridan chaqirilsa
-- istalgan markaz jurnaliga soxta yozuv qo'shish mumkin edi. Ilova jurnalga log_event orqali yozadi.
revoke execute on function public.write_audit(uuid, text, text, text) from public, anon, authenticated;

-- Trigger funksiyalari RPC sifatida kerak emas (trigger ishlashiga EXECUTE huquqi ta'sir qilmaydi)
revoke execute on function public.audit_row(), public.outbox_attendance(), public.outbox_payment(), public.guard_soft_delete()
  from public, anon, authenticated;

-- Anon (ochiq kalit) kirmagan foydalanuvchi — ichki RPC'lar faqat kirgan xodimga
revoke execute on function
  public.create_organization(text, text, text), public.log_event(text, text, text), public.import_backup(jsonb),
  public.trash_move(text, text[]), public.trash_restore(text, text[]), public.update_own_profile(text, text),
  public.update_staff(uuid, app_role, text, text, text), public.owner_list_orgs(),
  public.owner_update_org(uuid, plan_id, text, timestamptz, timestamptz), public.touch_login(), public.password_changed()
  from public, anon;
grant execute on function
  public.create_organization(text, text, text), public.log_event(text, text, text), public.import_backup(jsonb),
  public.trash_move(text, text[]), public.trash_restore(text, text[]), public.update_own_profile(text, text),
  public.update_staff(uuid, app_role, text, text, text), public.owner_list_orgs(),
  public.owner_update_org(uuid, plan_id, text, timestamptz, timestamptz), public.touch_login(), public.password_changed()
  to authenticated;
