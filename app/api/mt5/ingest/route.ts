import { NextRequest, NextResponse } from 'next/server';
import { backtest, Candle } from '../../../../lib/engine';
import { getBridgeStore, setBridgeStore } from '../../../../lib/bridge-store';

type Payload={token?:string;symbol?:string;brokerTimeRaw?:string;brokerTimeUtc?:string;brokerUtcOffsetSeconds?:number;candles?:Candle[];chunkIndex?:number;chunkTotal?:number;uploadId?:string;reset?:boolean};
declare global{var __silverBulletUploads:Record<string,Candle[]>|undefined}
const uploads=()=>globalThis.__silverBulletUploads??(globalThis.__silverBulletUploads={});
const clean=(xs:Candle[])=>(xs??[]).map(c=>({time:String(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)})).filter(c=>c.time&&[c.open,c.high,c.low,c.close].every(Number.isFinite));
const merge=(a:Candle[],b:Candle[])=>Array.from(new Map([...a,...b].map(c=>[c.time,c])).values()).sort((x,y)=>new Date(x.time).getTime()-new Date(y.time).getTime());

export async function GET(){const s=getBridgeStore(),age=s.analyzedAt?Date.now()-new Date(s.analyzedAt).getTime():Infinity;return NextResponse.json({ok:true,service:'SilverBulletAI MT5 Bridge',mode:'read-only',...s,connected:age<120000})}
export async function POST(req:NextRequest){
 const expected=process.env.MT5_BRIDGE_TOKEN;let body:Payload;
 try{body=JSON.parse((await req.text()).replace(/\0/g,'').trim()) as Payload}catch{return NextResponse.json({ok:false,error:'Invalid JSON payload'},{status:400})}
 if(expected&&body.token!==expected)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 if(!body.symbol||!Array.isArray(body.candles)||body.candles.length<1)return NextResponse.json({ok:false,error:'Expected symbol and candles[]'},{status:400});
 const incoming=clean(body.candles),id=body.uploadId||body.symbol,total=Math.max(1,Number(body.chunkTotal)||1),idx=Math.max(0,Number(body.chunkIndex)||0);
 const u=uploads();if(body.reset||idx===0)u[id]=[];u[id]=merge(u[id]||[],incoming);
 const accumulated=u[id];
 const analyzedAt=new Date().toISOString(),prev=getBridgeStore();
 const next=setBridgeStore({connected:true,symbol:body.symbol,brokerTimeRaw:body.brokerTimeRaw??prev.brokerTimeRaw,brokerTimeUtc:body.brokerTimeUtc??prev.brokerTimeUtc,brokerUtcOffsetSeconds:Number.isFinite(Number(body.brokerUtcOffsetSeconds))?Number(body.brokerUtcOffsetSeconds):prev.brokerUtcOffsetSeconds,analyzedAt,received:accumulated.length,lastCandle:accumulated.at(-1)??null,candles:accumulated,model8AM:backtest(accumulated,8),model9AM:backtest(accumulated,9)});
 return NextResponse.json({ok:true,chunkIndex:idx,chunkTotal:total,chunkCandles:incoming.length,received:next.received,complete:idx>=total-1});
}