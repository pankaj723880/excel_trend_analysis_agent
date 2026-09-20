"""Gemini API Key Rotator & Fallback Client Manager.

Supports rotating through a pool of 10+ Gemini API keys.
If any API key fails (quota exceeded, rate limit 429, invalid key, network timeout),
the system automatically falls back to the next working key in the pool seamlessly.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any

logger = logging.getLogger(__name__)

_KEY_LOCK = threading.Lock()
_CURRENT_KEY_INDEX = 0


def get_all_api_keys() -> list[str]:
    """Gathers all configured Gemini API keys from environment variables.

    Supports:
    - GEMINI_API_KEYS (comma-separated string)
    - GEMINI_API_KEY (comma-separated or single)
    - GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... GEMINI_API_KEY_10+
    """
    keys: list[str] = []

    # 1. Check GEMINI_API_KEYS (comma separated)
    raw_keys = os.environ.get("GEMINI_API_KEYS", "")
    if raw_keys:
        for k in raw_keys.split(","):
            cleaned = k.strip()
            if cleaned and cleaned not in keys:
                keys.append(cleaned)

    # 2. Check GEMINI_API_KEY (comma separated or single)
    single_or_multi = os.environ.get("GEMINI_API_KEY", "")
    if single_or_multi:
        for k in single_or_multi.split(","):
            cleaned = k.strip()
            if cleaned and cleaned not in keys:
                keys.append(cleaned)

    # 3. Check indexed env vars GEMINI_API_KEY_1 through GEMINI_API_KEY_20
    for idx in range(1, 21):
        idx_key = os.environ.get(f"GEMINI_API_KEY_{idx}", "").strip()
        if idx_key and idx_key not in keys:
            keys.append(idx_key)

    return keys


def _get_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def generate_content_with_fallback(
    prompt: str,
    temperature: float = 0.2,
    response_mime_type: str | None = None,
) -> str:
    """Generates content using Google GenAI SDK with multi-key fallback & model rotation.

    Iterates through all configured API keys (10+) and model aliases until a clean
    response is generated. Never crashes the application if at least 1 key works.
    """
    from google import genai

    keys = get_all_api_keys()
    if not keys:
        raise ValueError("No GEMINI_API_KEY configured in environment.")

    models_to_try = [_get_model(), "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    models = list(dict.fromkeys(models_to_try))

    global _CURRENT_KEY_INDEX
    with _KEY_LOCK:
        start_idx = _CURRENT_KEY_INDEX % len(keys)

    last_error: Exception | None = None

    # Try each key starting from current index
    for i in range(len(keys)):
        key_idx = (start_idx + i) % len(keys)
        api_key = keys[key_idx]

        try:
            client = genai.Client(api_key=api_key)

            for model_name in models:
                try:
                    config: dict[str, Any] = {"temperature": temperature}
                    if response_mime_type:
                        config["response_mime_type"] = response_mime_type

                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=config,
                    )
                    text = (response.text or "").strip()
                    if text:
                        # Update working key index on success
                        with _KEY_LOCK:
                            _CURRENT_KEY_INDEX = key_idx
                        return text
                except Exception as model_err:
                    last_error = model_err
                    # If error is quota or rate limit, break to next key
                    err_str = str(model_err).lower()
                    if any(token in err_str for token in ["quota", "429", "rate", "limit", "exhausted", "invalid"]):
                        break
                    continue
        except Exception as key_err:
            logger.warning(f"Gemini API key #{key_idx + 1} failed: {key_err}. Trying next key...")
            last_error = key_err
            continue

    if last_error:
        raise last_error
    return ""
