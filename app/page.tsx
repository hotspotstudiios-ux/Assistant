'use client';
import {useEffect,useMemo,useState} from 'react';
import type {Candle,CandleDay} from '../lib/candles';
import {analyzePriceAction,type PriceActionAnalysis} from '../lib/price-action';

type Bridge={
  connected:boolean;symbol:string|null;timeframe?:string;source?:string;received:number;
  lastCandle:Candle|null;candles:Candle[];brokerUtcOffsetSeconds:number|null;
  brokerTimeRaw:string|null;brokerTimeUtc:string|null;syncStatus?:string;
  dbStats?:{candles:number;nyDays:number;first:string|null;last:string|null};
};

type Layers={swings:boolean;sweeps:boolean;structure:boolean;fvgs:boolean;displacement:boolean};

const nyTime=(iso:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
const dayLabel=(d:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'2-digit',year:'numeric'}).format(new Date(d+'T12:00:00Z'));

function Metric({label,value,sub}:{label:string;value:string|number;sub?:string}){
  return <div className="metric"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>
}

function Chart({candles,pa,layers}:{candles:Candle[];pa:PriceActionAnalysis;layers:Layers}){
  const xs=candles.slice(-240);
  if(xs.length<2)return <div className="chart empty">Waiting for candles…</div>;
  const hi=Math.max(...xs.map(x=>x.high)),lo=Math.min(...xs.map(x=>x.low)),w=1000,h=430,p=24,range=hi-lo||1;
  const y=(v:number)=>p+(hi-v)/(range)*(h-p*2),cw=(w-p*2)/xs.length;
  const visibleStart=candles.length-xs.length;
  const x=(index:number)=>p+(index-visibleStart)*cw+cw/2;
  const inView=(index:number)=>index>=visibleStart&&index<candles.length;

  return <div className="chart">
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {layers.fvgs&&pa.fvgs.filter(g=>inView(g.index)).map((g,i)=><rect key={'f'+i} x={x(g.index)} y={y(g.high)} width={Math.max(4,w-x(g.index))} height={Math.max(2,y(g.low)-y(g.high))} className={g.direction==='BULLISH'?'fvg bull':'fvg bear'}/>)}
      {xs.map((c,i)=>{const xi=p+i*cw+cw/2,up=c.close>=c.open;return <g key={c.time} className={up?'up':'down'}><line x1={xi} x2={xi} y1={y(c.high)} y2={y(c.low)}/><rect x={xi-Math.max(1,cw*.28)} y={Math.min(y(c.open),y(c.close))} width={Math.max(2,cw*.56)} height={Math.max(1,Math.abs(y(c.open)-y(c.close)))}/></g>})}
      {layers.swings&&pa.swings.filter(s=>inView(s.index)).map((s,i)=><g key={'s'+i}><circle cx={x(s.index)} cy={y(s.price)} r={3.5} className={s.kind==='HIGH'?'swing high':'swing low'}/><text x={x(s.index)+5} y={y(s.price)+(s.kind==='HIGH'?-6:12)} className="swingLabel">{s.label}</text></g>)}
      {layers.sweeps&&pa.sweeps.filter(s=>inView(s.index)).map((s,i)=><g key={'sw'+i}><circle cx={x(s.index)} cy={y(s.level)} r={5} className="sweep"/><text x={x(s.index)+6} y={y(s.level)-7} className="tag">SWEEP</text></g>)}
      {layers.structure&&pa.structureBreaks.filter(s=>inView(s.index)).map((s,i)=><g key={'b'+i}><line x1={x(s.index)} x2={x(s.index)} y1={12} y2={h-12} className={s.classification==='MSS'?'mss':'bos'}/><text x={x(s.index)+5} y={30+(i%3)*13} className="tag">{s.classification}</text></g>)}
      {layers.displacement&&pa.displacements.filter(d=>inView(d.index)).map((d,i)=><circle key={'d'+i} cx={x(d.index)} cy={y(candles[d.index].close)} r={7} className="displacement"/>)}
    </svg>
    <div className="legend"><span>{xs.length} visible candles</span><b>{xs.at(-1)?.close.toFixed(2)}</b></div>
  </div>
}

