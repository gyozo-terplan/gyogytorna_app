// Pózkönyvtár 1. rész: bemelegítés + 1-15. gyakorlat.
// Formátum: lépésenként csak az elmozduló ízületek (fok); a többi öröklődik.
// Ízületek: spine chest neck | shL elL shR elR (váll/könyök; könyök-hajlítás negatív)
//           hipL kneeL hipR kneeR (csípő/térd; térd-hajlítás pozitív)
// root: {p:[x,y,z], r:[x,y,z]} — csak ha a testhelyzet is mozdul (pl. híd-emelés).
window.POSES3D = Object.assign(window.POSES3D || {}, {
w1:{base:"stand", steps:[
  {j:{}},
  {j:{hipL:[-45,0,0], kneeL:[70,0,0], shL:[25,0,0], shR:[-25,0,0]}},
  {j:{hipL:[0,0,0], kneeL:[5,0,0], hipR:[-45,0,0], kneeR:[70,0,0], shL:[-25,0,0], shR:[25,0,0]}}
]},
w2:{base:"stand", steps:[
  {j:{}},
  {j:{shL:[-120,0,10], shR:[-120,0,-10], elL:[-15,0,0], elR:[-15,0,0]}},
  {j:{shL:[-20,0,10], shR:[-20,0,-10], elL:[-8,0,0], elR:[-8,0,0], spine:[0,20,0], chest:[0,15,0]}}
]},
w3:{base:"stand", steps:[
  {j:{}},
  {j:{spine:[0,0,12], chest:[0,0,10]}},
  {j:{spine:[0,0,0], chest:[0,0,0], hipL:[-25,0,0], kneeL:[40,0,0], hipR:[-25,0,0], kneeR:[40,0,0]}}
]},
w4:{base:"stand", steps:[
  {j:{shL:[-160,0,10], shR:[-160,0,-10]}},
  {j:{chest:[-8,0,0]}},
  {j:{shL:[-10,0,5], shR:[-10,0,-5], chest:[0,0,0], spine:[8,0,0]}}
]},
1:{base:"supine", steps:[
  {j:{hipR:[-75,0,0], kneeR:[85,0,0]}},
  {j:{hipR:[-75,0,0], kneeR:[5,0,0]}},
  {j:{hipR:[-75,0,0], kneeR:[85,0,0]}},
  {j:{hipR:[-75,0,0], kneeR:[45,0,0]}}
]},
2:{base:"supine", steps:[
  {j:{chest:[-10,0,0]}},
  {j:{shL:[-170,0,15], shR:[-170,0,-15]}},
  {j:{}},
  {j:{shL:[-15,0,10], shR:[-15,0,-10], chest:[0,0,0]}}
]},
3:{base:"sideR", steps:[
  {j:{}},
  {j:{}},
  {j:{shR:[0,0,-95]}},
  {j:{shR:[-10,0,-10]}}
]},
4:{base:"sideR", steps:[
  {j:{shR:[0,0,-95]}},
  {j:{shR:[-120,0,-60]}},
  {j:{shR:[60,0,-60]}},
  {j:{shR:[0,0,-95]}}
]},
5:{base:"table", steps:[
  {j:{hipR:[-105,0,0], kneeR:[10,0,0]}},
  {j:{hipR:[-5,0,0], kneeR:[0,0,0], shL:[-170,0,0]}},
  {j:{}},
  {j:{hipR:[-90,0,0], kneeR:[90,0,0], shL:[-90,0,0]}}
]},
6:{base:"table", steps:[
  {j:{hipR:[-105,0,0], kneeR:[10,0,0]}},
  {j:{hipR:[-5,0,0], kneeR:[0,0,0], shL:[-170,0,0]}},
  {j:{}},
  {j:{hipR:[-90,0,0], kneeR:[90,0,0], shL:[-90,0,0]}}
]},
7:{base:"table", steps:[
  {j:{hipL:[-70,0,0], kneeL:[80,0,0]}},
  {j:{hipL:[-90,0,0], kneeL:[85,0,0]}},
  {j:{spine:[0,0,0]}},
  {j:{hipL:[-70,0,0], kneeL:[80,0,0]}}
]},
8:{base:"prone", steps:[
  {j:{neck:[10,0,0]}},
  {j:{shL:[35,0,8], shR:[35,0,-8], chest:[-6,0,0]}},
  {j:{neck:[-5,0,0]}},
  {j:{shL:[-8,0,6], shR:[-8,0,-6], chest:[0,0,0], neck:[0,0,0]}}
]},
9:{base:"prone", steps:[
  {j:{shL:[-20,0,55], shR:[-20,0,-55], elL:[-95,0,0], elR:[-95,0,0]}},
  {j:{shL:[15,0,55], shR:[15,0,-55]}},
  {j:{shL:[35,0,45], shR:[35,0,-45]}},
  {j:{shL:[-20,0,55], shR:[-20,0,-55]}}
]},
10:{base:"prone", steps:[
  {j:{shL:[35,0,8], shR:[35,0,-8], elL:[0,0,0], elR:[0,0,0]}},
  {j:{shL:[10,0,50], shR:[10,0,-50], elL:[-90,0,0], elR:[-90,0,0]}},
  {j:{shL:[-160,0,20], shR:[-160,0,-20], elL:[0,0,0], elR:[0,0,0]}},
  {j:{shL:[10,0,50], shR:[10,0,-50], elL:[-90,0,0], elR:[-90,0,0]}}
]},
11:{base:"supine", steps:[
  {j:{spine:[18,0,0], chest:[10,0,0]}},
  {j:{hipR:[-60,0,0], kneeR:[15,0,0]}},
  {j:{}},
  {j:{spine:[0,0,0], chest:[0,0,0], hipR:[-8,0,0], kneeR:[8,0,0]}}
]},
12:{base:"sideR", steps:[
  {j:{kneeL:[70,0,0], kneeR:[70,0,0], shR:[-30,0,-20], elR:[-70,0,0]}},
  {j:{}, root:{p:[0,0.30,0]}},
  {j:{}},
  {j:{}, root:{p:[0,0.17,0]}}
]},
13:{base:"supine", steps:[
  {j:{shL:[-170,0,8], shR:[-170,0,-8], hipL:[-90,0,0], kneeL:[90,0,0], hipR:[-90,0,0], kneeR:[90,0,0]}},
  {j:{hipR:[-45,0,0], kneeR:[90,0,0]}},
  {j:{}},
  {j:{hipR:[-90,0,0]}}
]},
14:{base:"supine", steps:[
  {j:{shL:[-170,0,8], shR:[-170,0,-8], hipL:[-90,0,0], kneeL:[90,0,0], hipR:[-90,0,0], kneeR:[90,0,0]}},
  {j:{hipR:[-25,0,0], kneeR:[5,0,0]}},
  {j:{}},
  {j:{hipR:[-90,0,0], kneeR:[90,0,0]}}
]},
15:{base:"supine", steps:[
  {j:{shL:[-170,0,8], shR:[-170,0,-8], hipL:[-90,0,0], kneeL:[90,0,0], hipR:[-90,0,0], kneeR:[90,0,0]}},
  {j:{hipR:[-25,0,0], kneeR:[5,0,0], shL:[-180,0,8]}},
  {j:{}},
  {j:{hipR:[-90,0,0], kneeR:[90,0,0], shL:[-170,0,8]}}
]}
});
