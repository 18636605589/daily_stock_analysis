# -*- coding: utf-8 -*-
"""Utilities for explicit LiteLLM client lifecycle cleanup."""

import asyncio
import inspect
import logging
from typing import Any, Iterable, Set


logger = logging.getLogger(__name__)


def _iter_litellm_cached_clients() -> Iterable[Any]:
    """Yield clients currently held by LiteLLM's in-memory client cache."""
    try:
        import litellm
    except Exception:
        return []

    cache = getattr(litellm, "in_memory_llm_clients_cache", None)
    cache_dict = getattr(cache, "cache_dict", None)
    if not isinstance(cache_dict, dict):
        return []
    return list(cache_dict.values())


def _run_close_coro(coro: Any) -> None:
    """Run an async close coroutine from a synchronous shutdown path."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = None

    if loop and not loop.is_closed() and not loop.is_running():
        loop.run_until_complete(coro)
        return

    if loop and loop.is_running():
        logger.debug("Skipping async LiteLLM client close because event loop is still running")
        return

    asyncio.run(coro)


def _close_client(client: Any, seen: Set[int]) -> None:
    """Close one cached client and its wrapped httpx client, if present."""
    if client is None or id(client) in seen:
        return

    for candidate in (client, getattr(client, "client", None)):
        if candidate is None or id(candidate) in seen:
            continue
        seen.add(id(candidate))

        close = getattr(candidate, "close", None)
        if callable(close):
            result = close()
            if inspect.isawaitable(result):
                _run_close_coro(result)
            continue

        aclose = getattr(candidate, "aclose", None)
        if callable(aclose):
            result = aclose()
            if inspect.isawaitable(result):
                _run_close_coro(result)


def close_litellm_clients() -> None:
    """Close LiteLLM/httpx cached clients before Python starts tearing logging down."""
    clients = list(_iter_litellm_cached_clients())
    if not clients:
        return

    seen: Set[int] = set()
    for client in clients:
        try:
            _close_client(client, seen)
        except Exception as exc:
            logger.debug("Failed to close LiteLLM client cleanly: %s", exc)

    try:
        import litellm

        cache = getattr(litellm, "in_memory_llm_clients_cache", None)
        flush_cache = getattr(cache, "flush_cache", None)
        if callable(flush_cache):
            flush_cache()
    except Exception as exc:
        logger.debug("Failed to flush LiteLLM client cache: %s", exc)
