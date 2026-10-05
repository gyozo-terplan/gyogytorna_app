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

  function generate(tipus, perc, withWarmup, onlyFree, setsOverride){
    const r = RECIPES[tipus] || RECIPES.quick;
    const setsOf = id => setsOverride || window.exerciseSets(byId(id));
    const cost = id => byId(id).becsultMp*setsOf(id) + setsOf(id)*10; // gyakorlat + körönkénti átállás
    const warmCost = withWarmup ? window.WARMUP_GENERIC.reduce((t,w)=>t+w.becsultMp,0)+90+80 : 0;
    const budget = Math.max(180, perc*60 - warmCost);
    const cands = poolOnly(r.fix, onlyFree).concat(shuffle(poolOnly(r.pool, onlyFree)));
    let ids=[], sum=0;
    for(const id of cands){
      if(!byId(id)||ids.includes(id)) continue;
      if(ids.length>=1 && sum+cost(id)>budget) continue; // időkeretbe nem fér, jön a következő jelölt
      ids.push(id); sum+=cost(id);
      if(sum>=budget) break;
    }
    // blokksorrend megtartása (edukált sorrend)
    ids.sort((a,b)=>a-b);
    // levezetés: Szfinx (16) mindig a végére, ha még nincs benne
    if(!ids.includes(16)) ids.push(16);
    return {tipus, cim:r.cim, ids, withWarmup, onlyFree, perc};
  }

  function estimate(ids, withWarmup, setsOverride){
    const setsOf = id => setsOverride || window.exerciseSets(byId(id));
    let s = ids.reduce((t,id)=>t+(byId(id)?byId(id).becsultMp*setsOf(id):0),0);
    if(withWarmup) s += window.WARMUP_GENERIC.reduce((t,w)=>t+w.becsultMp,0) + 90; // + rövidített 1.blokk
    s += ids.reduce((t,id)=>t+setsOf(id)*10,0); // átállás körönként
    return Math.round(s/60);
  }

  return {RECIPES, generate, estimate, byId};
})();
