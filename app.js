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

// ---------- Körök (sorozatok) ----------
function setsFor(e){ const o=parseInt($("setCount").value,10); return o>0 ? o : window.exerciseSets(e); }
$("setCount").onchange=()=>{ renderManual(); buildFromManual(); previewAuto(); };
function animMode(){ const m=$("animMode").value; return (m==="3d"||m==="2d"||m==="off")?m:"3d"; }
let no3d=false, lastPose3d="";
function setAnimMode(m){ try{localStorage.setItem("edzesAnimMode",m);}catch(e){} no3d=false; lastPose3d=""; show(); }
try{
  const _m=localStorage.getItem("edzesAnimMode");
  if(_m) $("animMode").value=_m;
  else if(localStorage.getItem("edzesAnim")==="0") $("animMode").value="off";
}catch(e){}
$("animMode").onchange=()=>setAnimMode($("animMode").value);
window.addEventListener("player3d-ready",()=>{ no3d=false; lastPose3d=""; if(animMode()==="3d") show(); });

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
    l.innerHTML=`<input type="checkbox" data-id="${e.id}" ${manualSel.has(e.id)?"checked":""}> <span><b>${e.id}. ${e.nev}</b> <small>(${window.setsLabel(setsFor(e))}${e.ismetles})</small> ${eszkozBadge(e)}</span>`;
    l.querySelector("input").onchange=ev=>{ ev.target.checked? manualSel.add(e.id):manualSel.delete(e.id); buildFromManual(); };
    box.appendChild(l);
  });
}
$("filterFree").onchange=renderList; $("search").oninput=renderList;
$("manualFree").onchange=renderManual;
$("manualAll").onclick=()=>{ window.EXERCISES.forEach(e=>{if(!$("manualFree").checked||e.eszkoz.length===0)manualSel.add(e.id);}); renderManual(); buildFromManual(); };
$("manualNone").onclick=()=>{ manualSel.clear(); renderManual(); buildFromManual(); };

// ---------- Program építés ----------
function toItemWarmup(w){ return {kind:"warmup", exId:w.id, nev:w.nev+" (bemelegítés)", kiindulo:"", steps:w.lepesek, meta:w.ismetles, secs:w.becsultMp, sets:1, tts:w.tts, eszkoz:[]}; }
function toItemEx(e, warm){ const sets=warm?1:setsFor(e); return {kind:warm?"warmup":"ex", exId:e.id, nev:e.nev+(warm?" (bemelegítés, rövidített)":""), kiindulo:e.kiindulo||"", steps:e.lepesek, meta:(warm?"rövidített • ":"")+window.setsLabel(sets)+e.ismetles, secs:warm?Math.max(45,Math.round(e.becsultMp/2)):e.becsultMp, sets, tts:e.tts, eszkoz:e.eszkoz}; }
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
  const ov=parseInt($("setCount").value,10)||0;
  autoRes=PLANNER.generate(autoType, parseInt($("autoPerc").value,10), $("autoWarmup").checked, $("autoFree").checked, ov);
  const ids=autoRes.ids;
  const mins=PLANNER.estimate(ids, autoRes.withWarmup, ov);
  $("autoPreview").innerHTML=`<b>${autoRes.cim}</b> • ${ids.length} gyakorlat • kb. ${mins} perc ${autoRes.onlyFree?"• eszköz nélkül":""}<ol>${ids.map(id=>{const e=PLANNER.byId(id);const s=ov||window.exerciseSets(e);return `<li>${e.nev} <small>(${window.setsLabel(s)}${e.ismetles})</small></li>`;}).join("")}</ol>`;
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
  const mins=Math.round(program.reduce((t,p)=>t+p.secs*p.sets,0)/60);
  $("programInfo").innerHTML=program.length? `<b>${program.length} tétel • kb. ${mins} perc</b>`:"Üres program.";
  $("navCount").textContent=program.length?`(${program.length})`:"";
}
$("btnStart").onclick=()=>{ if(!program.length)buildFromManual(); goTab("jatszo"); startAt(0,true); };

