#!/usr/bin/env python3
"""
daily.py - Surface snippets from inbox.md for today's editing session.

Usage:
    python daily.py            # create/open today's session
    python daily.py --list     # show all snippets in inbox
    python daily.py --count    # show inbox snippet count
"""

import sys
import os
import random
from datetime import date
from pathlib import Path

SNIPPETS_PER_SESSION = 5
INBOX_FILE = "inbox.md"
SESSIONS_DIR = "sessions"


def parse_inbox():
    path = Path(INBOX_FILE)
    if not path.exists():
        print(f"No {INBOX_FILE} found. Create one and add snippets separated by ---")
        sys.exit(1)

    text = path.read_text(encoding="utf-8")
    raw = [s.strip() for s in text.split("\n---\n")]
    # Filter out empty blocks and the header comment block
    snippets = [s for s in raw if s and not s.startswith("#")]
    return snippets


def mulberry32(seed):
    """Same algorithm as editor.html so web and local picks always match."""
    def rand():
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((seed ^ (seed >> 15)) * (1 | seed)) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t))) & 0xFFFFFFFF
        t = t ^ (t >> 14)
        return (t & 0xFFFFFFFF) / 4294967296
    return rand


def pick_for_day(snippets, today=None):
    if today is None:
        today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    rand = mulberry32(seed)
    count = len(snippets)
    if count == 0:
        return []
    indices = list(range(count))
    for i in range(count - 1, 0, -1):
        j = int(rand() * (i + 1))
        indices[i], indices[j] = indices[j], indices[i]
    chosen = sorted(indices[:SNIPPETS_PER_SESSION])
    return [(i, snippets[i]) for i in chosen]


def format_session(picked, today_str):
    lines = [
        f"# Editing Session — {today_str}",
        "",
        f"*{len(picked)} snippets from your inbox. Work on each one — cut, sharpen, rewrite, or mark it done.*",
        "",
    ]

    for n, (idx, raw_text) in enumerate(picked, 1):
        quoted = "\n".join(f"> {line}" if line else ">" for line in raw_text.splitlines())
        lines += [
            "---",
            "",
            f"## {n} of {len(picked)}",
            "",
            "**Raw:**",
            "",
            quoted,
            "",
            "**Edited:**",
            "",
            "",
            "",
        ]

    lines.append("---")
    return "\n".join(lines)


def run():
    if "--list" in sys.argv:
        snippets = parse_inbox()
        for i, s in enumerate(snippets, 1):
            preview = s.splitlines()[0][:80]
            print(f"{i:3}. {preview}")
        print(f"\n{len(snippets)} total snippets in inbox.")
        return

    if "--count" in sys.argv:
        snippets = parse_inbox()
        print(f"{len(snippets)} snippets in inbox.")
        return

    today = date.today()
    today_str = today.strftime("%Y-%m-%d")
    session_path = Path(SESSIONS_DIR) / f"{today_str}.md"

    if session_path.exists():
        print(f"Session for today already exists: {session_path}")
        print("Open it to keep editing.")
        return

    snippets = parse_inbox()
    if not snippets:
        print("Your inbox is empty. Add some snippets to inbox.md first.")
        sys.exit(1)

    picked = pick_for_day(snippets, today)
    Path(SESSIONS_DIR).mkdir(exist_ok=True)
    session_path.write_text(format_session(picked, today_str), encoding="utf-8")

    print(f"Today's session: {session_path}")
    print(f"{len(picked)} snippets ready to edit.")
    print()
    for _, (_, text) in enumerate(picked):
        print(f"  • {text.splitlines()[0][:70]}")


if __name__ == "__main__":
    run()
