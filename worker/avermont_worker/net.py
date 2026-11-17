"""HTTP com retentativas exponenciais, timeout e cache em disco para downloads grandes."""
from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import CACHE_DIR, USER_AGENT

log = logging.getLogger("avermont.net")

_session: requests.Session | None = None


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        retry = Retry(
            total=4,
            backoff_factor=1.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.headers["User-Agent"] = USER_AGENT
        _session = s
    return _session


def get_json(url: str, params: dict | None = None, timeout: int = 60):
    r = session().get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return r.json()


def get_text(url: str, params: dict | None = None, timeout: int = 60) -> str:
    r = session().get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return r.text


def download(url: str, max_age_hours: float = 12, timeout: int = 300) -> Path:
    """Baixa para o cache; reutiliza o arquivo se tiver menos de `max_age_hours`."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + "_" + url.rsplit("/", 1)[-1].split("?")[0]
    path = CACHE_DIR / name
    if path.exists() and (time.time() - path.stat().st_mtime) < max_age_hours * 3600:
        log.info("cache hit %s", url)
        return path
    log.info("download %s", url)
    with session().get(url, stream=True, timeout=timeout) as r:
        r.raise_for_status()
        tmp = path.with_suffix(path.suffix + ".part")
        with open(tmp, "wb") as fh:
            for chunk in r.iter_content(1 << 20):
                fh.write(chunk)
        tmp.replace(path)
    return path
