'use client';

import { useState } from 'react';
import { backtest, Candle } from '../lib/engine';

function parseCSV(text: string): Candle[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(x => x.trim().toLowerCase());
  const idx = (...names: string[]) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;

  const ti = idx('time', 'timestamp', 'datetime', 'date');
  const oi = idx('open');
  const hi = idx('high');
  const li = idx('low');
  const ci = idx('close');

  if ([ti, oi, hi, li, ci].some(i => i < 0)) {
    throw new Error('CSV needs: time, open, high, low, close');
  }

  return lines.slice(1)
    .map(line => {
      const c = line.split(',');
      return {
        time: c[ti].trim(),
        open: +c[oi],
        high: +c[hi],
        low: +c[li],
        close: +c[ci]
      };
    })
    .filter(x => x.time && [x.open, x.high, x.low, x.close].every(Number.isFinite));
}

export default function Home() {
  const [rows, setRows] = useState<Candle[]>([]);
  const [error, setError] = useState('');

  const eight = rows.length ? backtest(rows, 8) : [];
  const nine = rows.length ? backtest(rows, 9) : [];

  const Card = ({title, signals}:{title:string; signals:ReturnType<typeof backtest>}) => (
    <section>
      <h2>{title}</h2>
      {!rows.length ? (
        <p>Upload 1-minute candles.</p>
      ) : !signals.length ? (
        <p>No valid setup found.</p>
      ) : (
        <>
          <strong>{signals[0].direction} — {signals[0].result}</strong>
          <p>
            Entry {signals[0].entry.toFixed(2)} · SL {signals[0].stop.toFixed(2)} · TP 2R {signals[0].target2R.toFixed(2)}
          </p>
          <small>
            Sweep {new Date(signals[0].sweepTime).toLocaleString()}<br />
            MSS {new Date(signals[0].mssTime).toLocaleString()}
          </small>
        </>
      )}
    </section>
  );

  return (
    <main>
      <div className="head">
        <span className="pill">V0 REPLAY ENGINE</span>
        <h1>SilverBulletAI</h1>
        <p>Replay a session candle-by-candle and compare 8AM vs 9AM NY liquidity.</p>
      </div>

      <label className="upload">
        Upload 1-minute CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async e => {
            try {
              setError('');
              const f = e.target.files?.[0];
              if (f) setRows(parseCSV(await f.text()));
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Could not parse CSV');
            }
          }}
        />
      </label>

      {error && <p className="err">{error}</p>}

      <div className="grid">
        <Card title="8AM Liquidity Model" signals={eight} />
        <Card title="9AM Liquidity Model" signals={nine} />
      </div>

      <div className="note">
        <b>Current detector:</b> sweep + close back inside → 3-candle MSS → classic 3-candle FVG → midpoint entry → sweep extreme SL → 2R TP.
        We will tune these definitions against your actual chart examples before trusting live alerts.
      </div>
    </main>
  );
}
