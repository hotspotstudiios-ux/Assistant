import { NextRequest, NextResponse } from 'next/server';
import type { Candle, CandleDay } from '../../../../lib/candles';
import { analyzePriceAction } from '../../../../lib/price-action';

const SUPABASE_URL='https://bdakeikxbumaftbdylet.supabase.co';
const SUPABASE_KEY='sb_publishable_551Oulnh5G-hTwziT9al-Q_ok0rUyBR';
const SYMBOL='NAS100';
const TIMEFRAME='M1';
const SOURCE='Vantage';

type Payload={
  token?:string;symbol?:string;timeframe?:string;source?:string;
  brokerTimeRaw?:string;brokerTimeUtc?:string;brokerUtcOffsetSeconds?:number;
  candles?:Candle[];chunkIndex?:number;chunkTotal?:number;uploadId?:string;retryCount?:number
};

async function rpc(name:string,body:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const text=await r.text();
  if(!r.ok)throw new Error(`${name} ${r.status}: ${text}`);
  return text?JSON.parse(text):null;
}

export async function GET(req:NextRequest){
  try{
    const mode=req.nextUrl.searchParams.get('mode')||'live';
    const symbol=req.nextUrl.searchParams.get('symbol')||SYMBOL;
    const timeframe=req.nextUrl.searchParams.get('timeframe')||TIMEFRAME;
    const source=req.nextUrl.searchParams.get('source')||SOURCE;

    if(mode==='days'){
      const raw=await rpc('silverbullet_recent_days_v2',{p_symbol:symbol,p_timeframe:timeframe,p_source:source,p_days:60});
      const days=(Array.isArray(raw)?raw:[]) as CandleDay[];
      return NextResponse.json({ok:true,symbol,timeframe,source,days});
    }

    const date=req.nextUrl.searchParams.get('date');
    if(date){
      const raw=await rpc('silverbullet_day_v2',{p_symbol:symbol,p_ny_date:date,p_timeframe:timeframe,p_source:source});
      const candles=(Array.isArray(raw)?raw:[]) as Candle[];
      return NextResponse.json({ok:true,symbol,timeframe,source,date,candles,priceAction:analyzePriceAction(candles)});
    }

    const live=await rpc('silverbullet_live_v2',{p_symbol:symbol,p_timeframe:timeframe,p_source:source,p_limit:1200}) as {status?:Record<string,unknown>;candles?:Candle[]};
    const status=live?.status??{},candles=live?.candles??[];
    const dbStats=await rpc('silverbullet_db_stats',{p_symbol:symbol,p_timeframe:timeframe,p_source:source});
    const lastSeen=typeof status.last_seen_at==='string'?new Date(status.last_seen_at).getTime():0;

    return NextResponse.json({
      ok:true,service:'Price Action Data Bridge',connected:lastSeen>0&&Date.now()-lastSeen<120000,
      symbol,timeframe,source,dbStats,
      brokerTimeRaw:status.broker_time_raw??null,
      brokerTimeUtc:status.broker_time_utc??null,
      brokerUtcOffsetSeconds:status.broker_utc_offset_seconds??null,
      analyzedAt:status.last_seen_at??null,
      received:Number(status.candle_count??0),
      syncStatus:status.sync_status??'IDLE',
      syncChunkIndex:Number(status.chunk_index??-1),
      syncChunkTotal:Number(status.chunk_total??0),
      syncRetryCount:Number(status.retry_count??0),
      lastCandle:candles.at(-1)??null,
      candles,
      priceAction:analyzePriceAction(candles)
    });
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Database error'},{status:500});
  }
}

export async function POST(req:NextRequest){
  const expected=process.env.MT5_BRIDGE_TOKEN;
  let body:Payload;
  try{body=JSON.parse((await req.text()).replace(/\0/g,'').trim()) as Payload}
  catch{return NextResponse.json({ok:false,error:'Invalid JSON payload'},{status:400})}

  if(expected&&body.token!==expected)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
  if(!body.symbol||!Array.isArray(body.candles)||body.candles.length<1)return NextResponse.json({ok:false,error:'Expected symbol and candles[]'},{status:400});

  try{
    const result=await rpc('silverbullet_ingest_chunk_v3',{
      p_symbol:body.symbol,p_timeframe:body.timeframe??TIMEFRAME,p_source:body.source??SOURCE,
      p_broker_time_raw:body.brokerTimeRaw??null,p_broker_time_utc:body.brokerTimeUtc??null,
      p_broker_utc_offset_seconds:Number(body.brokerUtcOffsetSeconds)||0,
      p_upload_id:body.uploadId??body.symbol,p_chunk_index:Number(body.chunkIndex)||0,
      p_chunk_total:Number(body.chunkTotal)||1,p_retry_count:Number(body.retryCount)||0,p_candles:body.candles
    });
    return NextResponse.json({ok:true,chunkIndex:Number(body.chunkIndex)||0,chunkTotal:Number(body.chunkTotal)||1,database:'persistent',result});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Database ingest failed'},{status:500});
  }
}
