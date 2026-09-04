import type { Candle } from './candles';

export type Direction='BULLISH'|'BEARISH';
export type StructureBias='BULLISH'|'BEARISH'|'NEUTRAL';

export type Swing={
  kind:'HIGH'|'LOW';
  time:string;
  price:number;
  index:number;
  confirmedAtIndex:number;
};

export type LiquiditySweep={
  direction:Direction;
  time:string;
  index:number;
  levelTime:string;
  level:number;
  depth:number;
  closeBackInside:boolean;
};

export type Displacement={
  direction:Direction;
  time:string;
  index:number;
  body:number;
  range:number;
  rangeMultiple:number;
  bodyPercent:number;
};

export type StructureBreak={
  direction:Direction;
  classification:'BREAK'|'BOS'|'MSS';
  time:string;
  index:number;
  levelTime:string;
  level:number;
  closeDistance:number;
  biasBefore:StructureBias;
  biasAfter:StructureBias;
};

export type FVG={
  direction:Direction;
  time:string;
  index:number;
  low:number;
  high:number;
  size:number;
  sizeMultiple:number;
  displacementLinked:boolean;
};

export type PriceActionAnalysis={
  bias:StructureBias;
  swings:Swing[];
  sweeps:LiquiditySweep[];
  displacements:Displacement[];
  structureBreaks:StructureBreak[];
  fvgs:FVG[];
  meta:{
    candles:number;
    swingLeft:number;
    swingRight:number;
    displacementRangeMultiple:number;
    minBodyPercent:number;
  };
};

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const range=(c:Candle)=>Math.max(0,c.high-c.low);
const body=(c:Candle)=>Math.abs(c.close-c.open);

export function detectSwings(c:Candle[],left=2,right=2):Swing[]{
  const out:Swing[]=[];
  for(let i=left;i<c.length-right;i++){
    const x=c[i],before=c.slice(i-left,i),after=c.slice(i+1,i+right+1);
    const high=before.every(z=>x.high>z.high)&&after.every(z=>x.high>=z.high);
    const low=before.every(z=>x.low<z.low)&&after.every(z=>x.low<=z.low);
    if(high)out.push({kind:'HIGH',time:x.time,price:x.high,index:i,confirmedAtIndex:i+right});
    if(low)out.push({kind:'LOW',time:x.time,price:x.low,index:i,confirmedAtIndex:i+right});
  }
  return out.sort((a,b)=>a.index-b.index);
}

export function detectSweeps(c:Candle[],swings:Swing[]):LiquiditySweep[]{
  const out:LiquiditySweep[]=[];
  for(const s of swings){
    for(let i=Math.max(s.confirmedAtIndex+1,s.index+1);i<c.length;i++){
      const x=c[i];
      if(s.kind==='HIGH'&&x.high>s.price){
        out.push({
          direction:'BEARISH',time:x.time,index:i,levelTime:s.time,level:s.price,
          depth:x.high-s.price,closeBackInside:x.close<s.price
        });
        break;
      }
      if(s.kind==='LOW'&&x.low<s.price){
        out.push({
          direction:'BULLISH',time:x.time,index:i,levelTime:s.time,level:s.price,
          depth:s.price-x.low,closeBackInside:x.close>s.price
        });
        break;
      }
    }
  }
  return out;
}

export function detectDisplacements(
  c:Candle[],
  lookback=20,
  displacementRangeMultiple=1.5,
  minBodyPercent=.6
):Displacement[]{
  const out:Displacement[]=[];
  for(let i=1;i<c.length;i++){
    const x=c[i],r=range(x),b=body(x);
    if(r<=0)continue;
    const baseline=avg(c.slice(Math.max(0,i-lookback),i).map(range).filter(v=>v>0));
    if(baseline<=0)continue;
    const multiple=r/baseline,bodyPercent=b/r;
    if(multiple<displacementRangeMultiple||bodyPercent<minBodyPercent)continue;
    out.push({
      direction:x.close>=x.open?'BULLISH':'BEARISH',
      time:x.time,index:i,body:b,range:r,rangeMultiple:multiple,bodyPercent
    });
  }
  return out;
}

