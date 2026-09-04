export type Candle={time:string;open:number;high:number;low:number;close:number};
export type RefHour=8|9;
export type Signal={referenceHour:RefHour;direction:'LONG'|'SHORT';sweepTime:string;mssTime:string;entryTime:string;entry:number;stop:number;target2R:number;result:'WIN'|'LOSS'|'OPEN';r:number};
export type ModelState={stage:'WAITING'|'SWEEP'|'RETURN'|'MSS'|'FVG'|'SIGNAL';direction:'LONG'|'SHORT'|null;refHigh:number|null;refLow:number|null;detail:string};

const nyParts=(iso:string)=>{const d=new Date(iso);const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(d);return Object.fromEntries(p.map(x=>[x.type,x.value]));};
export function hourRange(c:Candle[],h:RefHour){const xs=c.filter(x=>Number(nyParts(x.time).hour)===h);if(!xs.length)return null;return{high:Math.max(...xs.map(x=>x.high)),low:Math.min(...xs.map(x=>x.low))};}
function afterHour(c:Candle[],h:RefHour){return c.filter(x=>Number(nyParts(x.time).hour)>=h+1);}
export function modelState(candles:Candle[],h:RefHour):ModelState{
 const ref=hourRange(candles,h); if(!ref)return{stage:'WAITING',direction:null,refHigh:null,refLow:null,detail:`Waiting for ${h}:00 NY reference candle`};
 const xs=afterHour(candles,h); let sweep=-1; let dir:'LONG'|'SHORT'|null=null;
 for(let i=0;i<xs.length;i++){if(xs[i].low<ref.low){sweep=i;dir='LONG';break}if(xs[i].high>ref.high){sweep=i;dir='SHORT';break}}
 if(sweep<0)return{stage:'WAITING',direction:null,...{refHigh:ref.high,refLow:ref.low},detail:'Liquidity intact'};
 const c=xs[sweep]; const returned=dir==='LONG'?c.close>ref.low:c.close<ref.high;
 if(!returned)return{stage:'SWEEP',direction:dir,refHigh:ref.high,refLow:ref.low,detail:'Liquidity swept; waiting for close back inside'};
 for(let j=sweep+1;j<xs.length;j++){const prev=xs.slice(Math.max(sweep,j-3),j);if(!prev.length)continue;const mss=dir==='LONG'?xs[j].close>Math.max(...prev.map(x=>x.high)):xs[j].close<Math.min(...prev.map(x=>x.low));if(!mss)continue;
   for(let k=j+2;k<xs.length;k++){const a=xs[k-2],d=xs[k];const fvg=dir==='LONG'?d.low>a.high:d.high<a.low;if(fvg)return{stage:'SIGNAL',direction:dir,refHigh:ref.high,refLow:ref.low,detail:'Sweep + return + MSS + FVG confirmed'};}
   return{stage:'MSS',direction:dir,refHigh:ref.high,refLow:ref.low,detail:'MSS confirmed; waiting for FVG'};
 }
 return{stage:'RETURN',direction:dir,refHigh:ref.high,refLow:ref.low,detail:'Returned inside; waiting for MSS'};
}
export function backtest(candles:Candle[],refHour:RefHour):Signal[]{const ref=hourRange(candles,refHour);if(!ref)return[];const xs=afterHour(candles,refHour);const out:Signal[]=[];for(let i=3;i<xs.length-3;i++){const c=xs[i];let direction:'LONG'|'SHORT'|null=null;if(c.low<ref.low&&c.close>ref.low)direction='LONG';if(c.high>ref.high&&c.close<ref.high)direction='SHORT';if(!direction)continue;for(let j=i+1;j<Math.min(i+30,xs.length-2);j++){const prev=xs.slice(Math.max(i,j-3),j),m=xs[j];const mss=direction==='LONG'?m.close>Math.max(...prev.map(x=>x.high)):m.close<Math.min(...prev.map(x=>x.low));if(!mss)continue;for(let k=j+2;k<Math.min(j+20,xs.length);k++){const a=xs[k-2],b=xs[k-1],d=xs[k];let lo:number,hi:number;if(direction==='LONG'&&d.low>a.high){lo=a.high;hi=d.low}else if(direction==='SHORT'&&d.high<a.low){lo=d.high;hi=a.low}else continue;const entry=(lo+hi)/2,stop=direction==='LONG'?c.low:c.high,risk=Math.abs(entry-stop);if(!risk)break;const target2R=direction==='LONG'?entry+2*risk:entry-2*risk;let result:'WIN'|'LOSS'|'OPEN'='OPEN',r=0;for(const z of xs.slice(k+1)){const sl=direction==='LONG'?z.low<=stop:z.high>=stop,tp=direction==='LONG'?z.high>=target2R:z.low<=target2R;if(sl){result='LOSS';r=-1;break}if(tp){result='WIN';r=2;break}}out.push({referenceHour:refHour,direction,sweepTime:c.time,mssTime:m.time,entryTime:b.time,entry,stop,target2R,result,r});return out;}}}return out;}
