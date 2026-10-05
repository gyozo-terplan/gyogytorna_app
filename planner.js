// Automatikus edzés-összeállító: 5 típus, eszközszűréssel
window.PLANNER = (function(){
  function byId(id){ return window.EXERCISES.find(e=>e.id===id); }
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
  function poolOnly(ids, onlyFree){ return onlyFree ? ids.filter(id=>byId(id).eszkoz.length===0) : ids.slice(); }

  const RECIPES = {
    free:   {cim:"Eszköz nélküli", desc:"Csak saját testsúly, semmi eszköz.", fix:[1,5,9,13,18,26], pool:[8,10,11,14,15,17,19,20,21]},
    quick:  {cim:"Gyors 15 perces", desc:"Rövid átmozgató mix minden blokkból.", fix:[1,5,9,13,18,26], pool:[]},
    core:   {cim:"Törzs + has", desc:"Dead bug, híd, tigris fókusz.", fix:[13,18,26], pool:[11,14,15,17,19,20,21,27,28]},
    back:   {cim:"Hát + lapocka", desc:"I-W-Y, bird-dog, mellkasnyitás.", fix:[5,9], pool:[2,3,4,6,8,10]},
    full:   {cim:"Teljes testes", desc:"Minden blokkból, ~30-40 perc.", fix:[], pool:[1,2,5,6,8,9,10,11,13,15,18,19,22,24,26,27]}
  };

  // időkeret percekben -> cél gyakorlat-darabszám (bemelegítés + levezetés nélkül)
  function targetCount(perc){ if(perc<=15) return 6; if(perc<=20) return 8; if(perc<=30) return 10; return 12; }

  function generate(tipus, perc, withWarmup, onlyFree){
    const r = RECIPES[tipus] || RECIPES.quick;
    let fix = poolOnly(r.fix, onlyFree);
    let pool = shuffle(poolOnly(r.pool, onlyFree));
    const n = targetCount(perc);
    let ids = fix.slice();
    for(const id of pool){ if(ids.length>=n) break; if(!ids.includes(id)) ids.push(id); }
    // blokksorrend megtartása (edukált sorrend)
    ids.sort((a,b)=>a-b);
    // levezetés: Szfinx (16) mindig a végére, ha még nincs benne
    if(!ids.includes(16)) ids.push(16);
    return {tipus, cim:r.cim, ids, withWarmup, onlyFree, perc};
  }

  function estimate(ids, withWarmup){
    let s = ids.reduce((t,id)=>t+(byId(id)?byId(id).becsultMp:0),0);
    if(withWarmup) s += window.WARMUP_GENERIC.reduce((t,w)=>t+w.becsultMp,0) + 90; // + rövidített 1.blokk
    s += ids.length*10; // átállás
    return Math.round(s/60);
  }

  return {RECIPES, generate, estimate, byId};
})();