// ---------- Lejátszó ----------
let idx=0, setIdx=1, remaining=0, tick=null, paused=false, inRest=false, restKind="";
const KOR_NEV=["","Első","Második","Harmadik","Negyedik","Ötödik"];
function korNev(n){ return KOR_NEV[n]||`${n}.`; }
function show(){
  const p=program[idx];
  if(!p){ $("pName").textContent="Válassz programot az Összeállítóban."; return; }
  $("progBar").style.width=((idx)/program.length*100)+"%";
  $("progText").textContent=`${idx+1}. / ${program.length}${inRest?(restKind==="set"?" • KÖRKÖZI PIHENŐ":" • PIHENŐ"):""}`;
  if(inRest&&restKind==="set") $("pName").textContent="Körközi pihenő — "+p.nev;
  else if(inRest) $("pName").textContent="Pihenő — következő: "+program[Math.min(idx+1,program.length-1)].nev;
  else $("pName").textContent=p.nev;
  $("pMeta").textContent=p.meta+(p.eszkoz.length?` • Készítsd elő: ${p.eszkoz.map(k=>window.ESZKOZ_LABEL[k]).join(", ")}`:"");
  $("pSet").textContent=p.sets>1?`${korNev(setIdx)} kör / ${p.sets}`:"";
  const st=$("pStart");
  if(!inRest&&p.kiindulo){ st.style.display=""; st.innerHTML=`<b>📍 Kiinduló helyzet:</b> ${p.kiindulo}`; }
  else { st.style.display="none"; st.innerHTML=""; }
  $("pSteps").innerHTML=inRest?"":"<ol>"+p.steps.map(s=>`<li>${s}</li>`).join("")+"</ol>";
  $("pTimer").textContent=fmt(remaining);
  $("pTimer").classList.remove("urgent");
  updateSteps();
}
let elapsed=0;
function updateSteps(){
  const p=program[idx]; if(!p) return;
  const lis=$("pSteps").querySelectorAll("li");
  let k=0;
  if(!inRest&&lis.length){
    const per=p.secs/Math.max(1,p.steps.length);
    k=Math.min(lis.length-1,Math.floor(elapsed/per));
    lis.forEach((li,i)=>li.classList.toggle("active",i===k));
  } else lis.forEach(li=>li.classList.remove("active"));
  renderVisual(k);
}
function renderVisual(k){
  const p=program[idx]; if(!p) return;
  const pA=$("pAnim"), p3=$("p3d");
  const key=(inRest?"R":"")+idx+":"+k;
  if(animMode()==="3d" && !no3d && window.Player3D){
    let ok=false;
    if(key!==lastPose3d){
      ok = inRest ? window.Player3D.rest(p3) : window.Player3D.show(p3, p.exId, k);
      if(ok) lastPose3d=key; else no3d=true;
    } else ok=true;
    if(ok){ p3.style.display=""; pA.style.display="none"; pA.dataset.t=""; return; }
  }
  // 2D figura vagy kikapcsolt animáció
  p3.style.display="none";
  if(animMode()!=="off" && !inRest && window.renderAnim){
    const t=window.ANIM_MAP ? (window.ANIM_MAP[p.exId]||"pulse") : "pulse";
    if(pA.dataset.t!==t+idx){ window.renderAnim(pA,t); pA.dataset.t=t+idx; }
    pA.style.display="";
  } else { pA.style.display="none"; pA.dataset.t=""; }
}
function fmt(s){ s=Math.max(0,Math.round(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function stopTick(){ if(tick)clearInterval(tick); tick=null; }
function runTick(onDone){
  stopTick();
  tick=setInterval(()=>{
    if(paused) return;
    remaining--; elapsed++;
    $("pTimer").textContent=fmt(remaining);
    updateSteps();
    if(remaining<=3&&remaining>0){ $("pTimer").classList.add("urgent"); speak(String(remaining)); }
    if(remaining<=0){ stopTick(); onDone(); }
  },1000);
}
function announceCurrent(){
  // Egyetlen összefűzött mondat: a darabolt speak() hívások szakították meg egymást (cancel).
  const p=program[idx];
  const korTxt=p.sets>1?`${korNev(setIdx)} kör a ${p.sets}-ból. `:"";
  const eszkozTxt=p.eszkoz.length?`Készítsd elő: ${p.eszkoz.map(k=>window.ESZKOZ_LABEL[k]).join(", ")}. `:"";
  const startTxt=p.kiindulo?`Kiinduló helyzet: ${p.kiindulo}. `:"";
  speak(`${idx+1}. gyakorlat. ${p.nev}. ${korTxt}${eszkozTxt}${startTxt}${p.tts}`);
}
function announceSet(){
  const p=program[idx];
  speak(`${korNev(setIdx)} kör. ${p.tts}`);
}
function startAt(i, announce){
  if(!program.length){ goTab("ossze"); return; }
  idx=Math.max(0,Math.min(i,program.length-1)); setIdx=1;
  inRest=false; restKind=""; paused=false; $("btnPause").textContent="⏸ Szünet";
  remaining=program[idx].secs; elapsed=0; show();
  if(announce) announceCurrent();
  if($("autoStep").checked) runTick(()=>nextSetOrNext());
  else { stopTick(); }
  try{ navigator.wakeLock&&navigator.wakeLock.request("screen"); }catch{}
}
function nextSetOrNext(){
  // Automata módban egy kör lejárt: van még kör hátra?
  const p=program[idx];
  if(setIdx<p.sets){
    inRest=true; restKind="set"; remaining=5; elapsed=0; show();
    speak(`Pihenő. Jön a ${korNev(setIdx+1).toLowerCase()} kör.`);
    runTick(()=>{ setIdx++; inRest=false; restKind=""; remaining=p.secs; elapsed=0; show(); announceSet(); runTick(()=>nextSetOrNext()); });
  } else goRestOrNext();
}
function goRestOrNext(){
  if(idx+1>=program.length){ speak("Gratulálok! Végeztél az edzéssel."); $("progBar").style.width="100%"; $("pName").textContent="✅ Kész!"; return; }
  const rest=parseInt($("restSec").value,10);
  inRest=true; restKind="ex"; remaining=rest; elapsed=0; show();
  speak(`Pihenő. Következő: ${program[idx+1].nev}.`);
  runTick(()=>{ idx++; setIdx=1; inRest=false; restKind=""; remaining=program[idx].secs; elapsed=0; show(); announceCurrent(); runTick(()=>nextSetOrNext()); });
}
function nextPress(){
  // Kézi léptetés: előbb a hátralévő körök, aztán a következő gyakorlat.
  if(!program.length) return;
  speechSynthesis&&speechSynthesis.cancel(); stopTick();
  const p=program[idx];
  if(setIdx<p.sets){ setIdx++; inRest=false; restKind=""; remaining=p.secs; elapsed=0; show(); announceSet(); if($("autoStep").checked) runTick(()=>nextSetOrNext()); }
  else if(idx+1<program.length){ startAt(idx+1,true); }
  else { speak("Gratulálok! Végeztél az edzéssel."); $("progBar").style.width="100%"; $("pName").textContent="✅ Kész!"; }
}
$("btnNext").onclick=nextPress;
$("btnPrev").onclick=()=>{ speechSynthesis&&speechSynthesis.cancel(); stopTick(); startAt(Math.max(0,idx-1),true); };
$("btnRestart").onclick=()=>{ if(!program.length) return; stopTick(); inRest=false; restKind=""; remaining=program[idx].secs; elapsed=0; show(); announceSet(); if($("autoStep").checked) runTick(()=>nextSetOrNext()); };
$("btnSpeak").onclick=()=>announceCurrent();
$("btnPause").onclick=()=>{ paused=!paused; $("btnPause").textContent=paused?"▶ Folytatás":"⏸ Szünet"; if(paused)speechSynthesis&&speechSynthesis.cancel(); };

// ---------- Init ----------
renderList(); renderManual(); renderAuto(); previewAuto();
const saved=store.load();
buildFromManual();
})();
