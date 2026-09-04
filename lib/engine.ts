export type Candle={time:string;open:number;high:number;low:number;close:number};
export type RefHour=8|9;
export type Signal={
  referenceHour:RefHour;direction:'LONG'|'SHORT';
  sweepTime:string;returnTime:string;mssTime:string;entryTime:string;
  mssLevel:number;fvgLow:number;fvgHigh:number;fvgTime:string;
  entry:number;stop:number;target2R:number;result:'WIN'|'LOSS'|'OPEN';r:number
};
export type ModelState={stage:'WAITING'|'SWEEP'|'RETURN'|'MSS'|'FVG'|'SIGNAL';direction:'LONG'|'SHORT'|null;refHigh:number|null;refLow:number|null;detail:string};

const ny=(iso:string)=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(iso));return Object.fromEntries(p.map(x=>[x.type,x.value]));};
const hm=(c:Candle)=>{const p=ny(c.time);return{h:+p.hour,m:+p.minute,key:`${p.year}-${p.month}-${p.day}`}};
export function hourRange(c:Candle[],h:RefHour){const xs=c.filter(x=>hm(x).h===h);return xs.length?{high:Math.max(...xs.map(x=>x.high)),low:Math.min(...xs.map(x=>x.low))}:null}
function session(c:Candle[],h:RefHour){return c.filter(x=>{const t=hm(x);return t.h>=h+1&&t.h<16})}
function fractalHigh(xs:Candle[],i:number){return i>=2&&i+2<xs.length&&xs[i].high>xs[i-1].high&&xs[i].high>xs[i-2].high&&xs[i].high>=xs[i+1].high&&xs[i].high>=xs[i+2].high}
function fractalLow(xs:Candle[],i:number){return i>=2&&i+2<xs.length&&xs[i].low<xs[i-1].low&&xs[i].low<xs[i-2].low&&xs[i].low<=xs[i+1].low&&xs[i].low<=xs[i+2].low}
function candidate(candles:Candle[],h:RefHour){
 const ref=hourRange(candles,h);if(!ref)return{ref:null,stage:'WAITING' as const,dir:null as 'LONG'|'SHORT'|null,detail:`Waiting for ${h}:00 NY reference candle`};
 const xs=session(candles,h);let sweep=-1,ret=-1,dir:'LONG'|'SHORT'|null=null;
 for(let i=0;i<xs.length;i++){
   if(xs[i].close<ref.low){sweep=i;dir='LONG'}else if(xs[i].close>ref.high){sweep=i;dir='SHORT'}if(sweep<0)continue;
   for(let j=i+1;j<xs.length;j++){
     if(dir==='LONG'&&xs[j].close<ref.low){sweep=j;i=j;continue}
     if(dir==='SHORT'&&xs[j].close>ref.high){sweep=j;i=j;continue}
     if((dir==='LONG'&&xs[j].close>=ref.low)||(dir==='SHORT'&&xs[j].close<=ref.high)){ret=j;break}
   }
   if(ret>=0)break;
 }
 if(sweep<0)return{ref,stage:'WAITING' as const,dir:null,detail:'Waiting for candle body to close beyond liquidity'};
 if(ret<0)return{ref,stage:'SWEEP' as const,dir,detail:'Body closed beyond liquidity; waiting for close back inside'};
 let swing=-1,mss=-1;
 for(let i=ret+2;i<xs.length-2;i++){if(dir==='LONG'&&fractalHigh(xs,i)){swing=i;break}if(dir==='SHORT'&&fractalLow(xs,i)){swing=i;break}}
 if(swing<0)return{ref,stage:'RETURN' as const,dir,detail:'Returned inside; waiting for a NEW swing after re-entry'};
 const mssLevel=dir==='LONG'?xs[swing].high:xs[swing].low;
 for(let i=swing+1;i<xs.length;i++){if(dir==='LONG'&&xs[i].close>mssLevel){mss=i;break}if(dir==='SHORT'&&xs[i].close<mssLevel){mss=i;break}}
 if(mss<0)return{ref,stage:'RETURN' as const,dir,detail:'New swing formed; waiting for body-close MSS'};
 let fvg=-1,lo=0,hi=0;
 for(let i=mss+2;i<xs.length;i++){
   const a=xs[i-2],d=xs[i];
   if(dir==='LONG'&&d.low>a.high){lo=a.high;hi=d.low}
   else if(dir==='SHORT'&&d.high<a.low){lo=d.high;hi=a.low}
   else continue;
   if(lo>=ref.low&&hi<=ref.high){fvg=i;break}
 }
 if(fvg<0)return{ref,stage:'MSS' as const,dir,detail:'MSS confirmed; waiting for first FVG inside liquidity range'};
 const edge=dir==='LONG'?hi:lo;let touch=-1;
 for(let i=fvg+1;i<xs.length;i++){if(xs[i].low<=edge&&xs[i].high>=edge){touch=i;break}}
 if(touch<0)return{ref,stage:'FVG' as const,dir,detail:'Valid FVG found; waiting for first retracement/touch'};
 return{ref,stage:'SIGNAL' as const,dir,detail:'Valid first-touch FVG entry',xs,sweep,ret,swing,mss,mssLevel,fvg,touch,lo,hi};
}
export function modelState(c:Candle[],h:RefHour):ModelState{const x=candidate(c,h);return{stage:x.stage,direction:x.dir,refHigh:x.ref?.high??null,refLow:x.ref?.low??null,detail:x.detail}}
export function backtest(c:Candle[],h:RefHour):Signal[]{
 const x=candidate(c,h);if(x.stage!=='SIGNAL'||!x.dir||!('xs'in x))return[];
 const{xs,sweep,ret,mss,mssLevel,fvg,touch}=x;
 const three=xs.slice(fvg-2,fvg+1);
 const entry=x.dir==='LONG'?x.hi:x.lo;
 const stop=x.dir==='LONG'?Math.min(...three.map(z=>z.low)):Math.max(...three.map(z=>z.high));
 const risk=Math.abs(entry-stop);if(!risk)return[];
 const target2R=x.dir==='LONG'?entry+2*risk:entry-2*risk;
 let result:'WIN'|'LOSS'|'OPEN'='OPEN',r=0;
 for(const z of xs.slice(touch)){const sl=x.dir==='LONG'?z.low<=stop:z.high>=stop,tp=x.dir==='LONG'?z.high>=target2R:z.low<=target2R;if(sl&&tp){result='LOSS';r=-1;break}if(sl){result='LOSS';r=-1;break}if(tp){result='WIN';r=2;break}}
 return[{referenceHour:h,direction:x.dir,sweepTime:xs[sweep].time,returnTime:xs[ret].time,mssTime:xs[mss].time,entryTime:xs[touch].time,mssLevel,fvgLow:x.lo,fvgHigh:x.hi,fvgTime:xs[fvg].time,entry,stop,target2R,result,r}]
}
