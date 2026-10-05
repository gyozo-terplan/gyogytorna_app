// 3D lejátszó: ízelt manöken (Three.js), póz-interpoláció, automata kamera.
// Betöltése csak akkor történik meg, ha van internet + WebGL; egyébként az app 2D-re esik vissza.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const D2R = Math.PI / 180;
// Ízületi határok (fok) — védenek a természetellenes pózoktól
const LIMITS = {
  spine:[[-30,45],[-30,30],[-25,25]], chest:[[-30,45],[-25,25],[-20,20]],
  neck:[[-30,30],[-30,30],[-20,20]],
  shL:[[-180,60],[-20,20],[-100,100]], shR:[[-180,60],[-20,20],[-100,100]],
  elL:[[-150,0],[0,0],[0,0]], elR:[[-150,0],[0,0],[0,0]],
  hipL:[[-120,45],[-15,15],[-60,60]], hipR:[[-120,45],[-15,15],[-60,60]],
  kneeL:[[0,150],[0,0],[0,0]], kneeR:[[0,150],[0,0],[0,0]]
};
const JOINTS = ["spine","chest","neck","shL","elL","shR","elR","hipL","kneeL","hipR","kneeR"];

// Bázis testhelyzetek: gyökér pozíció/rotáció + semleges ízületek
const BASES = {
  stand:  { root:{ p:[0,0.95,0], r:[0,0,0] },        j:{ elL:[-8,0,0], elR:[-8,0,0] } },
  supine: { root:{ p:[0,0.17,-0.1], r:[-90,0,0] },   j:{ shL:[-8,0,6], shR:[-8,0,-6], elL:[-8,0,0], elR:[-8,0,0] } },
  prone:  { root:{ p:[0,0.17,0.1], r:[90,0,0] },     j:{ shL:[-8,0,6], shR:[-8,0,-6], elL:[-8,0,0], elR:[-8,0,0] } },
  sideR:  { root:{ p:[0,0.17,0], r:[-90,90,0] },     j:{ shL:[-170,0,0], shR:[-10,0,-10], elL:[-20,0,0], elR:[-10,0,0] } },
  sideL:  { root:{ p:[0,0.17,0], r:[-90,-90,0] },    j:{ shR:[-170,0,0], shL:[-10,0,10], elR:[-20,0,0], elL:[-10,0,0] } },
  table:  { root:{ p:[0,0.68,0], r:[-90,180,0] },    j:{ shL:[-90,0,0], shR:[-90,0,0], elL:[-5,0,0], elR:[-5,0,0], hipL:[-90,0,0], hipR:[-90,0,0], kneeL:[90,0,0], kneeR:[90,0,0] } }
};
// Kamera nézet bázisonként: [azimut°, pólus°, táv, cél-magasság]
const CAMS = {
  stand:[25,72,3.6,0.95], supine:[90,66,3.6,0.25], prone:[90,66,3.6,0.25],
  sideR:[90,66,3.6,0.25], sideL:[90,66,3.6,0.25], table:[90,64,3.6,0.45]
};

let renderer = null, scene = null, camera = null, controls = null;
let rig = null, container = null, rafId = 0, clockT = 0;
let cur = null, tgt = null, curEx = null, camTween = null;
let ballProp = null;

function clampPose(j){
  const out = {};
  for(const k of JOINTS){
    const v = (j && j[k]) || [0,0,0];
    const L = LIMITS[k];
    out[k] = [0,1,2].map(i => Math.min(L[i][1], Math.max(L[i][0], v[i]||0)));
  }
  return out;
}
function blankJoints(){ const o={}; for(const k of JOINTS) o[k]=[0,0,0]; return o; }

function limb(r, len, mat){
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.position.y = -(len/2 + r*0.5);
  return m;
}
function buildRig(){
  const mat = new THREE.MeshStandardMaterial({ color:0x0e6e5c, roughness:0.75 });
  const dark = new THREE.MeshStandardMaterial({ color:0x0a4a49, roughness:0.8 });
  const R = {};
  const root = new THREE.Group(); root.position.set(0,0.95,0); R.root = root;
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), mat);
  pelvis.scale.set(1.15, 0.8, 0.9); root.add(pelvis);
  const mk = (parent, x,y,z) => { const g = new THREE.Group(); g.position.set(x,y,z); parent.add(g); return g; };
  R.spine = mk(root, 0,0.10,0);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.12, 6, 12), mat);
  belly.position.y = 0.08; R.spine.add(belly);
  R.chest = mk(R.spine, 0,0.22,0);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.16, 6, 12), mat);
  chest.position.y = 0.10; R.chest.add(chest);
  R.neck = mk(R.chest, 0,0.24,0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.08,12), dark);
  neck.position.y = 0.04; R.neck.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), new THREE.MeshStandardMaterial({ color:0xe8b98a, roughness:0.7 }));
  head.position.y = 0.16; R.neck.add(head);
  for(const s of ["L","R"]){
    const sx = s==="L" ? 1 : -1;
    const sh = mk(R.chest, 0.24*sx, 0.16, 0); R["sh"+s] = sh;
    const ua = limb(0.045, 0.22, mat); sh.add(ua);
    const el = mk(sh, 0,-0.30,0); R["el"+s] = el;
    const fa = limb(0.04, 0.20, mat); el.add(fa);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), dark);
    hand.position.y = -0.30; el.add(hand);
    const hip = mk(root, 0.11*sx, -0.04, 0); R["hip"+s] = hip;
    const th = limb(0.07, 0.30, mat); hip.add(th);
    const knee = mk(hip, 0,-0.44,0); R["knee"+s] = knee;
    const sh2 = limb(0.055, 0.30, mat); knee.add(sh2);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.06,0.22), dark);
    foot.position.set(0,-0.45,0.06); knee.add(foot);
  }
  return R;
}

