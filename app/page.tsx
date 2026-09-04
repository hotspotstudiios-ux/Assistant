'use client';

import { useEffect, useMemo, useState } from 'react';
import { backtest, Candle } from '../lib/engine';

type Bridge = {
  connected: boolean;
  symbol: string | null;
  brokerTime: string | null;
  analyzedAt: string | null;
  received: number;
  lastCandle: Candle | null;
  candles: Candle[];
  model8AM: ReturnType<typeof backtest>;
  model9AM: ReturnType<typeof backtest>;
};

function parseCSV(text: string): Candle[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(x => x.trim().toLowerCase());
  const idx = (...names: string[]) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
  const ti = idx('time','timestamp','datetime','date');
  const oi = idx('open'), hi = idx('high'), li = idx('low'), ci = idx('close');
  if ([ti,oi,hi,li,ci].some(i => i < 0)) throw new Error('CSV needs: time, open, high, low, close');

  return lines.slice(1).map(line => {
    const c = line.split(',');
    return { time:c[ti].trim(), open:+c[oi], high:+c[hi], low:+c[li], close:+c[ci] };
  }).filter(x => x.time && [x.open,x.high,x.low,x.close].every(Number.isFinite));
}

function SignalCard({title, signals}:{title:string;signals:ReturnType<typeof backtest>}) {
  const s = signals[0];
  return <section>
    <div className="sectionTop"><h2>{title}</h2><span className="mini">{s ? 'SETUP FOUND' : 'NO SETUP'}</span></div>
    {!s ? <p>No valid setup found in loaded candles.</p> : <>
      <strong>{s.direction} · {s.result}</strong>
      <div className="metrics">
        <span>Entry <b>{s.entry.toFixed(2)}</b></span>
        <span>SL <b>{s.stop.toFixed(2)}</b></span>
        <span>TP 2R <b>{s.target2R.toFixed(2)}</b></span>
      </div>
      <small>Sweep {new Date(s.sweepTime).toLocaleString()}<br/>MSS {new Date(s.mssTime).toLocaleString()}</small>
    </>}
  </section>;
}

export default function Home() {
  const [tab,setTab] = useState<'live'|'backtest'>('live');
  const [bridge,setBridge] = useState<Bridge | null>(null);
  const [rows,setRows] = useState<Candle[]>([]);
  const [source,setSource] = useState<'mt5'|'csv'>('mt5');
  const [error,setError] = useState('');

  async function refresh() {
    try {
      const r = await fetch('/api/mt5/ingest', { cache:'no-store' });
      const j = await r.json();
      if (j.ok) setBridge(j);
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  const testRows = source === 'mt5' ? (bridge?.candles ?? []) : rows;
  const eight = useMemo(() => testRows.length ? backtest(testRows,8) : [], [testRows]);
  const nine = useMemo(() => testRows.length ? backtest(testRows,9) : [], [testRows]);
  const live8 = bridge?.model8AM ?? [];
  const live9 = bridge?.model9AM ?? [];

  return <main>
    <div className="head">
      <span className="pill">SILVERBULLETAI V1</span>
      <h1>Trading Signal Assistant</h1>
      <p>One engine for live MT5 scanning and candle-by-candle backtesting.</p>
    </div>

    <div className="tabs">
      <button className={tab==='live'?'active':''} onClick={()=>setTab('live')}>Live Scanner</button>
      <button className={tab==='backtest'?'active':''} onClick={()=>setTab('backtest')}>Backtest Lab</button>
    </div>

    {tab === 'live' ? <>
      <section className="status">
        <div><span className={'dot '+(bridge?.connected?'on':'off')}></span><b>{bridge?.connected ? 'MT5 CONNECTED' : 'WAITING FOR MT5'}</b></div>
        <div className="statusMeta">
          <span>Symbol <b>{bridge?.symbol ?? '—'}</b></span>
          <span>Candles <b>{bridge?.received ?? 0}</b></span>
          <span>Last price <b>{bridge?.lastCandle?.close?.toFixed(2) ?? '—'}</b></span>
        </div>
      </section>
      <div className="grid">
        <SignalCard title="8AM Liquidity" signals={live8}/>
        <SignalCard title="9AM Liquidity" signals={live9}/>
      </div>
      <div className="note">
        Live Scanner refreshes every 10 seconds from the latest MT5 bridge payload. This build is read-only and never places trades.
      </div>
    </> : <>
      <div className="sourceRow">
        <button className={source==='mt5'?'active':''} onClick={()=>setSource('mt5')}>Use MT5 history</button>
        <button className={source==='csv'?'active':''} onClick={()=>setSource('csv')}>Upload CSV</button>
      </div>

      {source === 'csv' && <label className="upload">
        Upload 1-minute CSV
        <input type="file" accept=".csv,text/csv" onChange={async e=>{
          try{
            setError('');
            const f=e.target.files?.[0];
            if(f)setRows(parseCSV(await f.text()));
          }catch(err:unknown){setError(err instanceof Error?err.message:'Could not parse CSV');}
        }}/>
      </label>}

      {source === 'mt5' && <section>
        <h2>MT5 History</h2>
        <p>{testRows.length ? `${testRows.length} M1 candles loaded from ${bridge?.symbol ?? 'MT5'}.` : 'Connect the MT5 bridge to load broker history automatically.'}</p>
      </section>}

      {error && <p className="err">{error}</p>}
      <div className="grid">
        <SignalCard title="8AM Model Backtest" signals={eight}/>
        <SignalCard title="9AM Model Backtest" signals={nine}/>
      </div>
      <div className="note">
        Backtest Lab uses the same detector as Live Scanner, so a historical setup and a future live setup are evaluated with the same rules.
      </div>
    </>}
  </main>;
}
