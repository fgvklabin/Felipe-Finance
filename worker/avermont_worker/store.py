"""Leitura do catálogo e escrita atômica dos snapshots JSON consumidos pelo app."""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import CATALOG_FILE, MARKET_DIR, SERIES_DIR


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_catalog() -> dict:
    return json.loads(CATALOG_FILE.read_text(encoding="utf-8"))


def _clean(obj: Any) -> Any:
    """Converte NaN/inf em None e tipos numpy em nativos, recursivamente."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if hasattr(obj, "item") and not isinstance(obj, (str, bytes)):
        try:
            obj = obj.item()
        except Exception:
            pass
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(_clean(data), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_series(series_id: str, payload: dict) -> None:
    write_json(SERIES_DIR / f"{series_id}.json", payload)


def read_series(series_id: str) -> dict | None:
    return read_json(SERIES_DIR / f"{series_id}.json")


class IngestionLog:
    """Registro de execuções por fonte (alimenta o painel admin e os alertas de dados obsoletos)."""

    path = MARKET_DIR / "ingestion_log.json"

    def __init__(self) -> None:
        self.data = read_json(self.path, {"runs": {}})

    def record(self, source: str, ok: bool, rows: int = 0, error: str | None = None, latest_observation: str | None = None) -> None:
        prev = self.data["runs"].get(source, {})
        entry = {
            "source": source,
            "lastAttempt": now_iso(),
            "ok": ok,
            "rows": rows,
            "error": error,
            "latestObservation": latest_observation or prev.get("latestObservation"),
            "lastSuccess": now_iso() if ok else prev.get("lastSuccess"),
            "consecutiveFailures": 0 if ok else prev.get("consecutiveFailures", 0) + 1,
        }
        self.data["runs"][source] = entry

    def save(self) -> None:
        write_json(self.path, self.data)
