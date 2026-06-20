#!/usr/bin/env python3
"""Called by the GitHub Action to generate today's issue body."""

import random
from datetime import date
from pathlib import Path

SNIPPETS_PER_SESSION = 5
INBOX_FILE = "inbox.md"


def parse_inbox():
    path = Path(INBOX_FILE)
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    raw = [s.strip() for s in text.split("\n---\n")]
    return [s for s in raw if s and not s.startswith("#")]


def pick_for_day(snippets):
    today = date.today()
    seed = int(today.strftime("%Y%m%d"))
    rng = random.Random(seed)
    count = len(snippets)
    if count == 0:
        return []
    indices = rng.sample(range(count), min(SNIPPETS_PER_SESSION, count))
    return [(i, snippets[i]) for i in sorted(indices)]


snippets = parse_inbox()
picked = pick_for_day(snippets)

if not picked:
    print("_No snippets in inbox.md yet._")
else:
    lines = [
        f"**{len(picked)} snippets from your inbox. Edit each one — cut it, sharpen it, rewrite it.**",
        "",
        "Reply with your edited versions, or commit them to `sessions/`.",
        "",
    ]
    for n, (idx, text) in enumerate(picked, 1):
        quoted = "\n".join(f"> {line}" if line else ">" for line in text.splitlines())
        lines += [
            "---",
            "",
            f"### {n} of {len(picked)} &nbsp;&nbsp; *(inbox #{idx+1})*",
            "",
            quoted,
            "",
            "**Your edit:**",
            "",
            "",
        ]
    lines.append("---")
    print("\n".join(lines))
