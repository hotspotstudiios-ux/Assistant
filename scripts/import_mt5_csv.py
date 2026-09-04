from __future__ import annotations

import argparse

from src.price_action import CandleStore
from src.price_action.importers import read_mt5_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Import MT5 OHLC candles into the local candle database.")
    parser.add_argument("csv_path")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframe", default="M1")
    parser.add_argument("--db", default="data/candles.db")
    parser.add_argument("--broker-offset-minutes", type=int, default=0)
    parser.add_argument(
        "--normalize-to-utc",
        action="store_true",
        help="Shift broker/server timestamps to UTC before storing them.",
    )
    args = parser.parse_args()

    candles = read_mt5_csv(
        args.csv_path,
        symbol=args.symbol,
        timeframe=args.timeframe,
        broker_offset_minutes=args.broker_offset_minutes,
        normalize_to_utc=args.normalize_to_utc,
    )

    store = CandleStore(args.db)
    count = store.upsert_many(candles)

    if candles:
        print(
            f"Imported {count:,} candles for {args.symbol} {args.timeframe}: "
            f"{candles[0].timestamp.isoformat()} -> {candles[-1].timestamp.isoformat()}"
        )
    else:
        print("No candles found.")


if __name__ == "__main__":
    main()
