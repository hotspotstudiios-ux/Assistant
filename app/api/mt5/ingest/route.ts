import { NextRequest, NextResponse } from 'next/server';
import { backtest, Candle } from '../../../../lib/engine';

const SUPABASE_URL='https://bdakeikxbumaftbdylet.supabase.co';
const SUPABASE_KEY='sb_publishable_551Oulnh5G-hTwziT9al-Q_ok0rUyBR';
const SYMBOL='NAS100';

type Payload={token?:string;symbol?:string;brokerTimeRaw?:string;brokerTimeUtc?:string;brokerUtcOffsetSeconds?:number;candles?:Candle[];chunkIndex?:number;chunkTotal?:number;uploadId?:string;reset?:boolean};

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
const nyDate=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const compact=(s:ReturnType<typeof backtest>[0]|undefined)=>s?{referenceHour:s.referenceHour,direction:s.direction,result:s.result,r:s.r,validWindow:s.validWindow,entryTime:s.entryTime,rejectionReason:s.rejectionReason}:null;

export async function GET(req:NextRequest){
 try{
   const mode=req.nextUrl.searchParams.get('mode')||'live';
   const symbol=req.nextUrl.searchParams.get('symbol')||SYMBOL;
   if(mode==='summary'){
     const candles=(await rpc('silverbullet_history_days',{p_symbol:symbol,p_days:30})) as Candle[];
     const dates=[...new Set(candles.map(c=>nyDate(c.time)))].sort().reverse();
     const rows=dates.map(date=>{const day=candles.filter(c=>nyDate(c.time)===date);return{date,candles:day.length,s8:compact(backtest(day,8)[0]),s9:compact(backtest(day,9)[0])}});
     const valid=rows.flatMap(x=>[x.s8,x.s9]).filter((x):x is NonNullable<typeof x>=>Boolean(x&&x.validWindow));
     const wins=valid.filter(x=>x.result==='WIN').length,losses=valid.filter(x=>x.result==='LOSS').length,open=valid.filter(x=>x.result==='OPEN').length,closed=wins+losses;
     return NextResponse.json({ok:true,symbol,rows,stats:{days:rows.length,setups:valid.length,wins,losses,open,winRate:closed?wins/closed*100:0,netR:valid.reduce((a,x)=>a+x.r,0)}});
   }
   const date=req.nextUrl.searchParams.get('date');
   if(date){
     const candles=(await rpc('silverbullet_day',{p_symbol:symbol,p_ny_date:date})) as Candle[];
     return NextResponse.json({ok:true,symbol,date,candles,s8:backtest(candles,8)[0]??null,s9:backtest(candles,9)[0]??null});
   }
   const live=await rpc('silverbullet_live',{p_symbol:symbol,p_limit:720}) as {status?:Record<string,unknown>;candles?:Candle[]};
   const status=live?.status??{},candles=live?.candles??[];
   const lastSeen=typeof status.last_seen_at==='string'?new Date(status.last_seen_at).getTime():0;
   return NextResponse.json({
     ok:true,service:'SilverBulletAI MT5 Bridge',mode:'persistent',
     connected:lastSeen>0&&Date.now()-lastSeen<120000,
     symbol,
     brokerTimeRaw:status.broker_time_raw??null,
     brokerTimeUtc:status.broker_time_utc??null,
     brokerUtcOffsetSeconds:status.broker_utc_offset_seconds??null,
     analyzedAt:status.last_seen_at??null,
     received:Number(status.candle_count??0),
     lastCandle:candles.at(-1)??null,
     candles
   });
 }catch(e){
   return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Database error'},{status:500});
 }
}

export async function POST(req:NextRequest){
 const expected=process.env.MT5_BRIDGE_TOKEN;
 let body:Payload;
 try{body=JSON.parse((await req.text()).replace(/\0/g,'').trim()) as Payload}catch{return NextResponse.json({ok:false,error:'Invalid JSON payload'},{status:400})}
 if(expected&&body.token!==expected)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!body.symbol||!Array.isArray(body.candles)||body.candles.length<1)return NextResponse.json({ok:false,error:'Expected symbol and candles[]'},{status:400});
 try{
   const result=await rpc('silverbullet_ingest_chunk',{
     p_symbol:body.symbol,
     p_broker_time_raw:body.brokerTimeRaw??null,
     p_broker_time_utc:body.brokerTimeUtc??null,
     p_broker_utc_offset_seconds:Number(body.brokerUtcOffsetSeconds)||0,
     p_candles:body.candles
   });
   return NextResponse.json({ok:true,chunkIndex:Number(body.chunkIndex)||0,chunkTotal:Number(body.chunkTotal)||1,complete:(Number(body.chunkIndex)||0)>=(Number(body.chunkTotal)||1)-1,database:'persistent',result});
 }catch(e){
   return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Database ingest failed'},{status:500});
 }
}