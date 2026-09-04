#property strict
#property version   "0.10"
#property description "Read-only M1 candle bridge for SilverBulletAI"

input string ApiUrl = "https://YOUR-VERCEL-URL.vercel.app/api/mt5/ingest";
input string BridgeToken = "";
input string SymbolToSend = "";
input int MinutesToSend = 900;
input int SendEverySeconds = 30;

datetime lastSend = 0;

string JsonEscape(string s) {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}

string IsoTime(datetime t) {
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

void OnTick() {
   if(TimeCurrent() - lastSend < SendEverySeconds) return;
   lastSend = TimeCurrent();

   string sym = SymbolToSend == "" ? _Symbol : SymbolToSend;
   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   int copied = CopyRates(sym, PERIOD_M1, 0, MinutesToSend, rates);
   if(copied < 10) {
      Print("SilverBulletBridge: not enough M1 candles for ", sym);
      return;
   }

   string json = "{";
   json += "\"token\":\"" + JsonEscape(BridgeToken) + "\",";
   json += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   json += "\"brokerTime\":\"" + IsoTime(TimeCurrent()) + "\",";
   json += "\"candles\":[";

   for(int i=copied-1; i>=0; i--) {
      json += StringFormat(
         "{\"time\":\"%s\",\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f}",
         IsoTime(rates[i].time), rates[i].open, rates[i].high, rates[i].low, rates[i].close
      );
      if(i > 0) json += ",";
   }
   json += "]}";

   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);

   ResetLastError();
   int status = WebRequest("POST", ApiUrl, headers, 10000, post, result, headers);

   if(status == -1) {
      Print("SilverBulletBridge WebRequest failed. Error=", GetLastError());
      Print("Add this URL in MT5: Tools > Options > Expert Advisors > Allow WebRequest: ", ApiUrl);
      return;
   }

   Print("SilverBulletBridge HTTP ", status, ": ", CharArrayToString(result));
}
