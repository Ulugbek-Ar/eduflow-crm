# Lumi — aqlli Telegram yordamchi

Groq asosidagi Telegram bot. Asosiy vazifasi — istalgan savolga javob berish; qolgan funksiyalar shu atrofida qurilgan.

## Imkoniyatlar

| Buyruq | Nima qiladi |
|---|---|
| matn yozish | 💬 AI javob beradi, suhbatni eslab qoladi (oxirgi 12 xabar) |
| 🎤 ovozli xabar | Whisper bilan matnga aylantiradi va javob beradi |
| 📷 rasm / `/rasm` | Masalani bosqichma-bosqich yechadi, hujjat/matnni tushuntiradi. Izoh (caption) savol sifatida olinadi |
| `/tarjima` | 🇺🇿 🇷🇺 🇬🇧 🇹🇷 🇰🇷 — til tanlanadi va eslab qolinadi. Matn, ovoz va rasmdagi matn tarjima qilinadi. «❌ Tarjimadan chiqish» — oddiy AI rejimiga qaytish |
| `/soz` | 📚 Foydali inglizcha so'z: IPA, o'zbekcha o'qilishi, ma'nosi, misollar, sinonimlar. Takrorlanmaydi |
| `/test mavzu` | 📝 Mavzu bo'yicha 5 ta Telegram quiz-savol |
| `/yangi` | 🔄 Suhbat xotirasini tozalash |
| `/stats` | 📊 Faqat `ADMIN_IDS` uchun: jami, 24 soat, 30 kunlik foydalanuvchilar |

Javoblar foydalanuvchi yozgan tilda beriladi.

## Ishga tushirish

```bash
cd lumi-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export BOT_TOKEN=...      # @BotFather'dan
export GROQ_API_KEY=...   # console.groq.com
python bot.py
```

Token va kalitlar faqat muhit o'zgaruvchilaridan o'qiladi, kodda yo'q. `.env` fayli `.gitignore`'da.

## Modellar

Model nomlari `lumi/config.py` boshida konstanta sifatida turadi va muhit o'zgaruvchisi bilan almashtiriladi:

- `VISION_MODEL` — `meta-llama/llama-4-scout-17b-16e-instruct` (`LUMI_VISION_MODEL`)
- `TEXT_MODEL` — `llama-3.3-70b-versatile` (`LUMI_TEXT_MODEL`)
- `WHISPER_MODEL` — `whisper-large-v3-turbo` (`LUMI_WHISPER_MODEL`)

Bot ishga tushganda Groq'ning `/models` endpointini tekshiradi. Sozlangan model ro'yxatda bo'lmasa, zaxira variantdan mavjudini tanlab, logga yozadi.

## Testlar

```bash
pip install pytest pytest-asyncio
python -m pytest -q
```

Testlar Telegram va Groq'ni soxtalashtiradi — token ham, kalit ham kerak emas.
