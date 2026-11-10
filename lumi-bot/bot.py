"""Lumi botini ishga tushirish: python bot.py

Kerakli muhit o'zgaruvchilari: BOT_TOKEN, GROQ_API_KEY.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware, Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, TelegramObject, User

from lumi import ai, config, storage
from lumi.handlers import router

COMMANDS = [
    BotCommand(command="start", description="Boshlash"),
    BotCommand(command="rasm", description="📷 Rasmdan yechim"),
    BotCommand(command="tarjima", description="🌐 Tarjimon"),
    BotCommand(command="soz", description="📚 Foydali inglizcha so'z"),
    BotCommand(command="test", description="📝 Mavzu bo'yicha test"),
    BotCommand(command="yangi", description="🔄 Yangi suhbat"),
    BotCommand(command="help", description="Yordam"),
]


class TouchUserMiddleware(BaseMiddleware):
    """Har bir xabarda foydalanuvchini bazaga yozadi (statistika uchun)."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user: User | None = data.get("event_from_user")
        if user and not user.is_bot:
            storage.touch(user.id)
        return await handler(event, data)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    missing = [name for name, value in (("BOT_TOKEN", config.BOT_TOKEN), ("GROQ_API_KEY", config.GROQ_API_KEY)) if not value]
    if missing:
        sys.exit(f"Muhit o'zgaruvchisi o'rnatilmagan: {', '.join(missing)}")

    storage.init()
    await ai.resolve_models()

    bot = Bot(config.BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())
    dp.update.outer_middleware(TouchUserMiddleware())
    dp.include_router(router)

    await bot.set_my_commands(COMMANDS)
    await bot.delete_webhook(drop_pending_updates=True)
    logging.info("Lumi ishga tushdi")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
