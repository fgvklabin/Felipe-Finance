"""Validação de séries de preço antes da publicação.

Nunca altera valores silenciosamente: problemas são devolvidos como avisos e registrados.
Pontos inválidos (não positivos, não numéricos, datas duplicadas) são descartados e contados.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class ValidationReport:
    dropped: int = 0
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"dropped": self.dropped, "warnings": self.warnings[:20]}


def validate_points(points: list[tuple[str, float]], max_abs_log_jump: float = 0.6) -> tuple[list[tuple[str, float]], ValidationReport]:
    rep = ValidationReport()
    seen: set[str] = set()
    clean: list[tuple[str, float]] = []
    for d, v in sorted(points, key=lambda p: p[0]):
        if d in seen:
            rep.dropped += 1
            rep.warnings.append(f"data duplicada {d}")
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            rep.dropped += 1
            continue
        if not math.isfinite(fv) or fv <= 0:
            rep.dropped += 1
            continue
        seen.add(d)
        clean.append((d, fv))
    for (d0, v0), (d1, v1) in zip(clean, clean[1:]):
        jump = abs(math.log(v1 / v0))
        if jump > max_abs_log_jump:
            rep.warnings.append(f"variação extrema {d0}→{d1}: {v0:.4g}→{v1:.4g} (mantida, sinalizada)")
    return clean, rep
