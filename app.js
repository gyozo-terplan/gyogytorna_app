// Fő logika: lista, összeállító, lejátszó, TTS
(function(){
"use strict";
const $ = id => document.getElementById(id);
const store = {
  load(){ try{ return JSON.parse(localStorage.getItem("edzesProgram")||"null"); }catch{ return null; } },
  save(v){ localStorage.setItem("edzesProgram", JSON.stringify(v)); }
};

// ---------- Tabok ----------
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); $("tab-"+b.dataset.tab).classList.add("active");
});
function goTab(name){ document.querySelector(`nav button[data-tab="${name}"]`).click(); }

// ---------- TTS ----------
let huVoices=[];
function refreshVoices(){
  const all = speechSynthesis? speechSynthesis.getVoices():[];
  huVoices = all.filter(v=>v.lang&&v.lang.toLowerCase().startsWith("hu"));
  const sel=$("voiceSelect"); sel.innerHTML="";
  const list = huVoices.length? huVoices : all;
  list.forEach((v,i)=>{ const o=document.createElement("option"); o.value=v.name; o.textContent=`${v.name} (${v.lang})`; sel.appendChild(o); });
  if(huVoices.length===0){
    const o=document.createElement("option"); o.textContent="Nincs magyar hang — a böngésző alaphangja szól"; sel.appendChild(o);
  }
}
if("speechSynthesis" in window){ refreshVoices(); speechSynthesis.onvoiceschanged=refreshVoices; }
function speak(text){
  if(!$("voiceOn").checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="hu-HU"; u.rate=parseFloat($("voiceRate").value||"1");
  const want=$("voiceSelect").value;
  const v=speechSynthesis.getVoices().find(v=>v.name===want);
  if(v) u.voice=v;
  speechSynthesis.speak(u);
}
$("btnTestVoice").onclick=()=>speak("Sziasztok! Kezdjük a bemelegítést. Helyben járás, karlengetéssel.");

// ---------- Lista + kézi ----------
let manualSel = new Set((store.load()&&store.load().ids)||[1,5,9,13,18,26]);
function eszkozBadge(e){
  if(!e.eszkoz.length) return `<span class="badge">eszköz nélkül</span>`;
  return e.eszkoz.map(k=>`<span class="badge tool">${window.ESZKOZ_LABEL[k]||k}</span>`).join("");
}
function renderList(){
  const onlyFree=$("filterFree").checked, q=($("search").value||"").toLowerCase();
  const box=$("exerciseList"); box.innerHTML="";
  window.EXERCISES.filter(e=>(!onlyFree||e.eszkoz.length===0)&&(e.nev+e.blokk).toLowerCase().includes(q)).forEach(e=>{
    const d=document.createElement("div"); d.className="card";
    d.innerHTML=`<h3>${e.id}. ${e.nev}</h3><small>${e.blokk} • ${e.ismetles}</small><div>${eszkozBadge(e)}</div>
    <p><b>Kiinduló:</b> ${e.kiindulo}</p><ol>${e.lepesek.map(l=>`<li>${l}</li>`).join("")}</ol>`;
    box.appendChild(d);
  });
}
function renderManual(){
  const onlyFree=$("manualFree").checked;
  const box=$("manualList"); box.innerHTML="";
  window.EXERCISES.filter(e=>!onlyFree||e.eszkoz.length===0).forEach(e=>{
    const l=document.createElement("label"); l.className="card";
    l.innerHTML=`<input type="checkbox" data-id="${e.id}" ${manualSel.has(e.id)?"checked":""}> <span><b>${e.id}. ${e.nev}</b> <small>(${e.ismetles})</small> ${eszkozBadge(e)}</span>`;
    l.querySelector("input").onchange=ev=>{ ev.target.checked? manualSel.add(e.id):manualSel.delete(e.id); buildFromManual(); };
    box.appendChild(l);
  });
}
$("filterFree").onchange=renderList; $("search").oninput=renderList;
$("manualFree").onchange=renderManual;
$("manualAll").onclick=()=>{ window.EXERCISES.forEach(e=>{if(!$("manualFree").checked||e.eszkoz.length===0)manualSel.add(e.id);}); renderManual(); buildFromManual(); };
$("manualNone").onclick=()=>{ manualSel.clear(); renderManual(); buildFromManual(); };

// ---------- Program építés ----------
function toItemWarmup(w){ return {kind:"warmup", nev:w.nev+" (bemelegítés)", steps:w.lepesek, meta:w.ismetles, secs:w.becsultMp, tts:w.tts, eszkoz:[]}; }
function toItemEx(e, warm){ return {kind:warm?"warmup":"ex", nev:e.nev+(warm?" (bemelegítés, rövidített)":""), steps:e.lepesek, meta:(warm?"rövidített • ":"")+e.ismetles, secs:warm?Math.max(45,Math.round(e.becsultMp/2)):e.becsultMp, tts:e.tts, eszkoz:e.eszkoz}; }
function warmupItems(){ return [...window.WARMUP_GENERIC.map(toItemWarmup), ...[1,2,3,4].map(id=>toItemEx(PLANNER.byId(id),true))]; }

let program=[]; // {nev,steps,meta,secs,tts,eszkoz,kind}
function setProgram(items, meta){
  program=items;
  store.save({ids:[...manualSel], auto:meta||null});
  renderProgram();
}
function buildFromManual(){
  const ids=[...manualSel].sort((a,b)=>a-b);
  const items=($("withWarmup").checked? warmupItems():[]).concat(ids.map(id=>toItemEx(PLANNER.byId(id),false)));
  setProgram(items,{src:"manual"});
}
$("withWarmup").onchange=buildFromManual;

// ---------- Auto ----------
let autoType="free", autoRes=null;
function renderAuto(){
  const g=$("autoGrid"); g.innerHTML="";
  Object.entries(PLANNER.RECIPES).forEach(([key,r])=>{
    const b=document.createElement("button"); b.textContent=r.cim; b.title=r.desc;
    if(key===autoType)b.classList.add("sel");
    b.onclick=()=>{autoType=key; renderAuto(); previewAuto();};
    g.appendChild(b);
  });
}
function previewAuto(){
  autoRes=PLANNER.generate(autoType, parseInt($("autoPerc").value,10), $("autoWarmup").checked, $("autoFree").checked);
  const ids=autoRes.ids;
  const mins=PLANNER.estimate(ids, autoRes.withWarmup);
  $("autoPreview").innerHTML=`<b>${autoRes.cim}</b> • ${ids.length} gyakorlat • kb. ${mins} perc ${autoRes.onlyFree?"• eszköz nélkül":""}<ol>${ids.map(id=>{const e=PLANNER.byId(id);return `<li>${e.nev} <small>(${e.ismetles})</small></li>`;}).join("")}</ol>`;
}
["autoPerc","autoWarmup","autoFree"].forEach(id=>$(id).onchange=previewAuto);
$("btnShuffle").onclick=previewAuto;
$("btnAccept").onclick=()=>{
  manualSel=new Set(autoRes.ids); renderManual();
  const items=(autoRes.withWarmup?warmupItems():[]).concat(autoRes.ids.map(id=>toItemEx(PLANNER.byId(id),false)));
  setProgram(items,{src:"auto",type:autoType});
  goTab("jatszo"); startAt(0,true);
};
function renderProgram(){
  $("programList").innerHTML=program.map(p=>`<li>${p.nev} <small>(${p.meta})</small></li>`).join("");
  const mins=Math.round(program.reduce((t,p)=>t+p.secs,0)/60);
  $("programInfo").innerHTML=program.length? `<b>${program.length} tétel • kb. ${mins} perc</b>`:"Üres program.";
  $("navCount").textContent=program.length?`(${program.length})`:"";
}
$("btnStart").onclick=()=>{ if(!program.length)buildFromManual(); goTab("jatszo"); startAt(0,true); };

// ---------- Lejátszó ----------
let idx=0, remaining=0, tick=null, paused=false, inRest=false;
function show(){
  const p=program[idx];
  if(!p){ $("pName").textContent="Válassz programot az Összeállítóban."; return; }
  $("progBar").style.width=((idx)/program.length*100)+"%";
  $("progText").textContent=`${idx+1}. / ${program.length}${inRest?" • PIHENŐ":""}`;
  $("pName").textContent=(inRest?"Pihenő — következő: ":"")+p.nev;
  $("pMeta").textContent=p.meta+(p.eszkoz.length?` • Készítsd elő: ${p.eszkoz.map(k=>window.ESZKOZ_LABEL[k]).join(", ")}`:"");
  $("pSteps").innerHTML="<ol>"+p.steps.map(s=>`<li>${s}</li>`).join("")+"</ol>";
  $("pTimer").textContent=fmt(remaining);
}
function fmt(s){ s=Math.max(0,Math.round(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function stopTick(){ if(tick)clearInterval(tick); tick=null; }
function runTick(onDone){
  stopTick();
  tick=setInterval(()=>{
    if(paused) return;
    remaining--;
    $("pTimer").textContent=fmt(remaining);
    if(remaining<=3&&remaining>0) speak(String(remaining));
    if(remaining<=0){ stopTick(); onDone(); }
  },1000);
}
function announceCurrent(){
  const p=program[idx];
  speak(`${idx+1}. gyakorlat. ${p.nev}. ${p.tts}`);
  if(p.eszkoz.length) setTimeout(()=>speak(`Készítsd elő: ${p.eszkoz.map(k=>window.ESZKOZ_LABEL[k]).join(", ")}`), 100);
}
function startAt(i, announce){
  if(!program.length){ goTab("ossze"); return; }
  idx=Math.max(0,Math.min(i,program.length-1)); inRest=false; paused=false; $("btnPause").textContent="⏸ Szünet";
  remaining=program[idx].secs; show();
  if(announce) announceCurrent();
  if($("autoStep").checked) runTick(()=>goRestOrNext());
  else { stopTick(); }
  try{ navigator.wakeLock&&navigator.wakeLock.request("screen"); }catch{}
}
function goRestOrNext(){
  if(idx+1>=program.length){ speak("Gratulálok! Végeztél az edzéssel."); $("progBar").style.width="100%"; $("pName").textContent="✅ Kész!"; return; }
  const rest=parseInt($("restSec").value,10);
  inRest=true; remaining=rest; show();
  speak(`Pihenő. Következő: ${program[idx+1].nev}.`);
  runTick(()=>{ idx++; inRest=false; remaining=program[idx].secs; show(); announceCurrent(); runTick(()=>goRestOrNext()); });
}
$("btnNext").onclick=()=>{ speechSynthesis&&speechSynthesis.cancel(); stopTick(); if(idx+1<program.length){startAt(idx+1,true);} };
$("btnPrev").onclick=()=>{ speechSynthesis&&speechSynthesis.cancel(); stopTick(); startAt(idx-1,true); };
$("btnRestart").onclick=()=>startAt(idx,true);
$("btnSpeak").onclick=()=>announceCurrent();
$("btnPause").onclick=()=>{ paused=!paused; $("btnPause").textContent=paused?"▶ Folytatás":"⏸ Szünet"; if(paused)speechSynthesis&&speechSynthesis.cancel(); };

// ---------- Init ----------
renderList(); renderManual(); renderAuto(); previewAuto();
const saved=store.load();
buildFromManual();
})();
