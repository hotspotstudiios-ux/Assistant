export default function MT5Page() {
  return (
    <main>
      <div className="head">
        <span className="pill">MT5 BRIDGE</span>
        <h1>Connect MetaTrader 5</h1>
        <p>Read-only bridge for sending M1 candles from your MT5 terminal into SilverBulletAI.</p>
      </div>
      <section>
        <h2>Connection flow</h2>
        <p>Broker → MetaTrader 5 → SilverBulletBridge EA → /api/mt5/ingest → 8AM/9AM analysis</p>
      </section>
      <div className="note">
        <b>Safety:</b> this build does not place, modify, or close trades. It only reads candle history and sends it to the analyzer.
      </div>
    </main>
  );
}
