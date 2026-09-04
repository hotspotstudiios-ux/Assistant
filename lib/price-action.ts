import type { Candle } from './engine';

export type PADirection='BULLISH'|'BEARISH';
export type Swing={kind:'HIGH'|'LOW';time:string;price:number;index:number};
export type Sweep={direction:PADirection;time:string;levelTime:string;level:number;depth:number;index:number};
export type MSS={direction:PADirection;time:string;levelTime:string;level:number;index:number};
export type FVG={direction:PADirection;time:string;low:number;high:number;size:number;index:number};
export type PriceActionAnalysis={swings:Swing[];sweeps:Sweep[];mss:MSS[];fvgs:FVG[]};

export function detectSwings(c:Candle[],left=2,right=2):Swing[]{
 const out:Swing[]=[];
 for(let i=left;i<c.length-right;i++){
  const b=c.slice(i-left,i),a=c.slice(i+1,i+right+1),x=c[i];
  if(b.every(z=>x.high>z.high)&&a.every(z=>x.high>=z.high))out.push({kind:'HIGH',time:x.time,price:x.high,index:i});
  if(b.every(z=>x.low<z.low)&&a.every(z=>x.low<=z.low))out.push({kind:'LOW',time:x.time,price:x.low,index:i});
 }
 return out;
}

export function detectSweeps(c:Candle[],swings:Swing[]):Sweep[]{
 const out:Sweep[]=[];
 for(const s of swings){
  for(let i=s.index+1;i<c.length;i++){
   const x=c[i];
   if(s.kind==='HIGH'&&x.high>s.price&&x.close<s.price){
    out.push({direction:'BEARISH',time:x.time,levelTime:s.time,level:s.price,depth:x.high-s.price,index:i});break;
   }
   if(s.kind==='LOW'&&x.low<s.price&&x.close>s.price){
    out.push({direction:'BULLISH',time:x.time,levelTime:s.time,level:s.price,depth:s.price-x.low,index:i});break;
   }
  }
 }
 return out;
}

export function detectMSS(c:Candle[],swings:Swing[],sweeps:Sweep[]):MSS[]{
 const out:MSS[]=[];
 for(const sweep of sweeps){
  const kind=sweep.direction==='BEARISH'?'LOW':'HIGH';
  const prior=swings.filter(s=>s.kind===kind&&s.index<sweep.index);
  const level=prior.at(-1); if(!level)continue;
  for(let i=sweep.index+1;i<c.length;i++){
   const broken=sweep.direction==='BEARISH'?c[i].close<level.price:c[i].close>level.price;
   if(broken){out.push({direction:sweep.direction,time:c[i].time,levelTime:level.time,level:level.price,index:i});break;}
  }
 }
 return out;
}

export function detectFVGs(c:Candle[],minSize=0):FVG[]{
 const out:FVG[]=[];
 for(let i=2;i<c.length;i++){
  const a=c[i-2],d=c[i];
  if(d.low>a.high){
   const size=d.low-a.high;if(size>=minSize)out.push({direction:'BULLISH',time:d.time,low:a.high,high:d.low,size,index:i});
  }
  if(d.high<a.low){
   const size=a.low-d.high;if(size>=minSize)out.push({direction:'BEARISH',time:d.time,low:d.high,high:a.low,size,index:i});
  }
 }
 return out;
}

export function analyzePriceAction(c:Candle[],left=2,right=2,minFvgSize=0):PriceActionAnalysis{
 const swings=detectSwings(c,left,right);
 const sweeps=detectSweeps(c,swings);
 const mss=detectMSS(c,swings,sweeps);
 const fvgs=detectFVGs(c,minFvgSize);
 return{swings,sweeps,mss,fvgs};
}
