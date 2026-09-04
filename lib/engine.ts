export type Candle = { time: string; open: number; high: number; low: number; close: number };
export type RefHour = 8 | 9;
export type Signal = {
  referenceHour: RefHour;
  direction: 'LONG' | 'SHORT';
  sweepTime: string;
  mssTime: string;
  entryTime: string;
  entry: number;
  stop: number;
  target2R: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  r: number;
};

const nyParts = (iso: string) => {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(d);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
};

function hourRange(candles: Candle[], hour: RefHour) {
  const xs = candles.filter(c => Number(nyParts(c.time).hour) === hour);
  if (!xs.length) return null;
  return {
    high: Math.max(...xs.map(x => x.high)),
    low: Math.min(...xs.map(x => x.low))
  };
}

function afterHour(candles: Candle[], h: RefHour) {
  return candles.filter(c => Number(nyParts(c.time).hour) >= h + 1);
}

export function backtest(candles: Candle[], refHour: RefHour): Signal[] {
  const ref = hourRange(candles, refHour);
  if (!ref) return [];
  const xs = afterHour(candles, refHour);
  const out: Signal[] = [];

  for (let i = 3; i < xs.length - 3; i++) {
    const c = xs[i];
    let direction: 'LONG' | 'SHORT' | null = null;

    if (c.low < ref.low && c.close > ref.low) direction = 'LONG';
    if (c.high > ref.high && c.close < ref.high) direction = 'SHORT';
    if (!direction) continue;

    for (let j = i + 1; j < Math.min(i + 30, xs.length - 2); j++) {
      const prev = xs.slice(Math.max(i, j - 3), j);
      const m = xs[j];
      const mss = direction === 'LONG'
        ? m.close > Math.max(...prev.map(x => x.high))
        : m.close < Math.min(...prev.map(x => x.low));

      if (!mss) continue;

      for (let k = j + 2; k < Math.min(j + 20, xs.length); k++) {
        const a = xs[k - 2];
        const b = xs[k - 1];
        const d = xs[k];

        let fvgLow: number;
        let fvgHigh: number;

        if (direction === 'LONG' && d.low > a.high) {
          fvgLow = a.high;
          fvgHigh = d.low;
        } else if (direction === 'SHORT' && d.high < a.low) {
          fvgLow = d.high;
          fvgHigh = a.low;
        } else {
          continue;
        }

        const entry = (fvgLow + fvgHigh) / 2;
        const stop = direction === 'LONG' ? c.low : c.high;
        const risk = Math.abs(entry - stop);
        if (!risk) break;

        const target2R = direction === 'LONG' ? entry + 2 * risk : entry - 2 * risk;
        let result: 'WIN' | 'LOSS' | 'OPEN' = 'OPEN';
        let r = 0;

        for (const z of xs.slice(k + 1)) {
          const hitSL = direction === 'LONG' ? z.low <= stop : z.high >= stop;
          const hitTP = direction === 'LONG' ? z.high >= target2R : z.low <= target2R;

          if (hitSL && hitTP) { result = 'LOSS'; r = -1; break; }
          if (hitSL) { result = 'LOSS'; r = -1; break; }
          if (hitTP) { result = 'WIN'; r = 2; break; }
        }

        out.push({
          referenceHour: refHour,
          direction,
          sweepTime: c.time,
          mssTime: m.time,
          entryTime: b.time,
          entry,
          stop,
          target2R,
          result,
          r
        });

        return out;
      }
    }
  }

  return out;
}