function ensure(box){
  if(renderer) return true;
  container = box;
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  box.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(2.5, 1.6, 2.5);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2; controls.maxDistance = 7;
  controls.maxPolarAngle = 1.52;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.7;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9db8b0, 1.2));
  const dir = new THREE.DirectionalLight(0xffffff, 2.4);
  dir.position.set(2.5, 4.5, 2); scene.add(dir);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 40),
    new THREE.MeshStandardMaterial({ color:0xdfe7e4, roughness:1 }));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 2.3),
    new THREE.MeshStandardMaterial({ color:0xcfe0da, roughness:0.95 }));
  mat.position.y = 0.02; scene.add(mat);
  ballProp = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 18),
    new THREE.MeshStandardMaterial({ color:0xe67e22, roughness:0.6 }));
  ballProp.position.set(0, 0.32, 1.05); ballProp.visible = false; scene.add(ballProp);
  rig = buildRig(); scene.add(rig.root);
  cur = { root:{ p:[0,0.95,0], r:[0,0,0] }, j:blankJoints() };
  tgt = JSON.parse(JSON.stringify(cur));
  const resize = () => {
    const w = box.clientWidth || 300, h = box.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(box); resize();
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, 1/60); clockT += dt;
    const k = 1 - Math.exp(-3.5*dt);
    for(const ax of [0,1,2]){
      cur.root.p[ax] += (tgt.root.p[ax]-cur.root.p[ax])*k;
      cur.root.r[ax] += (tgt.root.r[ax]-cur.root.r[ax])*k;
    }
    for(const jn of JOINTS)
      for(const ax of [0,1,2])
        cur.j[jn][ax] += (tgt.j[jn][ax]-cur.j[jn][ax])*k;
    rig.root.position.set(...cur.root.p);
    rig.root.rotation.set(cur.root.r[0]*D2R, cur.root.r[1]*D2R, cur.root.r[2]*D2R);
    for(const jn of JOINTS){
      const g = rig[jn];
      g.rotation.set(cur.j[jn][0]*D2R, cur.j[jn][1]*D2R, cur.j[jn][2]*D2R);
    }
    rig.chest.rotation.x += Math.sin(clockT*1.6)*0.02; // "lélegző" mikro-mozgás
    if(camTween){
      controls.target.lerp(camTween.tgt, 0.06);
      camera.position.lerp(camTween.pos, 0.06);
      if(camera.position.distanceTo(camTween.pos) < 0.02) camTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  loop();
  return true;
}

function setCam(base, override){
  const c = override || CAMS[base] || CAMS.stand;
  const [az, pol, d, ty] = c;
  const a = az*D2R, p = pol*D2R;
  camTween = {
    tgt: new THREE.Vector3(0, ty, 0),
    pos: new THREE.Vector3(d*Math.sin(p)*Math.sin(a), ty + d*Math.cos(p), d*Math.sin(p)*Math.cos(a))
  };
}

function applyBase(base){
  const B = BASES[base] || BASES.stand;
  tgt.root = { p:B.root.p.slice(), r:B.root.r.slice() };
  const bj = clampPose(B.j);
  for(const jn of JOINTS) tgt.j[jn] = bj[jn].slice();
}

const api = {
  show(box, exId, stepIdx){
    let P = null;
    try{
      if(!ensure(box)) return false;
      P = (window.POSES3D||{})[exId];
      if(!P) return false;
      if(curEx !== exId){
        curEx = exId;
        applyBase(P.base);
        setCam(P.base, P.cam);
        ballProp.visible = (exId===22 || exId===23);
      }
      const st = P.steps[Math.min(stepIdx, P.steps.length-1)] || {};
      if(st.root){
        if(st.root.p) tgt.root.p = st.root.p.slice();
        if(st.root.r) tgt.root.r = st.root.r.slice();
      }
      const sj = clampPose(Object.assign({}, (()=>{const o={}; for(const jn of JOINTS)o[jn]=tgt.j[jn]; return o;})(), st.j||{}));
      for(const jn of JOINTS) tgt.j[jn] = sj[jn].slice();
      return true;
    }catch(e){ return false; }
  },
  rest(box){
    try{
      if(!ensure(box)) return false;
      if(curEx !== "__rest__"){
        curEx = "__rest__";
        applyBase("stand");
        setCam("stand");
        ballProp.visible = false;
      }
      // karok lassan fel-le = mély légzés pihenő alatt
      const s = (Math.sin(Date.now()/2400)+1)/2;
      tgt.j.shL = [-150*s-10, 0, 8]; tgt.j.shR = [-150*s-10, 0, -8];
      return true;
    }catch(e){ return false; }
  }
};
window.Player3D = api;
window.dispatchEvent(new Event("player3d-ready"));
