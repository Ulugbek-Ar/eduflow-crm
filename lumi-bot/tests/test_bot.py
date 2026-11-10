"""Oflayn testlar: Telegram va Groq soxta (mock) — kalit/token kerak emas."""

from __future__ import annotations

import datetime as dt
from typing import Any

import pytest
from aiogram import Bot, Dispatcher
from aiogram.client.session.base import BaseSession
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.methods import TelegramMethod
from aiogram.types import Chat, Message, Update, User

from lumi import ai, handlers, storage
from lumi.formatting import md_to_html, split_text


# ---------------- formatlash ----------------
def test_md_to_html_escapes_and_formats():
    out = md_to_html("## Sarlavha\n**Javob:** x < 5 & `a*b`\n* band")
    assert "<b>Sarlavha</b>" in out
    assert "<b>Javob:</b>" in out
    assert "x &lt; 5 &amp;" in out
    assert "<code>a*b</code>" in out
    assert "• band" in out


def test_md_code_block_kept_raw():
    out = md_to_html("```python\nif a < b:\n    print('**x**')\n```")
    assert out == "<pre>if a &lt; b:\n    print('**x**')</pre>"


def test_split_text_respects_limit_and_code_fences():
    text = "```\n" + "\n".join(f"line {i}" for i in range(2000)) + "\n```"
    parts = split_text(text, limit=500)
    assert all(len(p) <= 510 for p in parts)
    assert all(p.count("```") % 2 == 0 for p in parts)


# ---------------- soxta Telegram ----------------
class FakeSession(BaseSession):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[TelegramMethod] = []

    async def make_request(self, bot: Bot, method: TelegramMethod, timeout: int | None = None) -> Any:
        self.calls.append(method)
        name = type(method).__name__
        if name in {"SendMessage", "SendPoll"}:
            return Message(message_id=len(self.calls), date=dt.datetime.now(), chat=Chat(id=1, type="private"), text=getattr(method, "text", None) or "")
        if name == "GetFile":
            from aiogram.types import File
            return File(file_id="f", file_unique_id="u", file_path="photos/x.jpg")
        return True

    async def stream_content(self, url, headers=None, timeout=30, chunk_size=65536, raise_for_status=True):
        yield b"\xff\xd8fake-bytes"

    async def close(self) -> None:
        pass

    def texts(self) -> list[str]:
        return [m.text for m in self.calls if type(m).__name__ == "SendMessage"]


USER = User(id=42, is_bot=False, first_name="Ali", language_code="uz")


def msg(**kw) -> Update:
    base = dict(message_id=1, date=dt.datetime.now(), chat=Chat(id=1, type="private"), from_user=USER)
    base.update(kw)
    return Update(update_id=1, message=Message(**base))


@pytest.fixture
def env(tmp_path, monkeypatch):
    storage.init(str(tmp_path / "t.db"))
    storage.forget(USER.id)
    session = FakeSession()
    bot = Bot("123456:TEST", session=session)
    dp = Dispatcher(storage=MemoryStorage())
    handlers.router._parent_router = None  # testlar orasida qayta ulash uchun
    dp.include_router(handlers.router)

    calls: dict[str, list] = {"chat": [], "translate": [], "image": [], "transcribe": []}

    async def chat(history, text, lang):
        calls["chat"].append((list(history), text))
        return f"**Javob** {text}"

    async def translate(text, target):
        calls["translate"].append((text, target))
        return f"[{target}] {text}"

    async def analyze_image(data, mime, caption, lang, translate_to=None):
        calls["image"].append((data, mime, caption, translate_to))
        return "Yechim: 4"

    async def transcribe(data, filename):
        calls["transcribe"].append(filename)
        return "salom dunyo"

    monkeypatch.setattr(ai, "chat", chat)
    monkeypatch.setattr(ai, "translate", translate)
    monkeypatch.setattr(ai, "analyze_image", analyze_image)
    monkeypatch.setattr(ai, "transcribe", transcribe)
    return bot, dp, session, calls


