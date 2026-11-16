/**
 * builders.js — Modélisation 100 % procédurale des objets (géométries Three.js).
 *
 * Chaque constructeur : (params, textureFactory) → THREE.Group
 * Conventions :
 *  - objets posés (sol, étagère, bureau) : base à y = 0, centrés en x/z, face vers +z ;
 *  - objets muraux (poster, shield, wallSword, neon, clock) : centrés en x/y,
 *    dos à z = 0, face vers +z.
 * Chaque appel crée ses propres matériaux : la surbrillance d'un objet
 * n'affecte donc jamais les autres.
 */
import * as THREE from 'three';

const PI = Math.PI;

/* ───────────── Aides ───────────── */
export const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...o });
const metal = (color = '#b9bec7') => M(color, { roughness: 0.3, metalness: 0.85 });
const gold = (o = {}) => M('#e8b923', { roughness: 0.25, metalness: 0.9, ...o });
const glow = (color, intensity = 1.4) => M(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
const glass = (color, opacity = 0.45) => M(color, { transparent: true, opacity, roughness: 0.08 });
/** Matériau texturé (illustration Canvas). */
const T = (tf, spec, w = 256, h = 256, o = {}) => M('#ffffff', { map: tf.art(spec, w, h), ...o });
/** Matériau « écran » auto-éclairé. */
const S = (tf, spec, w = 256, h = 256) => {
  const map = tf.art(spec, w, h);
  return M('#ffffff', { map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.75, roughness: 0.3 });
};

/**
 * Variantes « surface d'illustration » : le matériau est marqué (userData.isArt)
 * pour pouvoir recevoir une image fournie par l'application hôte (options.assets).
 * artAspect = largeur / hauteur de la surface, pour recadrer l'image sans la déformer.
 */
const mark = (material, w, h) => { material.userData.isArt = true; material.userData.artAspect = w / h; return material; };
const TA = (tf, spec, w = 256, h = 256, o = {}) => mark(T(tf, spec, w, h, o), w, h);
const SA = (tf, spec, w = 256, h = 256) => mark(S(tf, spec, w, h), w, h);

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  sph: (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs),
  tor: (r, tube, arc = PI * 2) => new THREE.TorusGeometry(r, tube, 10, 32, arc),
  cone: (r, h, seg = 20) => new THREE.ConeGeometry(r, h, seg),
  plane: (w, h) => new THREE.PlaneGeometry(w, h),
  circle: (r) => new THREE.CircleGeometry(r, 40),
};

