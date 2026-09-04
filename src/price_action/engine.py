from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .detectors import detect_fvgs, detect_mss, detect_sweeps, detect_swings
from .models import Candle, FVG, MSS, Sweep, Swing


@dataclass(frozen=True)
class PriceActionAnalysis:
    swings: list[Swing]
    sweeps: list[Sweep]
    mss: list[MSS]
    fvgs: list[FVG]


class PriceActionEngine:
    def __init__(self, swing_left: int = 2, swing_right: int = 2) -> None:
        self.swing_left = swing_left
        self.swing_right = swing_right

    def analyze(self, candles: Sequence[Candle]) -> PriceActionAnalysis:
        swings = detect_swings(candles, self.swing_left, self.swing_right)
        sweeps = detect_sweeps(candles, swings)
        mss = detect_mss(candles, swings, sweeps)
        fvgs = detect_fvgs(candles)

        return PriceActionAnalysis(
            swings=swings,
            sweeps=sweeps,
            mss=mss,
            fvgs=fvgs,
        )