async def test_chat_mode_with_memory(env):
    bot, dp, session, calls = env
    await dp.feed_update(bot, msg(text="2+2 nechchi?"))
    await dp.feed_update(bot, msg(text="nega?"))
    assert calls["chat"][1][0][0]["content"] == "2+2 nechchi?"  # xotira ishlaydi
    assert "<b>Javob</b> nega?" in session.texts()[-1]


async def test_translate_flow_and_exit(env):
    bot, dp, session, calls = env
    await dp.feed_update(bot, msg(text="/tarjima"))
    assert "Tarjimon" in session.texts()[-1]
    storage.set_mode(USER.id, "translate", "ko")  # tugma bosilgandek
    await dp.feed_update(bot, msg(text="Salom"))
    assert calls["translate"] == [("Salom", "Korean")]
    assert calls["chat"] == []
    assert "🇰🇷 Koreys" in session.texts()[-1]

    # ovoz -> whisper -> tarjima
    from aiogram.types import Voice
    await dp.feed_update(bot, msg(voice=Voice(file_id="v", file_unique_id="v", duration=2, file_size=1000)))
    assert calls["transcribe"] == ["voice.ogg"]
    assert calls["translate"][-1] == ("salom dunyo", "Korean")

    # chiqish
    storage.set_mode(USER.id, "chat")
    await dp.feed_update(bot, msg(text="Salom"))
    assert calls["chat"][-1][1] == "Salom"


async def test_translate_callbacks(env):
    bot, dp, session, calls = env
    from aiogram.types import CallbackQuery
    cbmsg = Message(message_id=5, date=dt.datetime.now(), chat=Chat(id=1, type="private"), text="menu")
    await dp.feed_update(bot, Update(update_id=2, callback_query=CallbackQuery(id="c", from_user=USER, chat_instance="i", data="tr:tr", message=cbmsg)))
    assert storage.get_mode(USER.id) == ("translate", "tr")
    await dp.feed_update(bot, Update(update_id=3, callback_query=CallbackQuery(id="c", from_user=USER, chat_instance="i", data="tr:exit", message=cbmsg)))
    assert storage.get_mode(USER.id) == ("chat", "tr")  # til eslab qolinadi
    assert "oddiy AI rejimi" in session.texts()[-1]


async def test_photo_without_command_and_caption(env):
    bot, dp, session, calls = env
    from aiogram.types import PhotoSize
    await dp.feed_update(bot, msg(photo=[PhotoSize(file_id="p", file_unique_id="p", width=800, height=600, file_size=50000)], caption="3-misolni yech"))
    data, mime, caption, tr = calls["image"][0]
    assert data.startswith(b"\xff\xd8") and mime == "image/jpeg" and caption == "3-misolni yech" and tr is None
    assert "Yechim: 4" in session.texts()[-1]


async def test_non_image_document_ignored_by_image_handler(env):
    bot, dp, session, calls = env
    from aiogram.types import Document
    await dp.feed_update(bot, msg(document=Document(file_id="d", file_unique_id="d", mime_type="application/pdf")))
    assert calls["image"] == []


async def test_quiz_validation(monkeypatch):
    async def fake_complete(*a, **k):
        return '{"questions": [{"question": "Q1", "options": ["a","b","c","d"], "correct": 2, "explanation": "x"}, {"question": "bad", "options": ["a"], "correct": 0}, {"question": "Q3", "options": ["a","b"], "correct": 5}]}'
    monkeypatch.setattr(ai, "_complete", fake_complete)
    quiz = await ai.make_quiz("tarix", "uz")
    assert len(quiz) == 1 and quiz[0]["correct"] == 2


def test_render_word():
    out = handlers.render_word({"word": "resilient", "ipa": "/rɪˈzɪliənt/", "meaning_uz": "chidamli <b>", "examples": [{"en": "She is resilient.", "uz": "U chidamli."}], "synonyms": ["tough"]})
    assert "<b>resilient</b>" in out and "&lt;b&gt;" in out and "She is resilient." in out
