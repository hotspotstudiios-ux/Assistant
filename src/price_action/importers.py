from __future__ import annotations

import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

from .models import Candle


_TIMESTAMP_FORMATS = (
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S",
)


def _parse_timestamp(value: str) -> datetime:
    value = value.strip()
    for fmt in _TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    return datetime.fromisoformat(value)


def _first(row: dict[str, str], *names: str, default: str = "") -> str:
    normalized = {k.strip().lower().strip("<>"): v for k, v in row.items() if k}
    for name in names:
        if name.lower() in normalized and normalized[name.lower()] not in (None, ""):
            return str(normalized[name.lower()])
    return default


def read_mt5_csv(
    path: str,
    symbol: str,
    timeframe: str = "M1",
    broker_offset_minutes: int = 0,
    normalize_to_utc: bool = False,
) -> list[Candle]:
    """
    Read an MT5-style OHLC CSV.

    Supports common MT5 headers such as:
    <DATE>, <TIME>, <OPEN>, <HIGH>, <LOW>, <CLOSE>, <TICKVOL>, <VOL>
    and ordinary date/time/open/high/low/close CSVs.

    broker_offset_minutes describes broker/server time relative to UTC.
    When normalize_to_utc=True, timestamps are shifted back by that offset.
    The original offset is still stored on every Candle.
    """
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(path)

    with source.open("r", encoding="utf-8-sig", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel

        reader = csv.DictReader(fh, dialect=dialect)
        candles: list[Candle] = []

        for row in reader:
            date_value = _first(row, "date")
            time_value = _first(row, "time")
            timestamp_value = _first(row, "timestamp", "datetime")

            if timestamp_value:
                ts = _parse_timestamp(timestamp_value)
            elif date_value:
                ts = _parse_timestamp(
                    f"{date_value} {time_value}".strip()
                )
            else:
                raise ValueError("CSV requires DATE+TIME or TIMESTAMP/DATETIME columns")

            if normalize_to_utc:
                ts = ts - timedelta(minutes=broker_offset_minutes)

            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    timestamp=ts,
                    open=float(_first(row, "open")),
                    high=float(_first(row, "high")),
                    low=float(_first(row, "low")),
                    close=float(_first(row, "close")),
                    volume=float(_first(row, "tickvol", "volume", "vol", default="0")),
                    broker_offset_minutes=broker_offset_minutes,
                )
            )

    candles.sort(key=lambda c: c.timestamp)
    return candles
