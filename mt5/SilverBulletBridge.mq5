#property strict
#property version   "0.140"
#property description "Chunked read-only M1 bridge for SilverBulletAI"

input string ApiUrl="https://assistant-ochre-five.vercel.app/api/mt5/ingest";
input string BridgeToken="";
input string SymbolToSend="";
input int MinutesToSend=43200;
input int ChunkSize=2500;
input int SendEverySeconds=300;
datetime lastSend=0;

string JsonEscape(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");return s;}
string IsoTime(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",d.year,d.mon,d.day,d.hour,d.min,d.sec);}
string PlainTime(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02d %02d:%02d:%02d",d.year,d.mon,d.day,d.hour,d.min,d.sec);}

bool SendChunk(string sym,MqlRates &rates[],int copied,int oldestPos,int newestPos,int chunkIndex,int chunkTotal,int offset,string uploadId){
 string j="{";
 j+="\"token\":\""+JsonEscape(BridgeToken)+"\",";
 j+="\"symbol\":\""+JsonEscape(sym)+"\",";
 j+="\"brokerTimeRaw\":\""+PlainTime(TimeCurrent())+"\",";
 j+="\"brokerTimeUtc\":\""+IsoTime(TimeCurrent()-offset)+"\",";
 j+="\"brokerUtcOffsetSeconds\":"+IntegerToString(offset)+",";
 j+="\"uploadId\":\""+uploadId+"\",\"chunkIndex\":"+IntegerToString(chunkIndex)+",\"chunkTotal\":"+IntegerToString(chunkTotal)+",\"reset\":"+(chunkIndex==0?"true":"false")+",\"candles\":[";
 bool first=true;
 for(int i=oldestPos;i>=newestPos;i--){if(!first)j+=",";first=false;datetime u=rates[i].time-offset;j+=StringFormat("{\"time\":\"%s\",\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f}",IsoTime(u),rates[i].open,rates[i].high,rates[i].low,rates[i].close);}
 j+="]}";
 char post[],result[];string headers="Content-Type: application/json\r\n";int bytes=StringToCharArray(j,post,0,WHOLE_ARRAY,CP_UTF8);if(bytes>0)ArrayResize(post,bytes-1);
 ResetLastError();int status=WebRequest("POST",ApiUrl,headers,15000,post,result,headers);
 Print("SilverBulletBridge chunk ",chunkIndex+1,"/",chunkTotal," HTTP ",status,": ",CharArrayToString(result));
 if(status==-1)Print("WebRequest error=",GetLastError(),". Allow https://assistant-ochre-five.vercel.app in MT5.");
 return status>=200&&status<300;
}
void OnTick(){
 if(TimeCurrent()-lastSend<SendEverySeconds)return;lastSend=TimeCurrent();
 string sym=SymbolToSend==""?_Symbol:SymbolToSend;MqlRates rates[];ArraySetAsSeries(rates,true);
 int copied=CopyRates(sym,PERIOD_M1,0,MinutesToSend,rates);if(copied<10){Print("Not enough M1 candles");return;}
 int offset=(int)(TimeCurrent()-TimeGMT()),size=MathMax(250,ChunkSize),total=(copied+size-1)/size;
 string uploadId=sym+"-"+IntegerToString((int)TimeCurrent());
 for(int c=0;c<total;c++){int oldest=copied-1-c*size,newest=MathMax(0,oldest-size+1);if(!SendChunk(sym,rates,copied,oldest,newest,c,total,offset,uploadId)){Print("Chunk upload stopped at ",c+1);break;}Sleep(150);}
}