#property strict
#property version   "0.120"
#property description "Read-only M1 candle bridge for SilverBulletAI"

input string ApiUrl = "https://assistant-ochre-five.vercel.app/api/mt5/ingest";
input string BridgeToken = "";
input string SymbolToSend = "";
input int MinutesToSend = 2880;
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

string PlainTime(datetime t) {
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return StringFormat("%04d-%02d-%02d %02d:%02d:%02d",
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

   int brokerUtcOffsetSeconds = (int)(TimeCurrent() - TimeGMT());
   datetime brokerNow = TimeCurrent();
   datetime brokerUtc = brokerNow - brokerUtcOffsetSeconds;

   string json = "{";
   json += "\"token\":\"" + JsonEscape(BridgeToken) + "\",";
   json += "\"symbol\":\"" + JsonEscape(sym) + "\",";
   json += "\"brokerTimeRaw\":\"" + PlainTime(brokerNow) + "\",";
   json += "\"brokerTimeUtc\":\"" + IsoTime(brokerUtc) + "\",";
   json += "\"brokerUtcOffsetSeconds\":" + IntegerToString(brokerUtcOffsetSeconds) + ",";
   json += "\"candles\":[";

   for(int i=copied-1; i>=0; i--) {
      datetime utcTime = rates[i].time - brokerUtcOffsetSeconds;
      json += StringFormat(
         "{\"time\":\"%s\",\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f}",
         IsoTime(utcTime), rates[i].open, rates[i].high, rates[i].low, rates[i].close
      );
      if(i > 0) json += ",";
   }
   json += "]}";

   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   int bytes = StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(bytes > 0) ArrayResize(post, bytes - 1);

   ResetLastError();
   int status = WebRequest("POST", ApiUrl, headers, 10000, post, result, headers);

   if(status == -1) {
      Print("SilverBulletBridge WebRequest failed. Error=", GetLastError());
      Print("Allow this origin in MT5 WebRequest settings: https://assistant-ochre-five.vercel.app");
      return;
   }

   Print("SilverBulletBridge HTTP ", status, ": ", CharArrayToString(result));
}