/** Ajoute un mesh à `parent` (position / rotation / échelle en tableaux). */
export function put(parent, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Cylindre tendu entre deux points (tubes de néon, pieds, mèches…). */
function seg(parent, a, b, radius, material) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const dir = new THREE.Vector3(b[0], b[1], b[2]).sub(va);
  const mesh = new THREE.Mesh(G.cyl(radius, radius, dir.length(), 10), material);
  mesh.position.copy(va).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function sub(parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(group);
  return group;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const DARK = '#17181c';

/* ══════════════════════════════════════════════════════════════════════
   CONSTRUCTEURS
   ══════════════════════════════════════════════════════════════════════ */
export const BUILDERS = {

  /* ───────────── Zone 1 : bibliothèque ───────────── */

  cartridge(p, tf) {
    const g = new THREE.Group();
    const shell = M(p.color ?? '#8d8f98');
    put(g, G.box(0.38, 0.36, 0.07), shell, [0, 0.22, 0]);
    put(g, G.box(0.30, 0.05, 0.055), M('#3c3c44'), [0, 0.025, 0]);          // connecteur
    put(g, G.plane(0.30, 0.24), TA(tf, p.art, 256, 205), [0, 0.24, 0.036]);  // étiquette
    for (let i = -2; i <= 2; i++) put(g, G.box(0.03, 0.012, 0.072), M('#55555e'), [i * 0.06, 0.406, 0]);
    return g;
  },

  case(p, tf) {
    const g = new THREE.Group();
    const side = M(p.color ?? '#222222', { roughness: 0.4 });
    const front = TA(tf, p.art, 256, 346, { roughness: 0.35 });
    put(g, G.box(0.34, 0.46, 0.05), [side, side, side, side, front, side], [0, 0.23, 0]);
    put(g, G.box(0.345, 0.05, 0.052), M('#f2f2f2', { roughness: 0.4 }), [0, 0.435, 0]); // bandeau neutre
    return g;
  },

  gamepad(p, tf) {
    const g = new THREE.Group();
    const body = M(p.color ?? '#444444', { roughness: 0.45 });
    const accent = M(p.accent ?? '#dddddd');
    put(g, G.box(0.12, 0.1, 0.1), M(DARK), [0, 0.05, 0]);                         // socle
    put(g, G.box(0.36, 0.17, 0.06), body, [0, 0.25, 0]);
    for (const sx of [-1, 1]) {
      put(g, G.cyl(0.085, 0.085, 0.06), body, [sx * 0.18, 0.25, 0], [PI / 2, 0, 0]);
      put(g, G.sph(0.07), body, [sx * 0.2, 0.155, 0], [0, 0, 0], [1, 1.25, 0.5]); // poignée
      put(g, G.cyl(0.03, 0.034, 0.03), M(DARK), [sx * 0.085, 0.215, 0.04], [PI / 2, 0, 0]); // stick
    }
    put(g, G.box(0.065, 0.02, 0.012), M(DARK), [-0.18, 0.275, 0.034]);            // croix
    put(g, G.box(0.02, 0.065, 0.012), M(DARK), [-0.18, 0.275, 0.034]);
    [[0, 0.024], [0.024, 0], [0, -0.024], [-0.024, 0]].forEach(([dx, dy]) =>
      put(g, G.cyl(0.011, 0.011, 0.012, 12), accent, [0.18 + dx, 0.275 + dy, 0.034], [PI / 2, 0, 0]));
    put(g, G.plane(0.1, 0.1), TA(tf, { bg: ['#ffffff', '#e4e4ec'], emoji: p.emoji, emojiScale: 0.7 }, 128, 128),
      [0, 0.275, 0.0312]);                                                         // autocollant
    return g;
  },

  /* ───────────── Zone 2 : bureau ───────────── */

  monitor(p, tf) {
    const g = new THREE.Group();
    const dark = M(DARK, { roughness: 0.4 });
    put(g, G.cyl(0.15, 0.17, 0.02), dark, [0, 0.01, 0]);
    put(g, G.box(0.05, 0.24, 0.04), dark, [0, 0.13, -0.02]);
    put(g, G.box(0.78, 0.46, 0.04), dark, [0, 0.45, 0]);
    put(g, G.plane(0.72, 0.40), SA(tf, p.art, 512, 284), [0, 0.45, 0.021]);
    return g;
  },

  timerBox() {
    const g = new THREE.Group();
    put(g, G.box(0.28, 0.09, 0.18), M('#4b5a3a'), [0, 0.045, 0]);
    for (const z of [-0.06, -0.025, 0.01]) put(g, G.cyl(0.018, 0.018, 0.26, 12), M('#b5895a'), [0, 0.108, z], [0, 0, PI / 2]);
    put(g, G.box(0.09, 0.02, 0.05), M('#2a2a2e'), [-0.07, 0.1, 0.06]);            // clavier
    put(g, G.box(0.1, 0.02, 0.04), glow('#ff2a2a', 1.6), [0.06, 0.1, 0.06]);      // afficheur
    put(g, G.tor(0.035, 0.005, PI), M('#d62828'), [0.03, 0.125, -0.025], [0, PI / 2, 0]);
    put(g, G.tor(0.035, 0.005, PI), M('#2a6fdb'), [-0.05, 0.125, -0.025], [0, PI / 2, 0]);
    return g;
  },

  steeringWheel() {
    const g = new THREE.Group();
    const dark = M(DARK);
    put(g, G.box(0.3, 0.05, 0.24), dark, [0, 0.025, 0]);
    put(g, G.cyl(0.03, 0.04, 0.2), dark, [0, 0.14, -0.03], [0.5, 0, 0]);
    const w = sub(g, [0, 0.27, 0.04], [-0.35, 0, 0]);
    put(w, G.tor(0.17, 0.024), M('#1b1b1f', { roughness: 0.9 }));
    put(w, G.box(0.32, 0.03, 0.02), metal());
    put(w, G.box(0.03, 0.16, 0.02), metal(), [0, -0.08, 0]);
    put(w, G.cyl(0.045, 0.045, 0.03), M('#c0392b'), [0, 0, 0.01], [PI / 2, 0, 0]);
    return g;
  },

  flightStick() {
    const g = new THREE.Group();
    put(g, G.box(0.24, 0.05, 0.24), M(DARK), [0, 0.025, 0]);
    const s = sub(g, [0.02, 0.05, 0], [0.12, 0, -0.1]);
    put(s, G.cyl(0.02, 0.03, 0.16), metal(), [0, 0.08, 0]);
    put(s, G.cyl(0.035, 0.03, 0.14), M('#2a2a30'), [0, 0.22, 0]);
    put(s, G.sph(0.018), glow('#ff3b30', 0.8), [0, 0.3, 0]);
    put(s, G.box(0.02, 0.03, 0.03), M('#ff9500'), [0, 0.24, 0.04]);
    put(g, G.box(0.04, 0.07, 0.08), M('#55555c'), [-0.08, 0.085, 0.06]);          // manette des gaz
    return g;
  },

  handheld(p, tf) {
    const g = new THREE.Group();
    put(g, G.box(0.04, 0.2, 0.02), M(DARK), [0, 0.09, -0.085], [0.25, 0, 0]);     // béquille
    const b = sub(g, [0, 0, 0], [-0.3, 0, 0]);
    put(b, G.box(0.2, 0.32, 0.04), M('#c9c9cf', { roughness: 0.5 }), [0, 0.16, 0]);
    put(b, G.box(0.16, 0.14, 0.005), M('#5a5a66'), [0, 0.225, 0.02]);
    put(b, G.plane(0.13, 0.11), SA(tf, p.art, 160, 136), [0, 0.225, 0.0235]);
    put(b, G.box(0.06, 0.02, 0.01), M(DARK), [-0.05, 0.1, 0.021]);
    put(b, G.box(0.02, 0.06, 0.01), M(DARK), [-0.05, 0.1, 0.021]);
    put(b, G.cyl(0.014, 0.014, 0.01, 12), M('#a02050'), [0.04, 0.092, 0.021], [PI / 2, 0, 0]);
    put(b, G.cyl(0.014, 0.014, 0.01, 12), M('#a02050'), [0.075, 0.108, 0.021], [PI / 2, 0, 0]);
    return g;
  },

  bowling() {
    const g = new THREE.Group();
    const white = M('#f4f4f4', { roughness: 0.3 });
    put(g, G.sph(0.07), white, [-0.06, 0.105, 0], [0, 0, 0], [1, 1.5, 1]);
    put(g, G.cyl(0.03, 0.045, 0.09), white, [-0.06, 0.22, 0]);
    put(g, G.sph(0.04), white, [-0.06, 0.285, 0]);
    put(g, G.tor(0.036, 0.006), M('#d62828'), [-0.06, 0.212, 0], [PI / 2, 0, 0]);
    put(g, G.tor(0.032, 0.006), M('#d62828'), [-0.06, 0.236, 0], [PI / 2, 0, 0]);
    const r = sub(g, [0.1, 0, 0.02], [0, 0.35, 0]);                                // télécommande
    put(r, G.box(0.045, 0.025, 0.17), white, [0, 0.0125, 0]);
    put(r, G.cyl(0.012, 0.012, 0.006, 12), M('#3a86ff'), [0, 0.027, -0.03]);
    put(r, G.box(0.018, 0.004, 0.018), M('#c8c8c8'), [0, 0.027, -0.065]);
    return g;
  },

  /* ───────────── Zone 2 : étagères flottantes ───────────── */

  cake() {
    const g = new THREE.Group();
    put(g, G.cyl(0.2, 0.2, 0.015, 28), M('#f2f2f2', { roughness: 0.3 }), [0, 0.0075, 0]);
    put(g, G.cyl(0.16, 0.16, 0.13, 28), M('#3b2314'), [0, 0.08, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2, x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12;
      put(g, G.sph(0.028), M('#fff8ee'), [x, 0.155, z]);
      put(g, G.sph(0.016), M('#c1121f', { roughness: 0.3 }), [x, 0.185, z]);
    }
    put(g, G.cyl(0.008, 0.008, 0.09, 8), M('#f8f8f8'), [0, 0.19, 0]);
    put(g, G.sph(0.014), glow('#ffb703', 2), [0, 0.248, 0], [0, 0, 0], [1, 1.6, 1]);
    return g;
  },

  crowbar() {
    const g = new THREE.Group();
    const red = M('#c1121f', { roughness: 0.4, metalness: 0.5 });
    for (const x of [-0.1, 0.1]) put(g, G.box(0.02, 0.1, 0.06), M('#4a3423'), [x, 0.05, 0]);
    put(g, G.cyl(0.014, 0.014, 0.42, 12), red, [0, 0.114, 0], [0, 0, PI / 2]);
    put(g, G.tor(0.04, 0.014, PI), red, [-0.21, 0.154, 0], [0, 0, PI / 2]);        // crochet
    put(g, G.box(0.07, 0.012, 0.03), metal('#9aa0a8'), [0.235, 0.126, 0], [0, 0, 0.4]);
    return g;
  },

  pickaxe() {
    const g = new THREE.Group();
    const head = M('#3fd0c9', { roughness: 0.35 });
    put(g, G.box(0.16, 0.03, 0.14), M('#6b6b6b'), [0, 0.015, 0]);
    put(g, G.box(0.03, 0.4, 0.03), M('#7a5230'), [0, 0.23, 0]);
    put(g, G.box(0.1, 0.05, 0.04), head, [0, 0.43, 0]);
    for (const sx of [-1, 1]) {
      put(g, G.box(0.08, 0.045, 0.04), head, [sx * 0.09, 0.415, 0]);
      put(g, G.box(0.06, 0.04, 0.04), head, [sx * 0.155, 0.385, 0]);
      put(g, G.box(0.04, 0.04, 0.04), head, [sx * 0.195, 0.35, 0]);
    }
    return g;
  },

  bow() {
    const g = new THREE.Group();
    const arc = 2.6, r = 0.22;
    put(g, G.box(0.14, 0.03, 0.1), M(DARK), [0, 0.015, 0]);
    const b = sub(g, [-0.13, 0.27, 0]);
    put(b, G.tor(r, 0.012, arc), M('#8a5a2b'), [0, 0, 0], [0, 0, -arc / 2]);
    const sx = r * Math.cos(arc / 2), sy = r * Math.sin(arc / 2);
    seg(b, [sx, -sy, 0], [sx, sy, 0], 0.003, M('#e8e8e8'));
    put(b, G.cyl(0.02, 0.02, 0.06, 10), M('#2f6fdb'), [r, 0, 0]);                 // poignée
    seg(b, [sx - 0.02, 0, 0], [r + 0.14, 0, 0], 0.005, M('#c9a26b'));              // flèche
    put(b, G.cone(0.014, 0.04, 8), metal(), [r + 0.16, 0, 0], [0, 0, -PI / 2]);
    put(b, G.sph(0.012), glow('#35d6ff', 1.5), [0.06, 0.2, 0]);
    put(b, G.sph(0.012), glow('#ff7a1a', 1.5), [0.06, -0.2, 0]);
    return g;
  },

  katanaStand() {
    const g = new THREE.Group();
    const wood = M('#2b1a12');
    put(g, G.box(0.42, 0.02, 0.1), wood, [0, 0.01, 0]);
    for (const x of [-0.17, 0.17]) put(g, G.box(0.03, 0.14, 0.08), wood, [x, 0.09, 0]);
    put(g, G.box(0.34, 0.02, 0.006), metal('#dfe5ee'), [0.07, 0.172, 0]);          // lame
    put(g, G.cyl(0.028, 0.028, 0.008, 16), gold(), [-0.105, 0.172, 0], [0, 0, PI / 2]);
    put(g, G.cyl(0.012, 0.012, 0.12, 10), M('#f3f0e6'), [-0.17, 0.172, 0], [0, 0, PI / 2]);
    return g;
  },

  whip() {
    const g = new THREE.Group();
    const leather = M('#5a3418', { roughness: 0.9 });
    put(g, G.tor(0.13, 0.018), leather, [0, 0.02, 0], [PI / 2, 0, 0]);
    put(g, G.tor(0.09, 0.018), leather, [0, 0.055, 0], [PI / 2, 0, 0]);
    seg(g, [0.12, 0.03, 0.02], [0.2, 0.2, 0.02], 0.02, M('#2b1a12'));              // manche
    put(g, G.sph(0.024), gold(), [0.205, 0.215, 0.02]);
    const ball = sub(g, [-0.02, 0.105, 0]);                                         // masse cloutée
    put(ball, G.sph(0.035), metal('#8f96a0'));
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const c = put(ball, G.cone(0.012, 0.03, 6), metal('#8f96a0'), [d[0] * 0.04, d[1] * 0.04, d[2] * 0.04]);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0], d[1], d[2]));
    }
    return g;
  },

  lighthouse() {
    const g = new THREE.Group();
    put(g, G.cyl(0.16, 0.2, 0.05, 12), M('#6b6f76', { roughness: 0.95 }), [0, 0.025, 0]);
    put(g, G.cyl(0.06, 0.1, 0.32, 20), M('#f1f1ee'), [0, 0.21, 0]);
    put(g, G.cyl(0.093, 0.1, 0.05, 20), M('#b3202a'), [0, 0.075, 0]);
    put(g, G.cyl(0.074, 0.082, 0.05, 20), M('#b3202a'), [0, 0.215, 0]);
    put(g, G.cyl(0.085, 0.085, 0.015, 20), M(DARK), [0, 0.378, 0]);
    put(g, G.cyl(0.045, 0.045, 0.06, 16), glow('#ffe066', 2), [0, 0.415, 0]);
    put(g, G.cone(0.065, 0.07, 16), M('#b3202a'), [0, 0.48, 0]);
    return g;
  },

  wrench() {
    const g = new THREE.Group();
    const steel = metal('#aeb6c2');
    put(g, G.box(0.16, 0.03, 0.12), M(DARK), [-0.06, 0.015, 0]);
    const w = sub(g, [-0.06, 0.03, 0], [0, 0, 0.18]);
    put(w, G.box(0.05, 0.32, 0.02), steel, [0, 0.17, 0]);
    put(w, G.tor(0.05, 0.02, PI * 1.5), steel, [0, 0.37, 0], [0, 0, PI * 0.75]);   // mâchoire
    put(w, G.tor(0.03, 0.012), steel, [0, 0.03, 0]);
    put(w, G.box(0.052, 0.1, 0.022), M('#c0392b'), [0, 0.13, 0]);
    put(g, G.cyl(0.045, 0.045, 0.04, 6), gold(), [0.14, 0.02, 0.02]);              // boulon
    put(g, G.cyl(0.02, 0.02, 0.07, 12), gold(), [0.14, 0.055, 0.02]);
    return g;
  },

  rocket() {
    const g = new THREE.Group();
    put(g, G.cyl(0.04, 0.055, 0.06, 16), M('#3a3a40'), [0, 0.05, 0]);
    put(g, G.cyl(0.06, 0.06, 0.26, 20), M('#f4f4f4', { roughness: 0.35 }), [0, 0.21, 0]);
    put(g, G.cyl(0.061, 0.061, 0.03, 20), M('#ff7a1a'), [0, 0.3, 0]);
    put(g, G.cone(0.06, 0.11, 20), M('#c1121f'), [0, 0.395, 0]);
    put(g, G.sph(0.022), M('#4cc9f0', { roughness: 0.1 }), [0, 0.24, 0.05]);
    for (let i = 0; i < 3; i++) {
      const f = sub(g, [0, 0, 0], [0, (i / 3) * PI * 2, 0]);
      put(f, G.box(0.012, 0.12, 0.08), M('#c1121f'), [0, 0.07, 0.085], [0.25, 0, 0]);
    }
    return g;
  },

  lantern() {
    const g = new THREE.Group();
    const iron = M('#23262b', { metalness: 0.6, roughness: 0.5 });
    put(g, G.cyl(0.075, 0.085, 0.025, 8), iron, [0, 0.0125, 0]);
    put(g, G.cyl(0.055, 0.055, 0.14, 8), glass('#dff6ff', 0.35), [0, 0.095, 0]);
    put(g, G.sph(0.03), glow('#e9fbff', 2.2), [0, 0.09, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      put(g, G.box(0.008, 0.14, 0.008), iron, [Math.cos(a) * 0.058, 0.095, Math.sin(a) * 0.058]);
    }
    put(g, G.cone(0.085, 0.06, 8), iron, [0, 0.195, 0]);
    put(g, G.tor(0.04, 0.006), iron, [0, 0.255, 0]);
    return g;
  },

  potion() {
    const g = new THREE.Group();
    put(g, G.tor(0.05, 0.012), M('#4a3423'), [0, 0.012, 0], [PI / 2, 0, 0]);
    put(g, G.sph(0.09), M('#d00000', { emissive: '#7a0000', emissiveIntensity: 0.6, roughness: 0.1 }), [0, 0.1, 0]);
    put(g, G.cyl(0.028, 0.034, 0.08, 16), glass('#ffd6d6', 0.6), [0, 0.215, 0]);
    put(g, G.tor(0.032, 0.007), gold(), [0, 0.25, 0], [PI / 2, 0, 0]);
    put(g, G.cyl(0.03, 0.026, 0.035, 12), M('#9c6b3f'), [0, 0.272, 0]);
    return g;
  },

  crown() {
    const g = new THREE.Group();
    put(g, G.box(0.28, 0.05, 0.28), M('#5a189a', { roughness: 0.9 }), [0, 0.025, 0]);
    const au = gold({ side: THREE.DoubleSide });
    put(g, G.cyl(0.1, 0.1, 0.07, 28, true), au, [0, 0.085, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1;
      put(g, G.cone(0.022, 0.07, 8), au, [x, 0.155, z]);
      put(g, G.sph(0.012), M(i % 2 ? '#d00000' : '#1d4ed8', { roughness: 0.15 }), [x * 1.05, 0.085, z * 1.05]);
    }
    return g;
  },

  globe(p, tf) {
    const g = new THREE.Group();
    const brass = gold({ roughness: 0.4 });
    put(g, G.cyl(0.09, 0.1, 0.02), M('#3b2314'), [0, 0.01, 0]);
    put(g, G.cyl(0.012, 0.012, 0.05, 8), brass, [0, 0.045, 0]);
    put(g, G.tor(0.135, 0.008, PI), brass, [0, 0.2, 0], [0, 0, -PI / 2 + 0.4]);
    put(g, G.sph(0.115, 28, 20),
      T(tf, { bg: ['#1b5fae', '#2f86d6'], pattern: 'blobs', accent: '#3fae49', patternAlpha: 1 }, 256, 128),
      [0, 0.2, 0], [0, 0, 0.4]);
    return g;
  },

  hourglass() {
    const g = new THREE.Group();
    const wood = M('#5a3418');
    put(g, G.cyl(0.085, 0.085, 0.018, 20), wood, [0, 0.009, 0]);
    put(g, G.cyl(0.085, 0.085, 0.018, 20), wood, [0, 0.311, 0]);
    put(g, G.cone(0.065, 0.14, 20), glass('#e8f7ff', 0.4), [0, 0.088, 0]);
    put(g, G.cone(0.065, 0.14, 20), glass('#e8f7ff', 0.4), [0, 0.232, 0], [PI, 0, 0]);
    put(g, G.cone(0.05, 0.06, 20), glow('#f4c95d', 0.5), [0, 0.048, 0]);           // sable (bas)
    put(g, G.cone(0.035, 0.07, 20), glow('#f4c95d', 0.5), [0, 0.255, 0], [PI, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      put(g, G.cyl(0.007, 0.007, 0.29, 8), gold(), [Math.cos(a) * 0.072, 0.16, Math.sin(a) * 0.072]);
    }
    return g;
  },

  cards(p, tf) {
    const g = new THREE.Group();
    put(g, G.box(0.2, 0.03, 0.06), M('#14532d'), [0, 0.015, 0]);
    const fan = sub(g, [0, 0.02, 0], [-0.2, 0, 0]);
    ['♠️', '♥️', '🃏', '♦️', '♣️'].forEach((emoji, i) => {
      const pivot = sub(fan, [0, 0, i * 0.003], [0, 0, (2 - i) * 0.3]);
      const face = T(tf, { bg: ['#ffffff', '#f0f0f0'], emoji, emojiScale: 0.6, border: '#d0d0d8' }, 96, 136,
        { side: THREE.DoubleSide });
      put(pivot, G.plane(0.11, 0.155), face, [0, 0.11, 0]);
    });
    return g;
  },

  telescope() {
    const g = new THREE.Group();
    const leg = M('#6b4423');
    const top = [0, 0.24, 0];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.5;
      seg(g, top, [Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13], 0.008, leg);
    }
    put(g, G.sph(0.022), M(DARK), top);
    const tube = sub(g, [0, 0.27, 0], [0, 0, -0.95]);
    put(tube, G.cyl(0.036, 0.03, 0.3, 16), M('#f1f1ee', { roughness: 0.35 }), [0, 0.02, 0]);
    put(tube, G.cyl(0.04, 0.04, 0.03, 16), M(DARK), [0, 0.175, 0]);
    put(tube, G.cyl(0.015, 0.015, 0.06, 10), M(DARK), [0, -0.16, 0]);
    put(tube, G.cyl(0.034, 0.034, 0.004, 16), M('#4cc9f0', { roughness: 0.1 }), [0, 0.191, 0]);
    return g;
  },

  walkie() {
    const g = new THREE.Group();
    put(g, G.box(0.1, 0.2, 0.045), M('#f2c200', { roughness: 0.5 }), [0, 0.1, 0]);
    put(g, G.cyl(0.008, 0.006, 0.13, 8), M(DARK), [-0.03, 0.265, 0]);
    put(g, G.cyl(0.014, 0.014, 0.025, 10), M(DARK), [0.03, 0.212, 0]);
    for (let i = 0; i < 4; i++) put(g, G.box(0.06, 0.006, 0.004), M(DARK), [0, 0.15 - i * 0.016, 0.0235]);
    put(g, G.box(0.06, 0.035, 0.004), M('#23262b'), [0, 0.055, 0.0235]);
    put(g, G.sph(0.008), glow('#ff3b30', 1.5), [0.035, 0.18, 0.023]);
    return g;
  },

  camera(p, tf) {
    const g = new THREE.Group();
    const white = M('#f4f1ea', { roughness: 0.45 });
    put(g, G.box(0.22, 0.14, 0.12), white, [0, 0.07, 0]);
    put(g, G.box(0.14, 0.04, 0.1), white, [0, 0.16, -0.01]);
    put(g, G.cyl(0.05, 0.05, 0.05, 24), M(DARK), [0, 0.08, 0.075], [PI / 2, 0, 0]);
    put(g, G.cyl(0.035, 0.035, 0.052, 24), M('#27408b', { roughness: 0.1 }), [0, 0.08, 0.076], [PI / 2, 0, 0]);
    put(g, G.box(0.05, 0.03, 0.01), glow('#fffbe6', 0.4), [-0.07, 0.16, 0.042]);   // flash
    put(g, G.box(0.22, 0.012, 0.121), M('#3a86ff'), [0, 0.022, 0]);                // liseré
    put(g, G.cyl(0.012, 0.012, 0.01, 12), M('#c1121f'), [0.085, 0.145, 0.03]);
    put(g, G.plane(0.1, 0.085),                                                     // photo qui sort
      T(tf, { bg: ['#ffffff', '#ffffff'], emoji: '🦋', emojiScale: 0.6, border: '#ffffff' }, 96, 82, { side: THREE.DoubleSide }),
      [0, 0.215, 0.02], [-0.25, 0, 0]);
    return g;
  },

  /* ───────────── Zone 3 : murs ───────────── */

  poster(p, tf) {
    const g = new THREE.Group();
    put(g, G.box(0.86, 1.16, 0.03), M('#1b1b20', { roughness: 0.5 }), [0, 0, 0.015]);
    put(g, G.plane(0.8, 1.1), TA(tf, p.art, 512, 704), [0, 0, 0.0315]);
    return g;
  },

  shield(p, tf) {
    const g = new THREE.Group();
    const steel = metal('#9aa0a8');
    const emblem = TA(tf, { bg: ['#f3ead2', '#e0d3ae'], emoji: p.emoji, emojiScale: 0.62 }, 160, 160);
    if (p.shape === 'round') {
      put(g, G.cyl(0.42, 0.42, 0.05, 40), M(p.color, { roughness: 0.85 }), [0, 0, 0.03], [PI / 2, 0, 0]);
      put(g, G.tor(0.42, 0.025), steel, [0, 0, 0.045]);
      for (let i = 0; i < 4; i++) put(g, G.box(0.02, 0.8, 0.006), M('#4a3423'), [0, 0, 0.056], [0, 0, (i / 4) * PI]);
      put(g, G.circle(0.17), emblem, [0, 0, 0.062]);
      put(g, G.tor(0.17, 0.015), steel, [0, 0, 0.062]);
    } else {
      const outline = new THREE.Shape();
      outline.moveTo(-0.36, 0.46); outline.lineTo(0.36, 0.46); outline.lineTo(0.36, 0.05);
      outline.quadraticCurveTo(0.34, -0.3, 0, -0.5);
      outline.quadraticCurveTo(-0.34, -0.3, -0.36, 0.05);
      outline.closePath();
      const geo = (depth) => new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false });
      put(g, geo(0.03), steel, [0, 0, 0], [0, 0, 0], [1.07, 1.06, 1]);
      put(g, geo(0.05), M(p.color, { roughness: 0.5 }), [0, 0, 0.005]);
      put(g, G.box(0.06, 0.9, 0.006), M('#f1f1ee'), [0, -0.02, 0.057]);
      put(g, G.box(0.7, 0.06, 0.006), M('#f1f1ee'), [0, 0.2, 0.057]);
      put(g, G.circle(0.19), emblem, [0, 0.2, 0.064]);
      put(g, G.tor(0.19, 0.014), gold(), [0, 0.2, 0.064]);
    }
    return g;
  },

  wallSword(p) {
    const g = new THREE.Group();
    const style = {
      great:  { len: 0.86, w: 0.2,   blade: metal('#c9ced6'), guard: [0.3, '#8a6d1f'],  grip: '#5a1a1a' },
      light:  { len: 0.8,  w: 0.05,  blade: M('#eaf6ff', { emissive: '#9fd8ff', emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.2 }), guard: [0.2, '#7a5a2a'], grip: '#3b2a1a' },
      katana: { len: 0.82, w: 0.03,  blade: metal('#e6ebf2'), guard: [0.07, '#2b2b2b'], grip: '#7a1010' },
    }[p.style] ?? null;
    const s = style ?? { len: 0.8, w: 0.06, blade: metal(), guard: [0.2, '#8a6d1f'], grip: '#3b2a1a' };
    const z = 0.035, y0 = -0.36;                                                    // bas de la lame
    put(g, G.box(s.w, s.len, 0.014), s.blade, [0, y0 + s.len / 2, z]);
    put(g, G.cone(s.w * 0.707, s.w * 1.1, 4), s.blade, [0, y0 + s.len + s.w * 0.55, z], [0, PI / 4, 0], [1, 1, 0.1]);
    if (p.style === 'katana') put(g, G.cyl(s.guard[0], s.guard[0], 0.012, 20), M(s.guard[1]), [0, y0, z]);
    else put(g, G.box(s.guard[0], 0.04, 0.04), gold({ color: s.guard[1] }), [0, y0, z]);
    put(g, G.cyl(0.018, 0.018, 0.17, 10), M(s.grip, { roughness: 0.9 }), [0, y0 - 0.1, z]);
    put(g, G.sph(0.026), gold(), [0, y0 - 0.2, z]);
    if (p.style === 'light') put(g, G.cone(0.07, 0.5, 16, 1), M('#bfe6ff', { transparent: true, opacity: 0.18, emissive: '#bfe6ff', emissiveIntensity: 1 }), [0, y0 + s.len + 0.2, z]);
    for (const y of [y0 + 0.08, y0 + s.len * 0.7]) put(g, G.box(Math.max(0.1, s.w + 0.06), 0.025, 0.03), M('#3b2a1a'), [0, y, 0.015]);
    return g;
  },

  neon(p) {
    const g = new THREE.Group();
    put(g, G.box(1.1, 0.9, 0.02), M('#101014', { roughness: 0.9 }), [0, 0, 0.01]);
    const z = 0.05;
    const tube = (points, color, closed = false) => {
      const mat = glow(color, 2.2);
      const list = closed ? [...points, points[0]] : points;
      for (let i = 0; i < list.length - 1; i++) {
        seg(g, [list[i][0], list[i][1], z], [list[i + 1][0], list[i + 1][1], z], 0.014, mat);
      }
      for (const pt of points) put(g, G.sph(0.014, 8, 6), mat, [pt[0], pt[1], z]);
    };
    if (p.shape === 'cross') {
      tube([[-0.34, -0.3], [0.34, 0.3]], '#ff2a3c');
      tube([[-0.34, 0.3], [0.34, -0.3]], '#2a7bff');
    } else if (p.shape === 'heart') {
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const t = (i / 28) * PI * 2;
        pts.push([
          0.02 * 16 * Math.sin(t) ** 3,
          0.02 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) + 0.03,
        ]);
      }
      tube(pts, '#ff1f3d', true);
    } else {
      tube([[-0.45, -0.28], [-0.45, 0], [-0.3, 0], [-0.3, 0.25], [-0.15, 0.25], [-0.15, -0.05], [0, -0.05],
        [0, 0.34], [0.12, 0.34], [0.12, 0.1], [0.28, 0.1], [0.28, 0.2], [0.45, 0.2], [0.45, -0.28]], '#fcee0a');
      tube([[-0.5, -0.34], [0.5, -0.34]], '#00e5ff');
    }
    return g;
  },

  clock(p, tf) {
    const g = new THREE.Group();
    put(g, G.cyl(0.38, 0.38, 0.06, 40), M(p.rim ?? '#3b2a1a', { roughness: 0.5 }), [0, 0, 0.03], [PI / 2, 0, 0]);
    put(g, G.circle(0.33), TA(tf, p.art, 256, 256), [0, 0, 0.062]);
    const hour = p.hour ?? 10.15;
    const hand = (angle, len, w) => {
      const pivot = sub(g, [0, 0, 0.07], [0, 0, -angle]);
      put(pivot, G.box(w, len, 0.008), M('#141418'), [0, len / 2 - 0.02, 0]);
    };
    hand((hour / 12) * PI * 2, 0.17, 0.03);
    hand((hour % 1) * PI * 2, 0.26, 0.018);
    put(g, G.cyl(0.02, 0.02, 0.02, 12), gold(), [0, 0, 0.075], [PI / 2, 0, 0]);
    if (p.pendulum) {
      put(g, G.box(0.016, 0.26, 0.01), gold(), [0, -0.49, 0.03]);
      put(g, G.cyl(0.06, 0.06, 0.014, 24), gold(), [0, -0.62, 0.03], [PI / 2, 0, 0]);
    }
    return g;
  },

  /* ───────────── Zone 4 : sol & mobilier ───────────── */

  cushion(p, tf) {
    const g = new THREE.Group();
    const top = TA(tf, p.art, 256, 256, { roughness: 0.95 });
    if (p.round) {
      const side = M(p.color ?? '#ff8fbd', { roughness: 0.95 });
      put(g, G.cyl(0.24, 0.24, 0.13, 36), [side, top, side], [0, 0.065, 0]);
    } else {
      const side = M(p.art.bg[1], { roughness: 0.95 });
      put(g, G.box(0.45, 0.14, 0.45), [side, side, top, side, side, side], [0, 0.07, 0]);
    }
    return g;
  },

  rug(p, tf) {
    const g = new THREE.Group();
    const w = p.w ?? 1.5, d = p.d ?? 1.0;
    const side = M(p.art.bg[1], { roughness: 1 });
    const top = TA(tf, p.art, 512, Math.round((512 * d) / w), { roughness: 1 });
    const mesh = put(g, G.box(w, 0.016, d), [side, side, top, side, side, side], [0, 0.008, 0]);
    mesh.castShadow = false;
    return g;
  },

  chest() {
    const g = new THREE.Group();
    const wood = M('#6b4423', { roughness: 0.85 });
    const band = M('#2b2b2b', { metalness: 0.7, roughness: 0.4 });
    put(g, G.box(0.8, 0.32, 0.45), wood, [0, 0.16, 0]);
    for (const x of [-0.3, 0, 0.3]) put(g, G.box(0.05, 0.325, 0.46), band, [x, 0.16, 0]);
    put(g, G.box(0.08, 0.1, 0.02), gold(), [0, 0.24, 0.232]);
    const lid = sub(g, [0, 0.32, -0.225], [-1.0, 0, 0]);                           // couvercle ouvert
    put(lid, G.box(0.8, 0.1, 0.45), wood, [0, 0.05, 0.225]);
    for (const x of [-0.3, 0, 0.3]) put(lid, G.box(0.05, 0.105, 0.46), band, [x, 0.05, 0.225]);
    const rnd = seeded(84);
    const coin = gold({ emissive: '#7a5a00', emissiveIntensity: 0.5 });
    for (let i = 0; i < 16; i++) {
      put(g, G.sph(0.04 + rnd() * 0.02, 10, 8), coin, [(rnd() - 0.5) * 0.62, 0.3 + rnd() * 0.05, (rnd() - 0.5) * 0.3], [0, 0, 0], [1, 0.45, 1]);
    }
    put(g, G.sph(0.035, 8, 2), M('#d00000', { roughness: 0.1 }), [0.15, 0.37, 0.02]);
    put(g, G.sph(0.03, 8, 2), M('#2f6fdb', { roughness: 0.1 }), [-0.2, 0.37, -0.03]);
    return g;
  },

  arcade(p, tf) {
    const g = new THREE.Group();
    const body = M(p.color ?? '#1a1a3a', { roughness: 0.5 });
    put(g, G.box(0.5, 0.7, 0.45), body, [0, 0.35, 0]);
    put(g, G.box(0.5, 0.42, 0.3), body, [0, 0.91, -0.075]);
    put(g, G.box(0.44, 0.34, 0.01), M(DARK), [0, 0.91, 0.078]);
    put(g, G.plane(0.4, 0.3), SA(tf, p.art, 256, 192), [0, 0.91, 0.0845]);
    const panel = sub(g, [0, 0.72, 0.21], [0.3, 0, 0]);
    put(panel, G.box(0.5, 0.05, 0.2), M('#2a2a30'), [0, 0, 0]);
    put(panel, G.cyl(0.008, 0.008, 0.07, 8), metal(), [-0.12, 0.06, 0]);
    put(panel, G.sph(0.025), M('#d00000', { roughness: 0.3 }), [-0.12, 0.1, 0]);
    put(panel, G.cyl(0.022, 0.022, 0.015, 12), M('#ffd60a'), [0.06, 0.03, 0]);
    put(panel, G.cyl(0.022, 0.022, 0.015, 12), M('#3a86ff'), [0.14, 0.03, -0.03]);
    put(g, G.box(0.5, 0.1, 0.32), body, [0, 1.17, -0.065]);
    put(g, G.box(0.44, 0.07, 0.01), glow(p.glow ?? '#ff3355', 1.6), [0, 1.17, 0.098]); // fronton lumineux (sans texte)
    put(g, G.box(0.03, 0.04, 0.005), M('#c9c9cf'), [0, 0.5, 0.227]);               // monnayeur
    return g;
  },

  ball(p, tf) {
    const g = new THREE.Group();
    const r = 0.16;
    const spec = p.type === 'basket'
      ? { bg: ['#e5722a', '#c85a1a'], pattern: 'seams', accent: '#1a1a1a', patternAlpha: 1 }
      : { bg: ['#fafafa', '#e6e6e6'], pattern: 'dots', accent: '#111111', patternAlpha: 1 };
    put(g, G.sph(r, 32, 20), T(tf, spec, 256, 128, { roughness: p.type === 'basket' ? 0.9 : 0.45 }), [0, r, 0], [0.4, 0.6, 0]);
    return g;
  },

  guitar() {
    const g = new THREE.Group();
    put(g, G.box(0.3, 0.03, 0.2), M(DARK), [0, 0.015, 0]);                         // support
    put(g, G.box(0.03, 0.5, 0.03), M(DARK), [0, 0.26, -0.06]);
    const body = M('#c1121f', { roughness: 0.3 });
    put(g, G.cyl(0.18, 0.18, 0.05, 32), body, [0, 0.24, 0], [PI / 2, 0, 0]);
    put(g, G.cyl(0.135, 0.135, 0.05, 32), body, [0, 0.45, 0], [PI / 2, 0, 0]);
    put(g, G.box(0.11, 0.18, 0.006), M('#f4f4f4'), [0.03, 0.27, 0.027]);           // plaque
    put(g, G.box(0.1, 0.022, 0.02), M(DARK), [0, 0.3, 0.035]);                     // barre de médiator
    put(g, G.box(0.055, 0.5, 0.03), M(DARK), [0, 0.8, 0]);                         // manche
    put(g, G.box(0.08, 0.13, 0.03), M(DARK), [0, 1.1, 0]);
    ['#2ecc71', '#e63946', '#ffd60a', '#3a86ff', '#ff8a1e'].forEach((c, i) =>
      put(g, G.box(0.045, 0.034, 0.012), M(c, { roughness: 0.3 }), [0, 1.0 - i * 0.045, 0.02]));
    return g;
  },

  skateboard(p, tf) {
    const g = new THREE.Group();
    const side = M('#c9a26b');
    const top = T(tf, { bg: ['#1b1b20', '#2a2a30'], emoji: '🔥🦅', emojiScale: 0.5, pattern: 'diag', accent: '#ff5a1e', patternAlpha: 0.5 }, 256, 68);
    put(g, G.box(0.6, 0.016, 0.2), [side, side, top, side, side, side], [0, 0.085, 0]);
    put(g, G.box(0.12, 0.016, 0.2), M('#1b1b20'), [0.35, 0.1, 0], [0, 0, 0.3]);
    put(g, G.box(0.12, 0.016, 0.2), M('#1b1b20'), [-0.35, 0.1, 0], [0, 0, -0.3]);
    for (const x of [-0.2, 0.2]) {
      put(g, G.box(0.04, 0.03, 0.16), metal(), [x, 0.062, 0]);
      for (const z of [-0.09, 0.09]) put(g, G.cyl(0.03, 0.03, 0.03, 16), M('#f4f1ea'), [x, 0.03, z], [PI / 2, 0, 0]);
    }
    return g;
  },

  tire() {
    const g = new THREE.Group();
    const rubber = M('#1a1a1c', { roughness: 0.95 });
    for (const y of [0.09, 0.27]) {
      put(g, G.tor(0.19, 0.09), rubber, [0, y, 0], [PI / 2, 0, 0]);
      put(g, G.cyl(0.11, 0.11, 0.1, 20), M('#d9d9de', { metalness: 0.7, roughness: 0.3 }), [0, y, 0]);
    }
    const banana = M('#ffd60a', { roughness: 0.5 });                                // peau de banane
    for (let i = 0; i < 3; i++) {
      const b = sub(g, [0.42, 0, 0.12], [0, (i / 3) * PI * 2, 0]);
      put(b, G.tor(0.09, 0.022, 1.5), banana, [-0.09, 0.03, 0], [0, 0, -0.1]);
    }
    put(g, G.sph(0.022), M('#5a3a10'), [0.42, 0.135, 0.12]);
    return g;
  },

  barrel(p, tf) {
    const g = new THREE.Group();
    put(g, G.cyl(0.26, 0.26, 0.7, 28), M('#5d6658', { metalness: 0.5, roughness: 0.5 }), [0, 0.35, 0]);
    for (const y of [0.03, 0.35, 0.67]) put(g, G.tor(0.262, 0.015), M('#3a4038', { metalness: 0.6 }), [0, y, 0], [PI / 2, 0, 0]);
    put(g, G.cyl(0.22, 0.22, 0.01, 28), glow('#7CFC00', 1.5), [0, 0.702, 0]);      // contenu toxique
    put(g, G.plane(0.24, 0.24), T(tf, { bg: ['#ffd60a', '#f2b200'], emoji: '☣️', emojiScale: 0.7, border: '#111111' }, 128, 128),
      [0, 0.36, 0.264]);
    return g;
  },

  katamari() {
    const g = new THREE.Group();
    const r = 0.3, c = [0, r + 0.03, 0];
    put(g, G.sph(r, 28, 20), M('#7bd389', { roughness: 0.8 }), c);
    const rnd = seeded(95);
    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#f4f1ea'];
    for (let i = 0; i < 26; i++) {
      const u = rnd() * 2 - 1, a = rnd() * PI * 2, s = Math.sqrt(1 - u * u);
      const dir = [s * Math.cos(a), u, s * Math.sin(a)];
      const size = 0.04 + rnd() * 0.05;
      const geo = [G.box(size, size, size), G.sph(size * 0.6, 10, 8), G.cone(size * 0.5, size * 1.4, 8), G.cyl(size * 0.4, size * 0.4, size * 1.3, 10)][i % 4];
      const m = put(g, geo, M(colors[i % colors.length]), [c[0] + dir[0] * r, c[1] + dir[1] * r, c[2] + dir[2] * r]);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir[0], dir[1], dir[2]));
    }
    return g;
  },

  flowerPot() {
    const g = new THREE.Group();
    put(g, G.cyl(0.16, 0.11, 0.22, 20), M('#b5553a', { roughness: 0.9 }), [0, 0.11, 0]);
    put(g, G.cyl(0.17, 0.17, 0.03, 20), M('#b5553a', { roughness: 0.9 }), [0, 0.215, 0]);
    put(g, G.cyl(0.145, 0.145, 0.01, 20), M('#3b2314'), [0, 0.232, 0]);
    put(g, G.cyl(0.014, 0.018, 0.5, 8), M('#2d8a34'), [0, 0.48, 0]);
    put(g, G.sph(0.07), M('#3aa845'), [0.08, 0.42, 0], [0, 0, 0.5], [1.3, 0.25, 0.7]);
    put(g, G.sph(0.07), M('#3aa845'), [-0.08, 0.5, 0], [0, 0, -0.5], [1.3, 0.25, 0.7]);
    const head = sub(g, [0, 0.76, 0.03], [-0.15, 0, 0]);
    put(head, G.sph(0.085), M('#5a3a10', { roughness: 1 }), [0, 0, 0], [0, 0, 0], [1, 1, 0.35]);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      put(head, G.sph(0.045, 10, 8), M('#ffd60a'), [Math.cos(a) * 0.125, Math.sin(a) * 0.125, -0.005], [0, 0, a], [1.5, 0.55, 0.25]);
    }
    return g;
  },

  cargo() {
    const g = new THREE.Group();
    const strap = M('#ff8a1e');
    const boxes = [[0.42, 0.3, 0.3, '#3a3d44'], [0.38, 0.24, 0.28, '#c9ccd2'], [0.3, 0.2, 0.24, '#e0b90f']];
    let y = 0;
    for (const [w, h, d, color] of boxes) {
      put(g, G.box(w, h, d), M(color, { roughness: 0.5 }), [0, y + h / 2, 0]);
      put(g, G.box(0.03, h + 0.004, d + 0.004), strap, [-w * 0.28, y + h / 2, 0]);
      put(g, G.box(0.03, h + 0.004, d + 0.004), strap, [w * 0.28, y + h / 2, 0]);
      put(g, G.box(0.05, 0.02, 0.006), glow('#35d6ff', 1.6), [0, y + h * 0.7, d / 2 + 0.003]);
      y += h + 0.005;
    }
    seg(g, [0.16, 0, -0.17], [0.16, y + 0.12, -0.17], 0.008, metal());              // armature
    seg(g, [-0.16, 0, -0.17], [-0.16, y + 0.12, -0.17], 0.008, metal());
    return g;
  },

  crate(p, tf) {
    const g = new THREE.Group();
    const s = 0.5;
    const wood = T(tf, { bg: ['#b9813f', '#9a6a30'], pattern: 'planks', accent: '#4a2e12', patternAlpha: 0.8 }, 256, 256, { roughness: 0.9 });
    put(g, G.box(s, s, s), wood, [0, s / 2, 0]);
    const frame = M('#6b4423', { roughness: 0.9 });
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      put(g, G.box(0.05, s + 0.01, 0.05), frame, [a * (s / 2 - 0.02), s / 2, b * (s / 2 - 0.02)]);
      put(g, G.box(s + 0.01, 0.05, 0.05), frame, [0, s / 2 + a * (s / 2 - 0.02), b * (s / 2 - 0.02)]);
      put(g, G.box(0.05, 0.05, s + 0.01), frame, [a * (s / 2 - 0.02), s / 2 + b * (s / 2 - 0.02), 0]);
    }
    put(g, G.sph(0.07), M('#ff6b35', { roughness: 0.4 }), [0.05, s + 0.07, 0.03]);  // fruit
    put(g, G.sph(0.03), M('#3aa845'), [0.05, s + 0.15, 0.03], [0, 0, 0.4], [1.6, 0.3, 0.8]);
    return g;
  },

  cookingPot() {
    const g = new THREE.Group();
    const steel = metal('#b9bec7');
    put(g, G.box(0.42, 0.24, 0.42), M('#d9d9de', { metalness: 0.5, roughness: 0.4 }), [0, 0.12, 0]);
    put(g, G.box(0.3, 0.1, 0.01), M(DARK), [0, 0.11, 0.211]);
    put(g, G.tor(0.11, 0.012), glow('#ff5a1e', 1.8), [0, 0.245, 0], [PI / 2, 0, 0]); // brûleur
    put(g, G.cyl(0.16, 0.15, 0.17, 24), steel, [0, 0.345, 0]);
    put(g, G.cyl(0.145, 0.145, 0.01, 24), M('#e85d04', { roughness: 0.3 }), [0, 0.428, 0]); // soupe
    for (const sx of [-1, 1]) put(g, G.tor(0.03, 0.008, PI), steel, [sx * 0.175, 0.39, 0], [PI / 2, 0, sx > 0 ? -PI / 2 : PI / 2]);
    seg(g, [0.05, 0.42, 0.02], [0.2, 0.56, 0.1], 0.008, M('#6b4423'));              // louche
    put(g, G.sph(0.035), M('#d00000', { roughness: 0.3 }), [-0.14, 0.275, 0.15]);   // tomate
    put(g, G.sph(0.032), M('#e9d8a6'), [0.15, 0.272, 0.15], [0, 0, 0], [1, 1.1, 1]); // oignon
    return g;
  },

  bomb() {
    const g = new THREE.Group();
    put(g, G.sph(0.2, 28, 20), M('#15151a', { roughness: 0.3, metalness: 0.4 }), [0, 0.2, 0]);
    put(g, G.cyl(0.05, 0.055, 0.05, 16), M('#3a3a40'), [0, 0.41, 0]);
    seg(g, [0, 0.43, 0], [0.05, 0.5, 0.01], 0.008, M('#c9a26b'));
    seg(g, [0.05, 0.5, 0.01], [0.11, 0.53, 0.02], 0.008, M('#c9a26b'));
    put(g, G.sph(0.028, 10, 8), glow('#ff8a1e', 2.5), [0.12, 0.535, 0.02]);
    return g;
  },
};
