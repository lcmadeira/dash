/* global document, Intl, Date, Object, parseInt, window */
(() => {
/* ── Relógios das Praças Financeiras ── */
const MARKETS=[
  {city:"Lisboa",    flag:"🇵🇹",tz:"Europe/Lisbon",   exch:"Euronext",oH:8, oM:0, cH:16,cM:30,days:[1,2,3,4,5]},
  {city:"Londres",   flag:"🇬🇧",tz:"Europe/London",   exch:"LSE",     oH:8, oM:0, cH:16,cM:30,days:[1,2,3,4,5]},
  {city:"Frankfurt", flag:"🇩🇪",tz:"Europe/Berlin",   exch:"XETRA",   oH:9, oM:0, cH:17,cM:30,days:[1,2,3,4,5]},
  {city:"Nova Iorque",flag:"🇺🇸",tz:"America/New_York",exch:"NYSE",   oH:9, oM:30,cH:16,cM:0, days:[1,2,3,4,5]},
  {city:"Chicago",   flag:"🇺🇸",tz:"America/Chicago", exch:"CME",     oH:8, oM:30,cH:15,cM:0, days:[1,2,3,4,5]},
  {city:"São Paulo", flag:"🇧🇷",tz:"America/Sao_Paulo",exch:"B3",     oH:10,oM:0, cH:17,cM:0, days:[1,2,3,4,5]},
  {city:"Dubai",     flag:"🇦🇪",tz:"Asia/Dubai",      exch:"DFM",     oH:10,oM:0, cH:14,cM:0, days:[0,1,2,3,4]},
  {city:"Mumbai",    flag:"🇮🇳",tz:"Asia/Kolkata",    exch:"BSE",     oH:9, oM:15,cH:15,cM:30,days:[1,2,3,4,5]},
  {city:"Xangai",    flag:"🇨🇳",tz:"Asia/Shanghai",   exch:"SSE",     oH:9, oM:30,cH:15,cM:0, days:[1,2,3,4,5]},
  {city:"Hong Kong", flag:"🇭🇰",tz:"Asia/Hong_Kong",  exch:"HKEX",    oH:9, oM:30,cH:16,cM:0, days:[1,2,3,4,5]},
  {city:"Tóquio",    flag:"🇯🇵",tz:"Asia/Tokyo",      exch:"TSE",     oH:9, oM:0, cH:15,cM:30,days:[1,2,3,4,5]},
  {city:"Sidney",    flag:"🇦🇺",tz:"Australia/Sydney", exch:"ASX",    oH:10,oM:0, cH:16,cM:0, days:[1,2,3,4,5]},
];
function mktLocal(tz){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit",weekday:"short",hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return{h:parseInt(p.hour)%24,m:parseInt(p.minute),dow:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday]??0,str:p.hour+":"+p.minute};
}
function mktStatus(mkt,l){
  if(!mkt.days.includes(l.dow))return"closed";
  const n=l.h*60+l.m,o=mkt.oH*60+mkt.oM,c=mkt.cH*60+mkt.cM;
  if(n>=o&&n<c)return"open";if(n>=o-30&&n<o)return"pre";if(n>=c&&n<c+30)return"post";return"closed";
}
function tickMarkets(){
  const bar=document.getElementById("mkt-bar");if(!bar)return;
  bar.innerHTML=MARKETS.map(m=>{
    const l=mktLocal(m.tz),st=mktStatus(m,l);
    return`<div class="mkt-city ${st}" title="${m.exch} · ${m.city}"><div class="mkt-city-dot"></div><div class="mkt-city-flag">${m.flag}</div><div class="mkt-city-time">${l.str}</div><div class="mkt-city-name">${m.city}</div><div class="mkt-city-exch">${m.exch}</div></div>`;
  }).join("");
}

  window.tickMarkets = tickMarkets;
})();
