"""Configuração central do worker. Tudo pode ser sobrescrito por variáveis de ambiente."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_DATA = Path(os.environ.get("AVERMONT_DATA_DIR", ROOT / "web" / "data"))
CATALOG_FILE = WEB_DATA / "catalog" / "instruments.json"
MARKET_DIR = WEB_DATA / "market"
SERIES_DIR = MARKET_DIR / "series"
CACHE_DIR = Path(os.environ.get("AVERMONT_CACHE_DIR", ROOT / "worker" / ".cache"))

# World Bank "Pink Sheet" — CC BY 4.0. A URL muda a cada edição mensal; atualize via env.
WORLDBANK_PINK_SHEET_URL = os.environ.get(
    "WORLDBANK_PINK_SHEET_URL",
    "https://thedocs.worldbank.org/en/doc/18675f1d1639c7a34d463f59263ba0a2-0050012025/related/CMO-Historical-Data-Monthly.xlsx",
)

BCB_SGS_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados"
BCB_OLINDA_PTAX = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"
BCB_OLINDA_FOCUS = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"
ECB_EXR_URL = "https://data-api.ecb.europa.eu/service/data/EXR"
CVM_BASE = "https://dados.cvm.gov.br/dados"

# Janela histórica para séries diárias (anos)
DAILY_HISTORY_YEARS = int(os.environ.get("AVERMONT_DAILY_YEARS", "10"))
# Meses de informe diário de fundos a baixar (cada arquivo ~11 MB)
FUND_MONTHS = int(os.environ.get("AVERMONT_FUND_MONTHS", "13"))

USER_AGENT = "AvermontDataWorker/0.1 (+https://github.com/; ingestao de dados publicos)"
