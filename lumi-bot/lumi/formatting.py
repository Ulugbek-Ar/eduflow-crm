"""AI javobidagi Markdown'ni Telegram HTML'iga xavfsiz o'tkazish va uzun matnni bo'lish."""

from __future__ import annotations

import html
import re

from . import config

_CODE_BLOCK = re.compile(r"```[a-zA-Z0-9_+-]*\n?(.*?)```", re.S)
_INLINE_CODE = re.compile(r"`([^`\n]+)`")
_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__", re.S)
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$", re.M)
_BULLET = re.compile(r"^(\s*)[*+]\s+", re.M)


def md_to_html(text: str) -> str:
    blocks: list[str] = []

    def stash(m: re.Match) -> str:
        blocks.append(f"<pre>{html.escape(m.group(1).rstrip(), quote=False)}</pre>")
        return f"\x00{len(blocks) - 1}\x00"

    text = _CODE_BLOCK.sub(stash, text)
    text = html.escape(text, quote=False)
    text = _INLINE_CODE.sub(lambda m: f"<code>{m.group(1)}</code>", text)
    text = _HEADING.sub(lambda m: f"<b>{m.group(1)}</b>", text)
    text = _BOLD.sub(lambda m: f"<b>{m.group(1) or m.group(2)}</b>", text)
    text = _BULLET.sub(lambda m: f"{m.group(1)}• ", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: blocks[int(m.group(1))], text)


def split_text(text: str, limit: int = config.TG_CHUNK) -> list[str]:
    """Matnni paragraf/qator chegarasida bo'ladi; kod bloklarini o'rtasidan kesmaslikka harakat qiladi."""
    text = text.strip()
    if len(text) <= limit:
        return [text] if text else []
    chunks: list[str] = []
    while len(text) > limit:
        cut = text.rfind("\n\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut <= 0:
            cut = limit
        piece = text[:cut]
        # Kod bloki ochiq qolsa, uni yopib keyingi bo'lakda qayta ochamiz
        if piece.count("```") % 2 == 1:
            piece += "\n```"
            text = "```\n" + text[cut:].lstrip("\n")
        else:
            text = text[cut:].lstrip()
        chunks.append(piece.strip())
    if text:
        chunks.append(text)
    return chunks
