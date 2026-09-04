from pathlib import Path

from src.price_action.importers import read_mt5_csv


def test_mt5_csv_import_and_broker_offset(tmp_path: Path):
    source = tmp_path / "nas100.csv"
    source.write_text(
        "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\n"
        "2026.09.03\t09:00:00\t100\t102\t99\t101\t50\n",
        encoding="utf-8",
    )

    candles = read_mt5_csv(
        str(source),
        symbol="NAS100",
        timeframe="M1",
        broker_offset_minutes=180,
        normalize_to_utc=True,
    )

    assert len(candles) == 1
    assert candles[0].timestamp.hour == 6
    assert candles[0].broker_offset_minutes == 180
    assert candles[0].close == 101
