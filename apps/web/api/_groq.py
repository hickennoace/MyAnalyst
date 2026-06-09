"""Tiny Groq (OpenAI-compatible) chat helper over stdlib urllib — no SDK dependency.

Shared by the conclusions and ask-your-data endpoints. Returns None when no key is set or the call fails,
so every caller can degrade gracefully (the product never depends on paid LLM capacity).
"""
from __future__ import annotations

import json
import os
import urllib.request


def available() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def chat(messages: list[dict], *, json_mode: bool = True, temperature: float = 0.4, max_tokens: int = 1600) -> str | None:
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return None
    model = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
    base = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    body: dict = {"model": model, "messages": messages, "temperature": temperature}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if "gpt-oss" in model:  # reasoning model: keep thinking fast + hidden, don't starve the answer
        body["reasoning_effort"] = "low"
        body["max_tokens"] = max_tokens
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))["choices"][0]["message"]["content"]
    except Exception:
        return None
