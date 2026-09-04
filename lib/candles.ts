export type Candle={
  time:string;
  open:number;
  high:number;
  low:number;
  close:number;
  tickVolume?:number;
  volume?:number;
  spread?:number;
};

export type CandleDay={date:string;candles:number};
