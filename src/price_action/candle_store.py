from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, List

from .models import Candle


class CandleStore:
    def __init__(self, db_path: str = "data/candles.db") -> None:
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS candles (
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume REAL NOT NULL DEFAULT 0,
                    broker_offset_minutes INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (symbol, timeframe, timestamp)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_candles_lookup
                ON candles(symbol, timeframe, timestamp)
                """
            )

    def upsert_many(self, candles: Iterable[Candle]) -> int:
        rows = [
            (
                c.symbol,
                c.timeframe,
                c.timestamp.isoformat(),
                c.open,
                c.high,
                c.low,
                c.close,
                c.volume,
                c.broker_offset_minutes,
            )
            for c in candles
        ]

        if not rows:
            return 0

        with self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO candles (
                    symbol, timeframe, timestamp, open, high, low, close,
                    volume, broker_offset_minutes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, timeframe, timestamp)
                DO UPDATE SET
                    open = excluded.open,
                    high = excluded.high,
                    low = excluded.low,
                    close = excluded.close,
                    volume = excluded.volume,
                    broker_offset_minutes = excluded.broker_offset_minutes
                """,
                rows,
            )
        return len(rows)

    def load(
        self,
        symbol: str,
        timeframe: str,
        start_iso: str | None = None,
        end_iso: str | None = None,
    ) -> List[Candle]:
        clauses = ["symbol = ?", "timeframe = ?"]
        params: list[object] = [symbol, timeframe]

        if start_iso:
            clauses.append("timestamp >= ?")
            params.append(start_iso)
        if end_iso:
            clauses.append("timestamp <= ?")
            params.append(end_iso)

        query = f"""
            SELECT *
            FROM candles
            WHERE {' AND '.join(clauses)}
            ORDER BY timestamp ASC
        """

        from datetime import datetime

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()

        return [
            Candle(
                symbol=row["symbol"],
                timeframe=row["timeframe"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                open=row["open"],
                high=row["high"],
                low=row["low"],
                close=row["close"],
                volume=row["volume"],
                broker_offset_minutes=row["broker_offset_minutes"],
            )
            for row in rows
        ]
