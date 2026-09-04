export default function MT5Page() {
  return (
    <main>
      <div className="hero">
        <div>
          <span className="eyebrow">MT5 DATA BRIDGE</span>
          <h1>Connect MetaTrader 5</h1>
          <p>Read-only candle transport for the Price Action Lab.</p>
        </div>
      </div>
      <section>
        <div className="panelhead"><span>Connection flow</span><small>M1 data</small></div>
        <p>Broker → MetaTrader 5 → bridge EA → /api/mt5/ingest → persistent candle database → Price Action Engine.</p>
      </section>
      <div className="footnote">This bridge does not place, modify, or close trades. It only reads candle history and sends market data to the analyzer.</div>
    </main>
  );
}