export default function Home(){
  const[mode,setMode]=useState<'live'|'history'>('live');
  const[bridge,setBridge]=useState<Bridge|null>(null);
  const[days,setDays]=useState<CandleDay[]>([]);
  const[date,setDate]=useState('');
  const[history,setHistory]=useState<Candle[]>([]);
  const[swing,setSwing]=useState(2);
  const[disp,setDisp]=useState(1.5);
  const[body,setBody]=useState(.6);
  const[breakClose,setBreakClose]=useState(.05);
  const[layers,setLayers]=useState<Layers>({swings:true,sweeps:true,structure:true,fvgs:true,displacement:false});

  async function refresh(){
    try{const r=await fetch('/api/mt5/ingest?mode=live',{cache:'no-store'}),j=await r.json();if(j.ok)setBridge(j)}catch{}
  }
  async function loadDays(){
    try{const r=await fetch('/api/mt5/ingest?mode=days',{cache:'no-store'}),j=await r.json();if(j.ok){setDays(j.days??[]);if(!date&&j.days?.[0]?.date)setDate(j.days[0].date)}}catch{}
  }
  async function loadDay(d:string){
    if(!d)return;
    try{const r=await fetch('/api/mt5/ingest?date='+encodeURIComponent(d),{cache:'no-store'}),j=await r.json();if(j.ok)setHistory(j.candles??[])}catch{}
  }

  useEffect(()=>{refresh();const id=setInterval(refresh,5000);return()=>clearInterval(id)},[]);
  useEffect(()=>{if(mode==='history')loadDays()},[mode]);
  useEffect(()=>{if(mode==='history'&&date)loadDay(date)},[mode,date]);

  const candles=mode==='live'?(bridge?.candles??[]):history;
  const pa=useMemo(()=>analyzePriceAction(candles,{swingLeft:swing,swingRight:swing,displacementRangeMultiple:disp,minBodyPercent:body,minBreakCloseMultiple:breakClose}),[candles,swing,disp,body,breakClose]);
  const offset=bridge?.brokerUtcOffsetSeconds;
  const offsetLabel=offset==null?'—':`UTC${offset>=0?'+':''}${offset/3600}`;
  const latestBreak=pa.structureBreaks.at(-1);
  const latestSweep=pa.sweeps.at(-1);

  return <main>
    <header className="hero">
      <div><span className="eyebrow">PRICE ACTION LAB</span><h1>{bridge?.symbol??'NAS100'} Structure Engine</h1><p>Raw candles in. Objective market structure out. No strategy bias.</p></div>
      <div className="status"><i className={bridge?.connected?'on':''}/><span>{bridge?.connected?'MT5 LIVE':'MT5 OFFLINE'}</span><b>{bridge?.lastCandle?.close.toFixed(2)??'—'}</b><small>{offsetLabel}</small></div>
    </header>

    <div className="topgrid">
      <Metric label="Candles" value={candles.length.toLocaleString()} sub={mode==='live'?'live window':date||'historical day'}/>
      <Metric label="Bias" value={pa.bias} sub={latestBreak?nyTime(latestBreak.time):'no break yet'}/>
      <Metric label="Swings" value={pa.swings.length}/>
      <Metric label="Sweeps" value={pa.sweeps.length} sub={latestSweep?nyTime(latestSweep.time):'none'}/>
      <Metric label="Structure" value={pa.structureBreaks.length}/>
      <Metric label="FVGs" value={pa.fvgs.length}/>
    </div>

    <div className="workspace">
      <aside className="controlpanel">
        <div className="panelhead"><span>Engine Settings</span><small>Adjust live</small></div>
        <label>Swing confirmation <b>{swing} / {swing}</b><input type="range" min="1" max="6" step="1" value={swing} onChange={e=>setSwing(+e.target.value)}/></label>
        <label>Displacement range <b>{disp.toFixed(1)}×</b><input type="range" min="1" max="3" step=".1" value={disp} onChange={e=>setDisp(+e.target.value)}/></label>
        <label>Minimum body <b>{Math.round(body*100)}%</b><input type="range" min=".3" max=".9" step=".05" value={body} onChange={e=>setBody(+e.target.value)}/></label>
        <label>Break close strength <b>{breakClose.toFixed(2)}×</b><input type="range" min="0" max=".5" step=".01" value={breakClose} onChange={e=>setBreakClose(+e.target.value)}/></label>
        <div className="layergroup"><span>Chart Layers</span>{Object.entries(layers).map(([k,v])=><button key={k} className={v?'active':''} onClick={()=>setLayers(x=>({...x,[k]:!x[k as keyof Layers]}))}>{k}</button>)}</div>
      </aside>

      <section className="chartpanel">
        <div className="toolbar">
          <div className="segmented"><button className={mode==='live'?'active':''} onClick={()=>setMode('live')}>Live</button><button className={mode==='history'?'active':''} onClick={()=>setMode('history')}>History</button></div>
          {mode==='history'&&<select value={date} onChange={e=>setDate(e.target.value)}>{days.map(d=><option key={d.date} value={d.date}>{dayLabel(d.date)} · {d.candles} candles</option>)}</select>}
        </div>
        <Chart candles={candles} pa={pa} layers={layers}/>
      </section>
    </div>

    <div className="detailgrid">
      <section><div className="panelhead"><span>Latest Structure</span><small>{pa.bias}</small></div>{latestBreak?<div className="eventcard"><strong>{latestBreak.classification} · {latestBreak.direction}</strong><span>{nyTime(latestBreak.time)}</span><p>Closed through {latestBreak.levelLabel} {latestBreak.level.toFixed(2)} by {latestBreak.closeDistance.toFixed(2)} points ({latestBreak.closeDistanceMultiple.toFixed(2)}× average range).</p></div>:<p className="muted">No confirmed structure break in this sample.</p>}</section>
      <section><div className="panelhead"><span>Latest Liquidity Event</span><small>{latestSweep?.closeBackInside?'rejected':'run'}</small></div>{latestSweep?<div className="eventcard"><strong>{latestSweep.direction} SWEEP</strong><span>{nyTime(latestSweep.time)}</span><p>Level {latestSweep.level.toFixed(2)} · depth {latestSweep.depth.toFixed(2)} · close back inside {latestSweep.closeBackInside?'yes':'no'}.</p></div>:<p className="muted">No sweep detected in this sample.</p>}</section>
      <section><div className="panelhead"><span>Displacement</span><small>{pa.displacements.length}</small></div><div className="eventlist">{pa.displacements.slice(-4).reverse().map((d,i)=><div key={i}><b>{d.direction}</b><span>{nyTime(d.time)}</span><small>{d.rangeMultiple.toFixed(2)}× range · {Math.round(d.bodyPercent*100)}% body</small></div>)}</div></section>
      <section><div className="panelhead"><span>FVG Quality</span><small>{pa.fvgs.filter(x=>x.displacementLinked).length} linked</small></div><div className="eventlist">{pa.fvgs.slice(-4).reverse().map((g,i)=><div key={i}><b>{g.direction}</b><span>{nyTime(g.time)}</span><small>{g.size.toFixed(2)} pts · {g.displacementLinked?'displacement linked':'unlinked'}</small></div>)}</div></section>
    </div>

    <div className="footnote">The database and MT5 bridge are retained only as market-data infrastructure. No 8AM, 9AM, Silver Bullet, entry, stop, target, or win-rate logic is used by this engine.</div>
  </main>
}