export function detectStructureBreaks(c:Candle[],swings:Swing[]):StructureBreak[]{
  const out:StructureBreak[]=[];
  const broken=new Set<string>();
  let bias:StructureBias='NEUTRAL';

  for(let i=0;i<c.length;i++){
    const confirmed=swings.filter(s=>s.confirmedAtIndex<i);
    const high=[...confirmed].reverse().find(s=>s.kind==='HIGH'&&!broken.has('H:'+s.time));
    const low=[...confirmed].reverse().find(s=>s.kind==='LOW'&&!broken.has('L:'+s.time));

    let direction:Direction|null=null;
    let level:Swing|null=null;
    if(high&&c[i].close>high.price){direction='BULLISH';level=high}
    else if(low&&c[i].close<low.price){direction='BEARISH';level=low}
    if(!direction||!level)continue;

    const before=bias;
    const after:StructureBias=direction;
    const classification:StructureBreak['classification']=
      before==='NEUTRAL'?'BREAK':
      before===direction?'BOS':'MSS';

    out.push({
      direction,classification,time:c[i].time,index:i,
      levelTime:level.time,level:level.price,
      closeDistance:Math.abs(c[i].close-level.price),
      biasBefore:before,biasAfter:after
    });

    broken.add((level.kind==='HIGH'?'H:':'L:')+level.time);
    bias=after;
  }
  return out;
}

export function detectFVGs(c:Candle[],displacements:Displacement[],minSizeMultiple=.05):FVG[]{
  const out:FVG[]=[];
  const displacementSet=new Set(displacements.map(x=>x.index));
  for(let i=2;i<c.length;i++){
    const a=c[i-2],d=c[i],baseline=avg(c.slice(Math.max(0,i-20),i).map(range).filter(v=>v>0));
    if(baseline<=0)continue;

    if(d.low>a.high){
      const size=d.low-a.high,sizeMultiple=size/baseline;
      if(sizeMultiple>=minSizeMultiple)out.push({
        direction:'BULLISH',time:d.time,index:i,low:a.high,high:d.low,size,sizeMultiple,
        displacementLinked:displacementSet.has(i-1)||displacementSet.has(i)
      });
    }
    if(d.high<a.low){
      const size=a.low-d.high,sizeMultiple=size/baseline;
      if(sizeMultiple>=minSizeMultiple)out.push({
        direction:'BEARISH',time:d.time,index:i,low:d.high,high:a.low,size,sizeMultiple,
        displacementLinked:displacementSet.has(i-1)||displacementSet.has(i)
      });
    }
  }
  return out;
}

export function analyzePriceAction(
  candles:Candle[],
  options?:{
    swingLeft?:number;
    swingRight?:number;
    displacementRangeMultiple?:number;
    minBodyPercent?:number;
    minFvgSizeMultiple?:number;
  }
):PriceActionAnalysis{
  const swingLeft=options?.swingLeft??2;
  const swingRight=options?.swingRight??2;
  const displacementRangeMultiple=options?.displacementRangeMultiple??1.5;
  const minBodyPercent=options?.minBodyPercent??.6;
  const minFvgSizeMultiple=options?.minFvgSizeMultiple??.05;

  const swings=detectSwings(candles,swingLeft,swingRight);
  const sweeps=detectSweeps(candles,swings);
  const displacements=detectDisplacements(candles,20,displacementRangeMultiple,minBodyPercent);
  const structureBreaks=detectStructureBreaks(candles,swings);
  const fvgs=detectFVGs(candles,displacements,minFvgSizeMultiple);
  const bias=structureBreaks.at(-1)?.biasAfter??'NEUTRAL';

  return{
    bias,swings,sweeps,displacements,structureBreaks,fvgs,
    meta:{candles:candles.length,swingLeft,swingRight,displacementRangeMultiple,minBodyPercent}
  };
}
