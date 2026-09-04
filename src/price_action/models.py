from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class Direction(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"


@dataclass(frozen=True)
class Candle:
    symbol: str
    timeframe: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    broker_offset_minutes: int = 0


@dataclass(frozen=True)
class Swing:
    timestamp: datetime
    price: float
    direction: Direction


@dataclass(frozen=True)
class Sweep:
    timestamp: datetime
    level_timestamp: datetime
    level_price: float
    direction: Direction
    depth: float


@dataclass(frozen=True)
class MSS:
    timestamp: datetime
    broken_level_timestamp: datetime
    broken_level_price: float
    direction: Direction


@dataclass(frozen=True)
class FVG:
    timestamp: datetime
    direction: Direction
    lower: float
    upper: float
    size: float
