from __future__ import annotations

import argparse

from src.price_action import CandleStore, PriceActionEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze stored candles for price-action events.")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframe", default="M1")
    parser.add_argument("--db", default="data/candles.db")
    parser.add_argument("--start")
    parser.add_argument("--end")
    args = parser.parse_args()

    candles = CandleStore(args.db).load(
        args.symbol,
        args.timeframe,
        start_iso=args.start,
        end_iso=args.end,
    )
    analysis = PriceActionEngine().analyze(candles)

    print(f"Candles: {len(candles):,}")
    print(f"Swings:  {len(analysis.swings):,}")
    print(f"Sweeps:  {len(analysis.sweeps):,}")
    print(f"MSS:     {len(analysis.mss):,}")
    print(f"FVGs:    {len(analysis.fvgs):,}")


if __name__ == "__main__":
    main()
