"""Telegram handlerlari.

Rejimlar:
- chat       — oddiy AI suhbat (xotira bilan)
- translate  — tarjimon (matn, ovoz va rasmdagi matn tanlangan tilga tarjima qilinadi)
Rasm har qanday rejimda qabul qilinadi.
"""

from __future__ import annotations

import html
import json
import logging

import groq
from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message, User
from aiogram.utils.chat_action import ChatActionSender
from aiogram.utils.keyboard import InlineKeyboardBuilder

from . import ai, config, storage
from .formatting import md_to_html, split_text

log = logging.getLogger(__name__)
router = Router()


class QuizStates(StatesGroup):
    topic = State()


# ============================================================
# Matnlar
# ============================================================
WELCOME = (
    "👋 Salom, <b>{name}</b>! Men <b>Lumi</b> — aqlli yordamchingiz.\n\n"
    "💬 Istalgan savolingizni yozing yoki 🎤 ovozli xabar yuboring — javob beraman.\n"
    "📷 Masala, hujjat yoki skrinshot rasmini yuboring — yechib, tushuntirib beraman.\n"
    "🌐 /tarjima — matn va ovozni 5 tilga tarjima qilaman.\n"
    "📚 /soz — har safar bitta foydali inglizcha so'z.\n"
    "📝 /test — istalgan mavzu bo'yicha test tuzib beraman.\n\n"
    "Quyidagi tugmalardan ham foydalanishingiz mumkin 👇"
)

HELP = (
    "<b>Lumi — yordam</b>\n\n"
    "💬 <b>Savol-javob</b> — shunchaki yozing yoki ovozli xabar yuboring. "
    "Men suhbatni eslab qolaman, shuning uchun davomli savollar berishingiz mumkin.\n"
    "📷 <b>/rasm</b> — rasm yuboring (buyruqsiz ham bo'ladi). Masala bo'lsa bosqichma-bosqich yechaman, "
    "hujjat bo'lsa mazmunini tushuntiraman. Rasm izohiga savolingizni yozsangiz, shunga javob beraman.\n"
    "🌐 <b>/tarjima</b> — tilni tanlang, so'ng matn yoki ovoz yuboring.\n"
    "📚 <b>/soz</b> — foydali inglizcha so'z: talaffuz, ma'no va misollar.\n"
    "📝 <b>/test</b> <i>mavzu</i> — mavzu bo'yicha 5 ta test savoli.\n"
    "🔄 <b>/yangi</b> — suhbat xotirasini tozalash."
)

RASM_HINT = (
    "📷 Rasm yuboring — masala, misol, test, hujjat yoki matn.\n\n"
    "• Masala bo'lsa — bosqichma-bosqich yechib beraman.\n"
    "• Hujjat yoki matn bo'lsa — o'qib, mazmunini tushuntiraman.\n"
    "• Savolingiz bo'lsa — rasm izohiga (caption) yozing."
)

ERROR_TEXT = "😔 Kechirasiz, hozir javob bera olmadim. Birozdan keyin qayta urinib ko'ring."
BUSY_TEXT = "⏳ Hozir so'rovlar ko'p. Bir daqiqadan keyin qayta urinib ko'ring."


# ============================================================
# Klaviaturalar
# ============================================================
def main_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="📷 Rasmdan yechim", callback_data="menu:rasm")
    kb.button(text="🌐 Tarjimon", callback_data="menu:tarjima")
    kb.button(text="📚 Inglizcha so'z", callback_data="menu:soz")
    kb.button(text="📝 Test tuzish", callback_data="menu:test")
    kb.button(text="🔄 Yangi suhbat", callback_data="menu:new")
    kb.adjust(2, 2, 1)
    return kb.as_markup()


def lang_kb(current: str | None = None) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for code, (label, _) in config.LANGS.items():
        kb.button(text=("✅ " if code == current else "") + label, callback_data=f"tr:{code}")
    kb.button(text="❌ Tarjimadan chiqish", callback_data="tr:exit")
    kb.adjust(2, 2, 1, 1)
    return kb.as_markup()


def translate_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🔁 Tilni almashtirish", callback_data="tr:menu")
    kb.button(text="❌ Tarjimadan chiqish", callback_data="tr:exit")
    kb.adjust(2)
    return kb.as_markup()


def word_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="➡️ Yana so'z", callback_data="soz:next")
    return kb.as_markup()


