"""Lumi sozlamalari.

Token va kalitlar FAQAT muhit o'zgaruvchilaridan o'qiladi — kodga yozilmaydi.
"""

import os

# ============================================================
# Groq modellari (kerak bo'lsa muhit o'zgaruvchisi bilan almashtiring)
# Bot ishga tushganda Groq'ning /models endpointi tekshiriladi:
# bu nomlar ro'yxatda bo'lmasa, quyidagi zaxira variantlardan
# mavjudi avtomatik tanlanadi va logga yoziladi.
# ============================================================
VISION_MODEL = os.getenv("LUMI_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
TEXT_MODEL = os.getenv("LUMI_TEXT_MODEL", "llama-3.3-70b-versatile")
WHISPER_MODEL = os.getenv("LUMI_WHISPER_MODEL", "whisper-large-v3-turbo")

VISION_FALLBACKS = (
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
)
TEXT_FALLBACKS = (
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
)
WHISPER_FALLBACKS = (
    "whisper-large-v3-turbo",
    "whisper-large-v3",
)

# ============================================================
# Muhit o'zgaruvchilari
# ============================================================
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DB_PATH = os.getenv("LUMI_DB", "lumi.db")
# /stats buyrug'ini ko'ra oladigan adminlar: "123,456"
ADMIN_IDS = {int(x) for x in os.getenv("ADMIN_IDS", "").replace(" ", "").split(",") if x.isdigit()}

# ============================================================
# Cheklovlar
# ============================================================
HISTORY_LIMIT = 12  # suhbat xotirasida saqlanadigan oxirgi xabarlar soni
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # Groq base64 rasm chegarasi
MAX_AUDIO_BYTES = 20 * 1024 * 1024  # Telegram bot yuklab olish chegarasi
TG_CHUNK = 3800  # Telegram xabari 4096 belgidan oshmasligi uchun

# Tarjima tillari: kod -> (tugma matni, model uchun til nomi)
LANGS = {
    "uz": ("🇺🇿 O'zbek", "Uzbek (Latin script)"),
    "ru": ("🇷🇺 Rus", "Russian"),
    "en": ("🇬🇧 Ingliz", "English"),
    "tr": ("🇹🇷 Turk", "Turkish"),
    "ko": ("🇰🇷 Koreys", "Korean"),
}
