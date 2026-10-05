import * as THREE from 'three';

// Elliptikus keresztmetszetekből formázott, zárt testfelület.
// A szomszédos testrészek átfednek az ízületeknél: hajlításkor sem nyílik rés.
function contour(rings, material) {
  const segments = 40;
  const positions = [], indices = [];
  for (const [y, width, depth, z = 0] of rings) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      positions.push(width * Math.cos(a), y, z + depth * Math.sin(a));
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * segments + i, b = r * segments + (i + 1) % segments;
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function buildHuman() {
  const shirt = new THREE.MeshStandardMaterial({ color: 0x268b87, roughness: 0.83 });
  const shoulderFabric = new THREE.MeshStandardMaterial({ color: 0x3aaba4, roughness: 0.83 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x273e59, roughness: 0.92 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89470, roughness: 0.75 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x322821, roughness: 0.96 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xd6e4e3, roughness: 0.9 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x252932, roughness: 0.6 });
  const rig = { root: new THREE.Group() };
  rig.root.name = 'human-body';

  function joint(parent, name, x, y, z = 0) {
    const g = new THREE.Bone();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    rig[name] = g;
    return g;
  }
  function ellipsoid(parent, material, size, position, name) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
    m.scale.set(...size);
    m.position.set(...position);
    m.name = name || '';
    parent.add(m);
    return m;
  }
  function surface(parent, material, rings, name) {
    const m = contour(rings, material);
    m.name = name;
    parent.add(m);
    return m;
  }

  surface(rig.root, trousers, [
    [-0.13, 0, 0], [-0.09, 0.15, 0.106], [-0.02, 0.19, 0.122],
    [0.07, 0.175, 0.115], [0.145, 0.154, 0.105], [0.17, 0, 0]
  ], 'pelvis');
  const anchor = joint(rig.root, 'bodyAnchor', 0, 0);
  joint(anchor, 'spine', 0, 0.10);
  joint(rig.spine, 'chest', 0, 0.22);
  // Egyetlen, csontokkal deformált felület a deréktól a nyakig.
  // Nincsenek egymásra tett mellkas/has hengerek vagy sötét illesztési rések.
  const torsoGeometry = contour([
    [0.05, 0, 0], [0.065, 0.176, 0.117], [0.105, 0.174, 0.116],
    [0.16, 0.16, 0.108], [0.21, 0.158, 0.105], [0.27, 0.175, 0.114],
    [0.33, 0.20, 0.126], [0.40, 0.225, 0.137], [0.47, 0.247, 0.127],
    [0.515, 0.235, 0.111], [0.555, 0.15, 0.087],
    [0.58, 0.076, 0.066], [0.595, 0, 0]
  ], shirt).geometry;
  const indices = [], weights = [];
  const positions = torsoGeometry.attributes.position;
  for(let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const spineWeight = THREE.MathUtils.smoothstep(y, 0.075, 0.24);
    const chestWeight = THREE.MathUtils.smoothstep(y, 0.27, 0.46);
    indices.push(0, 1, 2, 0);
    weights.push(1 - spineWeight, spineWeight * (1 - chestWeight), spineWeight * chestWeight, 0);
  }
  torsoGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  torsoGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const torso = new THREE.SkinnedMesh(torsoGeometry, shirt);
  torso.name = 'continuous-torso';
  rig.root.add(torso);
  rig.root.updateMatrixWorld(true);
  torso.bind(new THREE.Skeleton([anchor, rig.spine, rig.chest]));
  // Nyakkivágás, fej, arc: az arc iránya a testhelyzetet is olvashatóvá teszi.
  ellipsoid(rig.chest, trousers, [0.082, 0.022, 0.07], [0, 0.247, 0], 'collar');
  joint(rig.chest, 'neck', 0, 0.24);
  ellipsoid(rig.neck, skin, [0.052, 0.093, 0.052], [0, 0.06, 0]);
  ellipsoid(rig.neck, skin, [0.104, 0.136, 0.104], [0, 0.198, 0.002], 'head');
  ellipsoid(rig.neck, skin, [0.071, 0.05, 0.069], [0, 0.13, 0.016], 'jaw');
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, 1.7), hair);
  hairCap.scale.set(0.107, 0.139, 0.105);
  hairCap.position.set(0, 0.209, -0.006);
  rig.neck.add(hairCap);
  ellipsoid(rig.neck, skin, [0.018, 0.028, 0.025], [0, 0.185, 0.103], 'nose');
  for (const sign of [-1, 1]) {
    ellipsoid(rig.neck, skin, [0.018, 0.031, 0.019], [sign * 0.103, 0.19, 0]);
    ellipsoid(rig.neck, eye, [0.009, 0.006, 0.005], [sign * 0.037, 0.212, 0.097]);
  }

  for (const s of ['L', 'R']) {
    const sign = s === 'L' ? 1 : -1;
    const shoulder = joint(rig.chest, 'sh' + s, 0.246 * sign, 0.165);
    ellipsoid(shoulder, shoulderFabric, [0.095, 0.10, 0.099], [0, -0.01, 0], 'deltoid-' + s);
    surface(shoulder, shoulderFabric, [
      [-0.17, 0, 0], [-0.145, 0.075, 0.072], [-0.07, 0.086, 0.086],
      [0.02, 0.082, 0.083], [0.065, 0, 0]
    ], 'sleeve-' + s);
    surface(shoulder, skin, [
      [-0.335, 0, 0], [-0.305, 0.053, 0.052], [-0.25, 0.059, 0.064],
      [-0.18, 0.070, 0.075], [-0.10, 0.069, 0.07], [-0.07, 0, 0]
    ], 'upper-arm-' + s);
    const elbow = joint(shoulder, 'el' + s, 0, -0.30);
    ellipsoid(elbow, skin, [0.055, 0.059, 0.057], [0, 0, 0]);
    surface(elbow, skin, [
      [-0.29, 0, 0], [-0.27, 0.034, 0.035], [-0.22, 0.039, 0.042],
      [-0.13, 0.054, 0.06], [-0.055, 0.059, 0.06], [0.025, 0.046, 0.046],
      [0.04, 0, 0]
    ], 'forearm-' + s);
    ellipsoid(elbow, skin, [0.048, 0.068, 0.029], [0, -0.30, 0.003], 'palm-' + s);
    ellipsoid(elbow, skin, [0.019, 0.041, 0.021], [-sign * 0.041, -0.297, 0.014]);
    for (let finger = 0; finger < 4; finger++) {
      ellipsoid(elbow, skin, [0.010, 0.033, 0.012], [(finger - 1.5) * 0.022, -0.355, 0.004]);
    }

    const hip = joint(rig.root, 'hip' + s, 0.105 * sign, -0.04);
    surface(hip, trousers, [
      [-0.48, 0, 0], [-0.44, 0.063, 0.067], [-0.35, 0.078, 0.083],
      [-0.22, 0.098, 0.10], [-0.075, 0.109, 0.112],
      [0.045, 0.092, 0.105], [0.08, 0, 0]
    ], 'thigh-' + s);
    const knee = joint(hip, 'knee' + s, 0, -0.44);
    ellipsoid(knee, trousers, [0.068, 0.071, 0.072], [0, 0, 0.005]);
    surface(knee, trousers, [
      [-0.435, 0, 0], [-0.405, 0.042, 0.046], [-0.32, 0.047, 0.054],
      [-0.21, 0.065, 0.074, -0.008], [-0.12, 0.075, 0.08, -0.009],
      [-0.035, 0.064, 0.066], [0.03, 0.056, 0.059], [0.05, 0, 0]
    ], 'calf-' + s);
    ellipsoid(knee, skin, [0.043, 0.058, 0.048], [0, -0.405, 0]);
    ellipsoid(knee, sole, [0.065, 0.025, 0.144], [0, -0.439, 0.064], 'sole-' + s);
    ellipsoid(knee, shoulderFabric, [0.062, 0.053, 0.137], [0, -0.409, 0.061], 'shoe-' + s);
  }
  rig.root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return rig;
}