# ============================================================
# Yordamchilar
# ============================================================
async def send_answer(message: Message, text: str, reply_markup: InlineKeyboardMarkup | None = None) -> None:
    """AI javobini bo'laklab, HTML formatida yuboradi (xato bo'lsa — oddiy matn)."""
    chunks = split_text(text) or ["🤔 Javob bo'sh chiqdi. Savolni boshqacha yozib ko'ring."]
    for i, chunk in enumerate(chunks):
        markup = reply_markup if i == len(chunks) - 1 else None
        try:
            await message.answer(md_to_html(chunk), parse_mode="HTML", reply_markup=markup)
        except TelegramBadRequest:
            await message.answer(chunk, reply_markup=markup)


def error_text(e: Exception) -> str:
    if isinstance(e, groq.RateLimitError):
        return BUSY_TEXT
    return ERROR_TEXT


def target_label(code: str | None) -> tuple[str, str]:
    return config.LANGS.get(code or "", config.LANGS["en"])


async def download(bot: Bot, file) -> bytes:
    buf = await bot.download(file)
    return buf.read() if buf else b""


# ============================================================
# Buyruqlar
# ============================================================
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    storage.set_mode(message.from_user.id, "chat")
    name = html.escape(message.from_user.first_name or "do'stim")
    await message.answer(WELCOME.format(name=name), parse_mode="HTML", reply_markup=main_kb())


