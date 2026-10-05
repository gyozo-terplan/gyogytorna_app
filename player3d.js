// 3D lejátszó: ízelt manöken (Three.js), póz-interpoláció, automata kamera.
// Betöltése csak akkor történik meg, ha van internet + WebGL; egyébként az app 2D-re esik vissza.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHuman } from './human-model.js?v=human-2';

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
  stand:[28,78,3.0,0.92], supine:[62,52,3.3,0.25], prone:[62,52,3.3,0.25],
  sideR:[58,55,3.3,0.25], sideL:[122,55,3.3,0.25], table:[60,65,3.2,0.45]
};

let renderer = null, scene = null, camera = null, controls = null;
let rig = null, container = null, rafId = 0, clockT = 0;
let cur = null, tgt = null, curEx = null, camTween = null;
let ballProp = null;
let ready = false, resizeObserver = null, lastTime = 0;
let viewBase = 'stand', viewOverride = null;

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

function ensure(box){
  if(ready) return true;
  container = box;
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  box.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Térbeli embermodell, formázott törzzsel és vállakkal');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    dispose();
    window.dispatchEvent(new CustomEvent('player3d-failed', { detail: 'webgl' }));
  });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(2.5, 1.6, 2.5);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2; controls.maxDistance = 7;
  controls.maxPolarAngle = 1.52;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.35;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x849ba3, 1.5));
  const dir = new THREE.DirectionalLight(0xfff2e6, 3);
  dir.position.set(2.5, 4.5, 2); scene.add(dir);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left:-2, right:2, top:2, bottom:-2, near:0.1, far:12 });
  dir.shadow.normalBias = 0.025;
  const fill = new THREE.DirectionalLight(0xd6efff, 1.7);
  fill.position.set(-3, 2, -2); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 40),
    new THREE.MeshStandardMaterial({ color:0xdfe7e4, roughness:1 }));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  ground.receiveShadow = true;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 2.3),
    new THREE.MeshStandardMaterial({ color:0xcfe0da, roughness:0.95 }));
  mat.position.y = 0.02; scene.add(mat);
  mat.receiveShadow = true;
  ballProp = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 18),
    new THREE.MeshStandardMaterial({ color:0xe67e22, roughness:0.6 }));
  ballProp.position.set(0, 0.32, 1.05); ballProp.visible = false; scene.add(ballProp);
  rig = buildHuman(); scene.add(rig.root);
  cur = { root:{ p:[0,0.95,0], r:[0,0,0] }, j:blankJoints() };
  tgt = JSON.parse(JSON.stringify(cur));
  const resize = () => {
    const w = box.clientWidth || 300, h = box.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
    setCam(viewBase, viewOverride);
  };
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe(box); resize();
  const loop = (time = performance.now()) => {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (time - (lastTime || time)) / 1000));
    lastTime = time;
    if(!box.getClientRects().length || document.hidden) return;
    clockT += dt;
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
    controls.update(dt);
    renderer.render(scene, camera);
  };
  loop();
  ready = true;
  return true;
}

function dispose(){
  cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
  controls?.dispose();
  scene?.traverse(o => {
    o.geometry?.dispose();
    o.skeleton?.dispose();
    if(o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
  renderer?.dispose();
  renderer?.domElement.remove();
  renderer = null; ready = false; curEx = null; lastTime = 0;
}

function setCam(base, override){
  viewBase = base; viewOverride = override;
  const c = override || CAMS[base] || CAMS.stand;
  const [az, pol, distance, ty] = c;
  const d = distance * Math.max(1, (base === 'stand' ? 0.85 : 1.15) / camera.aspect);
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
  modelVersion: 'human-2',
  retry: dispose,
  show(box, exId, stepIdx){
    let P = null;
    try{
      if(!ensure(box)) return false;
      P = (window.POSES3D||{})[exId];
      if(!P) return false;
      if(curEx !== exId){
        curEx = exId;
        setCam(P.base, P.cam);
        ballProp.visible = (exId===22 || exId===23);
      }
      // Későn betöltődő modell és újraindítás esetén is ugyanaz a teljes póz álljon elő.
      applyBase(P.base);
      for(const st of P.steps.slice(0, Math.min(stepIdx, P.steps.length-1) + 1)){
        if(st.root){
          if(st.root.p) tgt.root.p = st.root.p.slice();
          if(st.root.r) tgt.root.r = st.root.r.slice();
        }
        const sj = clampPose({...tgt.j, ...st.j});
        for(const jn of JOINTS) tgt.j[jn] = sj[jn].slice();
      }
      return true;
    }catch(e){ console.error('3D megjelenítés:', e); dispose(); return false; }
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
    }catch(e){ console.error('3D megjelenítés:', e); dispose(); return false; }
  }
};
window.Player3D = api;
window.dispatchEvent(new Event("player3d-ready"));
