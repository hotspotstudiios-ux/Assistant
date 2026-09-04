from __future__ import annotations

from typing import Iterable, List, Sequence

from .models import Candle, Direction, FVG, MSS, Sweep, Swing


def detect_swings(
    candles: Sequence[Candle],
    left: int = 2,
    right: int = 2,
) -> List[Swing]:
    swings: list[Swing] = []
    if len(candles) < left + right + 1:
        return swings

    for i in range(left, len(candles) - right):
        c = candles[i]
        before = candles[i - left : i]
        after = candles[i + 1 : i + right + 1]

        if all(c.high > x.high for x in before) and all(c.high >= x.high for x in after):
            swings.append(Swing(c.timestamp, c.high, Direction.BEARISH))

        if all(c.low < x.low for x in before) and all(c.low <= x.low for x in after):
            swings.append(Swing(c.timestamp, c.low, Direction.BULLISH))

    return swings


def detect_sweeps(
    candles: Sequence[Candle],
    swings: Iterable[Swing],
) -> List[Sweep]:
    by_time = {c.timestamp: c for c in candles}
    ordered = list(candles)
    sweeps: list[Sweep] = []

    for swing in swings:
        try:
            start_idx = next(i for i, c in enumerate(ordered) if c.timestamp > swing.timestamp)
        except StopIteration:
            continue

        for c in ordered[start_idx:]:
            if swing.direction == Direction.BEARISH:
                # Buy-side liquidity sweep: trade above swing high, close back below it.
                if c.high > swing.price and c.close < swing.price:
                    sweeps.append(
                        Sweep(
                            timestamp=c.timestamp,
                            level_timestamp=swing.timestamp,
                            level_price=swing.price,
                            direction=Direction.BEARISH,
                            depth=c.high - swing.price,
                        )
                    )
                    break
            else:
                # Sell-side liquidity sweep: trade below swing low, close back above it.
                if c.low < swing.price and c.close > swing.price:
                    sweeps.append(
                        Sweep(
                            timestamp=c.timestamp,
                            level_timestamp=swing.timestamp,
                            level_price=swing.price,
                            direction=Direction.BULLISH,
                            depth=swing.price - c.low,
                        )
                    )
                    break

    return sweeps


def detect_mss(
    candles: Sequence[Candle],
    swings: Sequence[Swing],
    sweeps: Sequence[Sweep],
) -> List[MSS]:
    ordered = list(candles)
    result: list[MSS] = []

    for sweep in sweeps:
        sweep_idx = next(
            (i for i, c in enumerate(ordered) if c.timestamp == sweep.timestamp),
            None,
        )
        if sweep_idx is None:
            continue

        prior_swings = [s for s in swings if s.timestamp < sweep.timestamp]

        if sweep.direction == Direction.BEARISH:
            candidates = [s for s in prior_swings if s.direction == Direction.BULLISH]
            if not candidates:
                continue
            level = candidates[-1]

            for c in ordered[sweep_idx + 1 :]:
                if c.close < level.price:
                    result.append(
                        MSS(
                            timestamp=c.timestamp,
                            broken_level_timestamp=level.timestamp,
                            broken_level_price=level.price,
                            direction=Direction.BEARISH,
                        )
                    )
                    break
        else:
            candidates = [s for s in prior_swings if s.direction == Direction.BEARISH]
            if not candidates:
                continue
            level = candidates[-1]

            for c in ordered[sweep_idx + 1 :]:
                if c.close > level.price:
                    result.append(
                        MSS(
                            timestamp=c.timestamp,
                            broken_level_timestamp=level.timestamp,
                            broken_level_price=level.price,
                            direction=Direction.BULLISH,
                        )
                    )
                    break

    return result


def detect_fvgs(candles: Sequence[Candle], min_size: float = 0.0) -> List[FVG]:
    fvgs: list[FVG] = []

    for i in range(2, len(candles)):
        first = candles[i - 2]
        third = candles[i]

        if third.low > first.high:
            lower = first.high
            upper = third.low
            size = upper - lower
            if size >= min_size:
                fvgs.append(
                    FVG(
                        timestamp=third.timestamp,
                        direction=Direction.BULLISH,
                        lower=lower,
                        upper=upper,
                        size=size,
                    )
                )

        if third.high < first.low:
            lower = third.high
            upper = first.low
            size = upper - lower
            if size >= min_size:
                fvgs.append(
                    FVG(
                        timestamp=third.timestamp,
                        direction=Direction.BEARISH,
                        lower=lower,
                        upper=upper,
                        size=size,
                    )
                )

    return fvgs
