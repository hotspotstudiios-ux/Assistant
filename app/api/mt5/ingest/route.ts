import { NextRequest, NextResponse } from 'next/server';
import { backtest, Candle } from '../../../../lib/engine';
import { getBridgeStore, setBridgeStore } from '../../../../lib/bridge-store';

type Payload={token?:string;symbol?:string;brokerTimeRaw?:string;brokerTimeUtc?:string;brokerUtcOffsetSeconds?:number;candles?:Candle[];chunkIndex?:number;chunkTotal?:number;uploadId?:string;reset?:boolean};
declare global{var __silverBulletUploads:Record<string,Candle[]>|undefined}
const uploads=()=>globalThis.__silverBulletUploads??(globalThis.__silverBulletUploads={});
const clean=(xs:Candle[])=>(xs??[]).map(c=>({time:String(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)})).filter(c=>c.time&&[c.open,c.high,c.low,c.close].every(Number.isFinite));
const merge=(a:Candle[],b:Candle[])=>Array.from(new Map([...a,...b].map(c=>[c.time,c])).values()).sort((x,y)=>new Date(x.time).getTime()-new Date(y.time).getTime());
const nyDate=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const compact=(s:ReturnType<typeof backtest>[0]|undefined)=>s?{referenceHour:s.referenceHour,direction:s.direction,result:s.result,r:s.r,validWindow:s.validWindow,entryTime:s.entryTime,rejectionReason:s.rejectionReason}:null;

export async function GET(req:NextRequest){
 const s=getBridgeStore(),age=s.analyzedAt?Date.now()-new Date(s.analyzedAt).getTime():Infinity,connected=age<120000;
 const mode=req.nextUrl.searchParams.get('mode')||'live';
 if(mode==='summary'){
   const dates=[...new Set(s.candles.map(c=>nyDate(c.time)))].sort().reverse();
   const rows=dates.map(date=>{const day=s.candles.filter(c=>nyDate(c.time)===date);return{date,candles:day.length,s8:compact(backtest(day,8)[0]),s9:compact(backtest(day,9)[0])}});
   const valid=rows.flatMap(x=>[x.s8,x.s9]).filter((x):x is NonNullable<typeof x>=>Boolean(x&&x.validWindow));
   const wins=valid.filter(x=>x.result==='WIN').length,losses=valid.filter(x=>x.result==='LOSS').length,open=valid.filter(x=>x.result==='OPEN').length,closed=wins+losses;
   return NextResponse.json({ok:true,connected,symbol:s.symbol,received:s.received,rows,stats:{days:rows.length,setups:valid.length,wins,losses,open,winRate:closed?wins/closed*100:0,netR:valid.reduce((a,x)=>a+x.r,0)}});
 }
 const date=req.nextUrl.searchParams.get('date');
 if(date){
   const candles=s.candles.filter(c=>nyDate(c.time)===date);
   return NextResponse.json({ok:true,connected,symbol:s.symbol,date,candles,s8:backtest(candles,8)[0]??null,s9:backtest(candles,9)[0]??null});
 }
 const candles=s.candles.slice(-720);
 return NextResponse.json({ok:true,service:'SilverBulletAI MT5 Bridge',mode:'read-only',connected,symbol:s.symbol,brokerTimeRaw:s.brokerTimeRaw,brokerTimeUtc:s.brokerTimeUtc,brokerUtcOffsetSeconds:s.brokerUtcOffsetSeconds,analyzedAt:s.analyzedAt,received:s.received,lastCandle:s.lastCandle,candles});
}
export async function POST(req:NextRequest){
 const expected=process.env.MT5_BRIDGE_TOKEN;let body:Payload;
 try{body=JSON.parse((await req.text()).replace(/\0/g,'').trim()) as Payload}catch{return NextResponse.json({ok:false,error:'Invalid JSON payload'},{status:400})}
 if(expected&&body.token!==expected)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!body.symbol||!Array.isArray(body.candles)||body.candles.length<1)return NextResponse.json({ok:false,error:'Expected symbol and candles[]'},{status:400});
 const incoming=clean(body.candles),id=body.uploadId||body.symbol,total=Math.max(1,Number(body.chunkTotal)||1),idx=Math.max(0,Number(body.chunkIndex)||0);
 const u=uploads();if(body.reset||idx===0)u[id]=[];u[id]=merge(u[id]||[],incoming);
 const accumulated=u[id],analyzedAt=new Date().toISOString(),prev=getBridgeStore();
 setBridgeStore({connected:true,symbol:body.symbol,brokerTimeRaw:body.brokerTimeRaw??prev.brokerTimeRaw,brokerTimeUtc:body.brokerTimeUtc??prev.brokerTimeUtc,brokerUtcOffsetSeconds:Number.isFinite(Number(body.brokerUtcOffsetSeconds))?Number(body.brokerUtcOffsetSeconds):prev.brokerUtcOffsetSeconds,analyzedAt,received:accumulated.length,lastCandle:accumulated.at(-1)??null,candles:accumulated,model8AM:[],model9AM:[]});
 return NextResponse.json({ok:true,chunkIndex:idx,chunkTotal:total,chunkCandles:incoming.length,received:accumulated.length,complete:idx>=total-1});
}