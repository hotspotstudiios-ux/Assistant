from datetime import datetime, timedelta

from src.price_action import Candle, PriceActionEngine


def candle(i, o, h, l, c):
    return Candle(
        symbol="NAS100",
        timeframe="M1",
        timestamp=datetime(2026, 9, 1, 9, 0) + timedelta(minutes=i),
        open=o,
        high=h,
        low=l,
        close=c,
    )


def test_engine_detects_core_events():
    candles = [
        candle(0, 100, 101, 99, 100),
        candle(1, 100, 102, 99.5, 101),
        candle(2, 101, 105, 100, 104),   # swing high candidate
        candle(3, 104, 104.5, 101, 102),
        candle(4, 102, 103, 100, 101),
        candle(5, 101, 106, 100.5, 104), # sweeps 105 and closes back below
        candle(6, 104, 104.2, 98, 99),   # bearish displacement / structure break
        candle(7, 99, 99.2, 95, 96),
    ]

    analysis = PriceActionEngine().analyze(candles)

    assert analysis.swings
    assert analysis.sweeps
    assert analysis.mss