@router.message(Command("help"))
async def cmd_help(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(HELP, parse_mode="HTML", reply_markup=main_kb())


@router.message(Command("yangi"))
async def cmd_new(message: Message, state: FSMContext) -> None:
    await state.clear()
    storage.forget(message.from_user.id)
    await message.answer("🔄 Suhbat xotirasi tozalandi. Yangi savolingizni yozing!")


@router.message(Command("rasm"))
async def cmd_rasm(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(RASM_HINT)


@router.message(Command("tarjima"))
async def cmd_tarjima(message: Message, state: FSMContext) -> None:
    await state.clear()
    await show_lang_menu(message, message.from_user)


async def show_lang_menu(message: Message, user: User) -> None:
    _, current = storage.get_mode(user.id)
    await message.answer(
        "🌐 <b>Tarjimon</b>\nQaysi tilga tarjima qilay? Manba tilini o'zim aniqlayman.",
        parse_mode="HTML",
        reply_markup=lang_kb(current),
    )


@router.message(Command("soz"))
async def cmd_soz(message: Message, bot: Bot, state: FSMContext) -> None:
    await state.clear()
    await send_word(message, bot, message.from_user)


@router.message(Command("test"))
async def cmd_test(message: Message, bot: Bot, state: FSMContext, command: CommandObject) -> None:
    await state.clear()
    topic = (command.args or "").strip()
    if topic:
        await run_quiz(message, bot, message.from_user, topic)
    else:
        await ask_quiz_topic(message, state)


async def ask_quiz_topic(message: Message, state: FSMContext) -> None:
    await state.set_state(QuizStates.topic)
    await message.answer("📝 Qaysi mavzu bo'yicha test tuzay? Masalan: <i>fotosintez</i>, <i>Amir Temur</i>, <i>Present Perfect</i>.", parse_mode="HTML")


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    if message.from_user.id not in config.ADMIN_IDS:
        return
    s = storage.stats()
    await message.answer(
        f"📊 <b>Statistika</b>\nJami: {s['total']}\nOxirgi 24 soat: {s['day']}\nOxirgi 30 kun: {s['month']}",
        parse_mode="HTML",
    )


# ============================================================
# Callback tugmalar
# ============================================================
@router.callback_query(F.data.startswith("menu:"))
async def cb_menu(cb: CallbackQuery, bot: Bot, state: FSMContext) -> None:
    await cb.answer()
    await state.clear()
    action = cb.data.split(":", 1)[1]
    if action == "rasm":
        await cb.message.answer(RASM_HINT)
    elif action == "tarjima":
        await show_lang_menu(cb.message, cb.from_user)
    elif action == "soz":
        await send_word(cb.message, bot, cb.from_user)
    elif action == "test":
        await ask_quiz_topic(cb.message, state)
    elif action == "new":
        storage.forget(cb.from_user.id)
        await cb.message.answer("🔄 Suhbat xotirasi tozalandi. Yangi savolingizni yozing!")


@router.callback_query(F.data.startswith("tr:"))
async def cb_translate(cb: CallbackQuery) -> None:
    code = cb.data.split(":", 1)[1]
    if code == "menu":
        await cb.answer()
        await show_lang_menu(cb.message, cb.from_user)
        return
    if code == "exit":
        storage.set_mode(cb.from_user.id, "chat")
        await cb.answer("Tarjima rejimi o'chirildi")
        await cb.message.answer("✅ Tarjimadan chiqdingiz. Endi oddiy AI rejimidaman — istalgan savolingizni yozing.", reply_markup=main_kb())
        return
    if code not in config.LANGS:
        await cb.answer()
        return
    storage.set_mode(cb.from_user.id, "translate", code)
    label = config.LANGS[code][0]
    await cb.answer(f"{label} tanlandi")
    try:
        await cb.message.edit_reply_markup(reply_markup=lang_kb(code))
    except TelegramBadRequest:
        pass
    await cb.message.answer(
        f"✅ Tarjima tili: <b>{label}</b>\nEndi matn yoki 🎤 ovozli xabar yuboring — shu tilga tarjima qilaman.",
        parse_mode="HTML",
        reply_markup=translate_kb(),
    )


@router.callback_query(F.data == "soz:next")
async def cb_word(cb: CallbackQuery, bot: Bot) -> None:
    await cb.answer()
    await send_word(cb.message, bot, cb.from_user)


# ============================================================
# /soz
# ============================================================
def render_word(w: dict) -> str:
    e = lambda v: html.escape(str(v or "")).strip()  # noqa: E731
    lines = [f"📚 <b>{e(w.get('word'))}</b>"]
    pron = " — ".join(x for x in (e(w.get("ipa")), e(w.get("pronunciation_uz"))) if x)
    if pron:
        lines.append(f"🔊 {pron}")
    meta = " · ".join(x for x in (e(w.get("part_of_speech")), e(w.get("level"))) if x)
    if meta:
        lines.append(f"🏷 <i>{meta}</i>")
    lines.append(f"\n🇺🇿 <b>Ma'nosi:</b> {e(w.get('meaning_uz'))}")
    examples = [x for x in (w.get("examples") or []) if isinstance(x, dict) and x.get("en")]
    if examples:
        lines.append("\n💬 <b>Misollar:</b>")
        for i, ex in enumerate(examples[:3], 1):
            lines.append(f"{i}. {e(ex.get('en'))}\n    <i>{e(ex.get('uz'))}</i>")
    syn = [e(s) for s in (w.get("synonyms") or []) if s]
    if syn:
        lines.append(f"\n🔗 <b>Sinonimlar:</b> {', '.join(syn[:5])}")
    if w.get("tip_uz"):
        lines.append(f"\n💡 {e(w.get('tip_uz'))}")
    return "\n".join(lines)


async def send_word(message: Message, bot: Bot, user: User) -> None:
    async with ChatActionSender.typing(bot=bot, chat_id=message.chat.id):
        try:
            w = await ai.english_word(storage.recent_words(user.id))
        except (json.JSONDecodeError, ValueError) as e:
            log.warning("/soz JSON xatosi: %s", e)
            await message.answer(ERROR_TEXT)
            return
        except Exception as e:
            log.exception("/soz xatosi")
            await message.answer(error_text(e))
            return
    storage.add_word(user.id, str(w["word"]))
    await message.answer(render_word(w), parse_mode="HTML", reply_markup=word_kb())


# ============================================================
# /test
# ============================================================
async def run_quiz(message: Message, bot: Bot, user: User, topic: str) -> None:
    async with ChatActionSender.typing(bot=bot, chat_id=message.chat.id):
        try:
            quiz = await ai.make_quiz(topic[:200], user.language_code)
        except Exception as e:
            log.exception("/test xatosi")
            await message.answer(error_text(e))
            return
    if not quiz:
        await message.answer("🤔 Bu mavzu bo'yicha test tuza olmadim. Mavzuni aniqroq yozib ko'ring.")
        return
    await message.answer(f"📝 <b>{html.escape(topic)}</b> — {len(quiz)} ta savol. Omad!", parse_mode="HTML")
    for i, q in enumerate(quiz, 1):
        try:
            await bot.send_poll(
                chat_id=message.chat.id,
                question=f"{i}. {q['question']}"[:300],
                options=q["options"],
                type="quiz",
                correct_option_id=q["correct"],
                explanation=q["explanation"],
            )
        except TelegramBadRequest as e:
            log.warning("Savolni yuborib bo'lmadi: %s", e)


@router.message(QuizStates.topic, F.text & ~F.text.startswith("/"))
async def quiz_topic(message: Message, bot: Bot, state: FSMContext) -> None:
    await state.clear()
    await run_quiz(message, bot, message.from_user, message.text)


# ============================================================
# Rasm (har qanday rejimda)
# ============================================================
@router.message(F.photo | (F.document & F.document.mime_type.startswith("image/")))
async def on_image(message: Message, bot: Bot, state: FSMContext) -> None:
    await state.clear()
    user = message.from_user
    if message.photo:
        file, mime, size = message.photo[-1], "image/jpeg", message.photo[-1].file_size or 0
    else:
        file, mime, size = message.document, message.document.mime_type, message.document.file_size or 0
    if size > config.MAX_IMAGE_BYTES:
        await message.answer("📷 Rasm juda katta (4 MB dan ortiq). Uni oddiy rasm (fayl emas) qilib yuboring.")
        return

    mode, target = storage.get_mode(user.id)
    translating = mode == "translate"
    label, target_name = target_label(target)
    caption = (message.caption or "").strip() or None

    async with ChatActionSender.typing(bot=bot, chat_id=message.chat.id):
        try:
            data = await download(bot, file)
            answer = await ai.analyze_image(
                data, mime, caption, user.language_code, translate_to=target_name if translating else None
            )
        except Exception as e:
            log.exception("Rasm tahlilida xato")
            await message.answer(error_text(e))
            return

    if translating:
        await send_answer(message, f"🌐 {label}\n\n{answer}", translate_kb())
    else:
        storage.remember(user.id, f"[Foydalanuvchi rasm yubordi] {caption or ''}".strip(), answer)
        await send_answer(message, answer)


# ============================================================
# Ovoz
# ============================================================
@router.message(F.voice | F.audio | F.video_note)
async def on_voice(message: Message, bot: Bot, state: FSMContext) -> None:
    await state.clear()
    user = message.from_user
    media = message.voice or message.audio or message.video_note
    if (media.file_size or 0) > config.MAX_AUDIO_BYTES:
        await message.answer("🎤 Fayl juda katta (20 MB dan ortiq). Qisqaroq xabar yuboring.")
        return
    filename = "voice.ogg" if message.voice else ("video.mp4" if message.video_note else (message.audio.file_name or "audio.mp3"))

    async with ChatActionSender.typing(bot=bot, chat_id=message.chat.id):
        try:
            text = await ai.transcribe(await download(bot, media), filename)
        except Exception as e:
            log.exception("Whisper xatosi")
            await message.answer(error_text(e))
            return
        if not text:
            await message.answer("🎤 Ovozdan matn ajrata olmadim. Aniqroq gapirib, qayta yuboring.")
            return
        await handle_text(message, user, text, from_voice=True)


# ============================================================
# Matn
# ============================================================
@router.message(F.text & ~F.text.startswith("/"))
async def on_text(message: Message, bot: Bot) -> None:
    async with ChatActionSender.typing(bot=bot, chat_id=message.chat.id):
        await handle_text(message, message.from_user, message.text)


async def handle_text(message: Message, user: User, text: str, from_voice: bool = False) -> None:
    mode, target = storage.get_mode(user.id)
    heard = f"🎤 <i>{html.escape(text)}</i>\n\n" if from_voice else ""

    if mode == "translate":
        label, target_name = target_label(target)
        try:
            result = await ai.translate(text, target_name)
        except Exception as e:
            log.exception("Tarjima xatosi")
            await message.answer(error_text(e))
            return
        if heard:
            await message.answer(heard.rstrip(), parse_mode="HTML")
        chunks = split_text(result) or ["🤔 Tarjima bo'sh chiqdi. Matnni qayta yuboring."]
        for i, chunk in enumerate(chunks):
            await message.answer(
                (f"{label}\n\n" if i == 0 else "") + chunk,
                reply_markup=translate_kb() if i == len(chunks) - 1 else None,
            )
        return

    try:
        answer = await ai.chat(storage.history(user.id), text, user.language_code)
    except Exception as e:
        log.exception("AI xatosi")
        await message.answer(error_text(e))
        return
    storage.remember(user.id, text, answer)
    if heard:
        await message.answer(heard.rstrip(), parse_mode="HTML")
    await send_answer(message, answer)


@router.message(F.text.startswith("/"))
async def unknown_command(message: Message) -> None:
    await message.answer("🤷 Bunday buyruq yo'q. /help — barcha imkoniyatlar.")
