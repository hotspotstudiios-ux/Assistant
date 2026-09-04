# SilverBulletAI — MT5 Bridge

This folder contains a **read-only** MetaTrader 5 Expert Advisor that sends M1 candle history to the web app.

## Install

1. Open MetaTrader 5 desktop.
2. File → Open Data Folder.
3. Open `MQL5/Experts`.
4. Copy `SilverBulletBridge.mq5` there.
5. Open MetaEditor and compile it.
6. In MT5 go to Tools → Options → Expert Advisors.
7. Enable **Allow WebRequest for listed URL**.
8. Add your deployed Vercel origin, e.g. `https://your-app.vercel.app`.
9. Attach the EA to the broker symbol you trade.
10. Set `ApiUrl` to `https://your-app.vercel.app/api/mt5/ingest`.

The bridge never sends trade commands. It only reads M1 candles and posts them to the analyzer.

## Authentication

Set `MT5_BRIDGE_TOKEN` in Vercel and put the same value in the EA's `BridgeToken` input.
