#property strict
#property version   "0.160"
#property description "Resilient chunked M1 bridge for SilverBulletAI"

input string ApiUrl="https://assistant-ochre-five.vercel.app/api/mt5/ingest";
input string BridgeToken="";
input string SymbolToSend="";
input string TimeframeToSend="M1";
input string SourceName="";
input int MinutesToSend=43200;
input int ChunkSize=1500;
input int SendEverySeconds=300;
input int MaxRetries=4;
input int RetryDelayMs=1200;

datetime lastSend=0;

string JsonEscape(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");return s;}
string IsoTime(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",d.year,d.mon,d.day,d.hour,d.min,d.sec);}
string PlainTime(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02d %02d:%02d:%02d",d.year,d.mon,d.day,d.hour,d.min,d.sec);}

int SendChunk(string sym,MqlRates &rates[],int oldestPos,int newestPos,int chunkIndex,int chunkTotal,int offset,string uploadId,int retryCount){
 string j="{";
 j+="\"token\":\""+JsonEscape(BridgeToken)+"\",";
 j+="\"symbol\":\""+JsonEscape(sym)+"\",";
 j+="\"timeframe\":\""+JsonEscape(TimeframeToSend)+"\",";
 string src=SourceName==""?AccountInfoString(ACCOUNT_SERVER):SourceName;
 j+="\"source\":\""+JsonEscape(src)+"\",";
 j+="\"brokerTimeRaw\":\""+PlainTime(TimeCurrent())+"\",";
 j+="\"brokerTimeUtc\":\""+IsoTime(TimeCurrent()-offset)+"\",";
 j+="\"brokerUtcOffsetSeconds\":"+IntegerToString(offset)+",";
 j+="\"uploadId\":\""+uploadId+"\",";
 j+="\"chunkIndex\":"+IntegerToString(chunkIndex)+",";
 j+="\"chunkTotal\":"+IntegerToString(chunkTotal)+",";
 j+="\"retryCount\":"+IntegerToString(retryCount)+",";
 j+="\"candles\":[";
 bool first=true;
 for(int i=oldestPos;i>=newestPos;i--){if(!first)j+=",";first=false;datetime u=rates[i].time-offset;j+=StringFormat("{\"time\":\"%s\",\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f,\"tickVolume\":%I64d,\"spread\":%d}",IsoTime(u),rates[i].open,rates[i].high,rates[i].low,rates[i].close,rates[i].tick_volume,rates[i].spread);}
 j+="]}";
 char post[],result[];string headers="Content-Type: application/json\r\n";int bytes=StringToCharArray(j,post,0,WHOLE_ARRAY,CP_UTF8);if(bytes>0)ArrayResize(post,bytes-1);
 ResetLastError();int status=WebRequest("POST",ApiUrl,headers,20000,post,result,headers);
 Print("SilverBulletBridge chunk ",chunkIndex+1,"/",chunkTotal," try ",retryCount+1," HTTP ",status,": ",CharArrayToString(result));
 if(status==-1)Print("WebRequest error=",GetLastError(),". Allow https://assistant-ochre-five.vercel.app in MT5.");
 return status;
}

void OnTick(){
 if(TimeCurrent()-lastSend<SendEverySeconds)return;lastSend=TimeCurrent();
 string sym=SymbolToSend==""?_Symbol:SymbolToSend;MqlRates rates[];ArraySetAsSeries(rates,true);
 int copied=CopyRates(sym,PERIOD_M1,0,MinutesToSend,rates);if(copied<10){Print("Not enough M1 candles");return;}
 int offset=(int)(TimeCurrent()-TimeGMT()),size=MathMax(250,ChunkSize),total=(copied+size-1)/size;
 string uploadId=sym+"-"+IntegerToString((int)TimeCurrent());
 for(int c=0;c<total;c++){
   int oldest=copied-1-c*size,newest=MathMax(0,oldest-size+1);
   bool ok=false;
   for(int attempt=0;attempt<=MaxRetries;attempt++){
      int status=SendChunk(sym,rates,oldest,newest,c,total,offset,uploadId,attempt);
      if(status>=200&&status<300){ok=true;break;}
      if(attempt<MaxRetries){Print("Retrying chunk ",c+1," in ",RetryDelayMs," ms");Sleep(RetryDelayMs*(attempt+1));}
   }
   if(!ok){Print("Chunk ",c+1," failed after ",MaxRetries+1," attempts. Sync paused.");break;}
   Sleep(120);
 }
}
