/**
 * GamingRoomQuiz.js — Chambre de gamer 3D « objets cachés / quiz » (100 références).
 *
 * Usage :
 *   import { GamingRoomQuiz } from './gaming-room-quiz/GamingRoomQuiz.js';
 *   const quiz = new GamingRoomQuiz(containerElement, {
 *     onSelectObject(itemData) { … ouvrir votre modale … },
 *     onProgressChange(foundCount, totalCount) { … },
 *   });
 *   const result = quiz.submitGuess(itemId, userText);
 *   // → { success, canonicalTitle, progress, total, alreadyFound }
 *
 * Vue : la caméra suit la souris (capture du pointeur, façon FPS) ; glisser pour
 * regarder quand le pointeur est libre (tactile inclus) ; ZQSD/WASD pour marcher.
 *
 * Assets : par défaut tout est procédural. L'option `assets` permet de brancher
 * VOS images (jpg/png/webp) et VOS modèles (glTF/GLB) objet par objet — voir
 * assets-manifest.example.js. GLTFLoader n'est chargé que si un modèle est déclaré.
 *
 * Dépendance : three (≥ r152).
 * Le conteneur doit avoir une taille (largeur ET hauteur) définie en CSS.
 */
import * as THREE from 'three';
import { GAMES, ZONES } from './games-data.js';
import { buildAnswerSet, matchAnswer } from './answer-matcher.js';
import { createTextureFactory } from './textures.js';
import { BUILDERS, M, G, put } from './builders.js';

const PI = Math.PI;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ───────────── Plan de la pièce (mètres) ───────────── */
const ROOM = { w: 12, d: 10, h: 4 };                       // x ∈ [-6, 6], z ∈ [-5, 5]
const LIB = { x0: -5.6, colW: 0.8, y0: 0.25, rowH: 0.62, cols: 5, rows: 5, depth: 0.44, zBack: -4.98 };
const DESK = { x: 2.6, w: 4.0, d: 1.0, top: 0.78, z: -4.45 };
const SHELVES = { x0: 0.7, w: 3.8, ys: [1.75, 2.4, 3.05], z: -4.8, perShelf: 6 };
const BED = { x: 4.7, z: 2.6, len: 2.4, wid: 1.8, top: 0.55 };

/** Zone 2 — emplacements sur le bureau (IDs 26 → 32). */
const DESK_SLOTS = [
  [1.75, -4.65], [2.65, -4.65],   // deux écrans
  [2.2, -4.15],                   // boîtier à minuterie
  [3.65, -4.55],                  // volant
  [0.95, -4.4],                   // manche à balai
  [1.5, -4.15],                   // console portable
  [4.25, -4.2],                   // quille + télécommande
];

/** Zone 3 — 25 emplacements muraux : 10 à gauche, 10 à droite, 5 en façade. */
const WALL_SLOTS = (() => {
  const slots = [];
  const zs = [-3.6, -1.8, 0, 1.8, 3.6];
  for (const y of [2.75, 1.5]) for (const z of zs) slots.push({ pos: [-ROOM.w / 2 + 0.03, y, z], rotY: PI / 2 });
  for (const y of [2.75, 1.5]) for (const z of zs) slots.push({ pos: [ROOM.w / 2 - 0.03, y, z], rotY: -PI / 2 });
  for (const x of [-4, -2, 0, 2, 4]) slots.push({ pos: [x, 2.1, ROOM.d / 2 - 0.03], rotY: PI });
  return slots;
})();

/** Zone 4 — emplacements explicites (IDs 76 → 100). */
const FLOOR_SLOTS = {
  76: { pos: [5.68, 0.77, 1.95], rot: [0, 0, 1.15] },      // coussins adossés à la tête de lit
  77: { pos: [5.68, 0.77, 2.6], rot: [0, 0, 1.15] },
  78: { pos: [5.68, 0.77, 3.25], rot: [0, 0, 1.15] },
  79: { pos: [4.75, 0.585, 2.15], rotY: 0.3 },             // coussins posés sur la couette
  80: { pos: [4.5, 0.585, 3.05], rotY: -0.4 },
  81: { pos: [-0.5, 0, 1.2] },                             // tapis
  82: { pos: [-3.5, 0, 0.5] },
  83: { pos: [2.2, 0, -1.5] },
  84: { pos: [3.05, 0, 2.6], rotY: -PI / 2 },              // coffre au pied du lit
  85: { pos: [-4.8, 0, 4.6], rotY: PI },                   // mini-bornes d'arcade
  86: { pos: [-3.8, 0, 4.6], rotY: PI },
  87: { pos: [-2.8, 0, 4.6], rotY: PI },
  88: { pos: [-1.8, 0, 4.6], rotY: PI },
  89: { pos: [-1.1, 0, -4.2] },
  90: { pos: [-0.1, 0, -4.4] },
  91: { pos: [-5.45, 0, 2.5], rotY: PI / 2 },
  92: { pos: [-4.6, 0, -2.6], rotY: 0.5 },
  93: { pos: [-5.1, 0, -0.9] },
  94: { pos: [5.3, 0, -4.2], rotY: -0.6 },
  95: { pos: [0.9, 0, 3.6] },
  96: { pos: [5.4, 0, 0.4], rotY: -PI / 2 },
  97: { pos: [5.3, 0, -2.2], rotY: -PI / 2 },
  98: { pos: [2.4, 0, 4.3], rotY: 0.2 },
  99: { pos: [-0.3, 0, 4.3], rotY: PI },
  100: { pos: [1.5, 0, 1.0] },
};

/** Calcule l'emplacement (sans chevauchement) d'un jeu selon sa zone. */
function slotFor(game, indexInZone) {
  const i = indexInZone;
  if (game.zone === 1) {
    const row = Math.floor(i / LIB.cols), col = i % LIB.cols;           // rangée 0 = tout en haut
    return {
      pos: [LIB.x0 + (col + 0.5) * LIB.colW,
        LIB.y0 + (LIB.rows - 1 - row) * LIB.rowH + 0.015,
        LIB.zBack + LIB.depth / 2 + 0.03],
    };
  }
  if (game.zone === 2) {
    if (i < DESK_SLOTS.length) return { pos: [DESK_SLOTS[i][0], DESK.top, DESK_SLOTS[i][1]] };
    const s = i - DESK_SLOTS.length;
    const shelf = Math.floor(s / SHELVES.perShelf), col = s % SHELVES.perShelf;
    return { pos: [SHELVES.x0 + (col + 0.5) * (SHELVES.w / SHELVES.perShelf), SHELVES.ys[shelf] + 0.02, SHELVES.z] };
  }
  if (game.zone === 3) return WALL_SLOTS[(i * 7 + 3) % WALL_SLOTS.length]; // permutation : mélange les types d'objets
  return FLOOR_SLOTS[game.id];
}

/* ══════════════════════════════════════════════════════════════════════ */

export class GamingRoomQuiz {
  /**
   * @param {HTMLElement} containerElement  élément DOM hôte (doit avoir une taille)
   * @param {object} [options]
   * @param {(itemData: object) => void} [options.onSelectObject]   clic sur un objet NON trouvé
   *        itemData = { id (1–100), zone (1–4), zoneName, objectLabel, hint, found: false }
   * @param {(foundCount: number, totalCount: number) => void} [options.onProgressChange]
   * @param {(itemData: object|null) => void} [options.onHoverObject]  survol (null = rien)
   * @param {(itemData: object) => void} [options.onSelectFoundObject] clic sur un objet déjà trouvé (contient `title`)
   * @param {string|null} [options.storageKey]  clé localStorage pour mémoriser la progression (null = désactivé)
   * @param {boolean} [options.fuzzy=true]      tolère une petite faute de frappe
   * @param {boolean} [options.shadows=true]
   * @param {number}  [options.moveSpeed=3]     vitesse ZQSD/WASD en m/s
   * @param {boolean} [options.pointerLock=true]   capture la souris au clic (vue « FPS ») ; false = glisser pour regarder
   * @param {number}  [options.lookSensitivity=1]  sensibilité de la souris
   * @param {boolean} [options.crosshair=true]     affiche un viseur central quand la souris est capturée
   * @param {(locked: boolean) => void} [options.onPointerLockChange]
   * @param {Object<number, {image?: string, model?: string, modelScale?: number, modelRotationY?: number, modelOffset?: number[]}>} [options.assets]
   *        images / modèles glTF fournis par l'application, indexés par ID d'objet
   * @param {string}  [options.assetBaseUrl='']    préfixe des URLs relatives du manifeste
   * @param {boolean} [options.symbols=true]       false = textures procédurales sans emoji (couleurs et motifs seuls)
   * @param {(itemId: number, url: string, error: Error) => void} [options.onAssetError]
   */
  constructor(containerElement, options = {}) {
    if (!containerElement || typeof containerElement.appendChild !== 'function') {
      throw new TypeError('GamingRoomQuiz : containerElement doit être un élément DOM.');
    }
    this.container = containerElement;
    this.options = {
      onSelectObject: null, onProgressChange: null, onHoverObject: null, onSelectFoundObject: null,
      storageKey: null, fuzzy: true, shadows: true, moveSpeed: 3,
      pointerLock: true, lookSensitivity: 1, crosshair: true, onPointerLockChange: null,
      assets: null, assetBaseUrl: '', symbols: true, onAssetError: null,
      ...options,
    };

    this._items = new Map();        // id → { game, group, hitbox, materials, badge, found, answers, center }
    this._hitboxes = [];
    this._occluders = [];
    this._hovered = null;
    this._foundCount = 0;
    this._keys = Object.create(null);
    this._keyboardEnabled = true;
    this._pointer = new THREE.Vector2();
    this._pointerDirty = false;
    this._pointerDown = null;
    this._raycaster = new THREE.Raycaster();
    this._clock = new THREE.Clock();
    this._yaw = 0;                  // rotation horizontale de la vue (radians)
    this._pitch = -0.05;            // rotation verticale
    this._locked = false;           // souris capturée ?
    this._drag = null;
    this._loadedTextures = [];
    this._disposed = false;

    this._initRenderer();
    this._textures = createTextureFactory({ symbols: this.options.symbols });
    this._buildRoom();
    this._buildFurniture();
    this._buildItems();
    this._bindEvents();
    this._restore();
    /** Promesse résolue quand toutes les images / modèles du manifeste sont traités. */
    this.assetsReady = this._loadAssets(this.options.assets);

    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
    // Notifie l'état initial une fois le constructeur terminé (l'appelant a alors sa référence).
    queueMicrotask(() => this._emitProgress());
  }

  /* ══════════════ API publique ══════════════ */

  get total() { return this._items.size; }
  get foundCount() { return this._foundCount; }

  /**
   * Vérifie la réponse du joueur pour un objet.
   * @returns {{success: boolean, canonicalTitle: string, progress: number, total: number, alreadyFound: boolean}}
   *          canonicalTitle vaut '' tant que la réponse est fausse (aucune fuite du titre).
   */
  submitGuess(itemId, userText) {
    const item = this._items.get(Number(itemId));
    const base = { success: false, canonicalTitle: '', progress: this._foundCount, total: this.total, alreadyFound: false };
    if (!item) return base;
    if (item.found) return { ...base, success: true, canonicalTitle: item.game.title, alreadyFound: true };
    if (!matchAnswer(userText, item.answers, this.options.fuzzy)) return base;

    this._setFound(item, true);
    this._save();
    this._emitProgress();
    return { ...base, success: true, canonicalTitle: item.game.title, progress: this._foundCount };
  }

  /** Données publiques d'un objet (le titre n'est inclus que s'il est trouvé). */
  getItemData(itemId) {
    const item = this._items.get(Number(itemId));
    return item ? this._publicData(item) : null;
  }

  getProgress() {
    return { found: this._foundCount, total: this.total, foundIds: [...this._items.values()].filter((i) => i.found).map((i) => i.game.id) };
  }

  /** Remet la partie à zéro. */
  reset() {
    for (const item of this._items.values()) if (item.found) this._setFound(item, false);
    this._save();
    this._emitProgress();
  }

  /** Active / désactive les déplacements clavier (ils sont déjà ignorés pendant la saisie dans un champ). */
  setKeyboardEnabled(enabled) {
    this._keyboardEnabled = !!enabled;
    if (!enabled) this._keys = Object.create(null);
  }

  /** Amène la caméra face à un objet (pratique pour un bouton « me montrer »). */
  focusItem(itemId) {
    const item = this._items.get(Number(itemId));
    if (!item) return;
    const c = item.center;
    const away = new THREE.Vector3(-c.x, 0, -c.z);
    if (away.lengthSq() < 0.01) away.set(0, 0, 1);
    away.normalize();
    const p = this.camera.position;
    p.set(clamp(c.x + away.x * 2.2, -5.6, 5.6), clamp(c.y + 0.2, 0.6, 3.4), clamp(c.z + away.z * 2.2, -4.6, 4.6));
    const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z;
    this._yaw = Math.atan2(-dx, -dz);
    this._pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.45, 1.45);
    this._pointerDirty = true;
  }

  /**
   * Applique (ou remplace) à chaud l'image / le modèle d'un objet.
   * @returns {Promise<void>}
   */
  setItemAssets(itemId, config) {
    return this._loadAssets({ [itemId]: config });
  }

  /** Libère la souris (à appeler si votre UI s'ouvre sans passer par onSelectObject). */
  releasePointer() {
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  /** Libère toutes les ressources (GPU, écouteurs, canvas). */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    this._unbind?.();
    this._resizeObserver?.disconnect();
    this.releasePointer();
    this._crosshair?.remove();
    this._loadedTextures.forEach((t) => t.dispose());
    this.scene.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => m.dispose());
    });
    this._textures.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ══════════════ Initialisation ══════════════ */

  _initRenderer() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w || 800, h || 600, false);
    this.renderer.shadowMap.enabled = !!this.options.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    canvas.tabIndex = 0;
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0c12');

    this.camera = new THREE.PerspectiveCamera(62, (w || 800) / (h || 600), 0.05, 60);
    this.camera.rotation.order = 'YXZ';                 // lacet (Y) puis tangage (X) : vue à la première personne
    this.camera.position.set(0, 1.65, 3.4);
    canvas.style.cursor = 'grab';

    // Viseur central (visible uniquement quand la souris est capturée).
    if (this.options.crosshair) {
      if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
      const cross = document.createElement('div');
      cross.style.cssText = 'position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-5px 0 0 -5px;'
        + 'border:1px solid rgba(0,0,0,.6);border-radius:50%;background:rgba(255,255,255,.9);pointer-events:none;display:none;';
      this.container.appendChild(cross);
      this._crosshair = cross;
    }

    // Lumières
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.9));
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a2f28', 1.3));
    const sun = new THREE.DirectionalLight('#fff1dc', 1.6);
    sun.position.set(1.5, 3.9, 1.5);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = !!this.options.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 0.1, far: 12 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    const deskLamp = new THREE.PointLight('#7aa2ff', 6, 6, 2);
    deskLamp.position.set(DESK.x, 1.5, -4.0);
    const bedLamp = new THREE.PointLight('#ff9a5a', 5, 6, 2);
    bedLamp.position.set(4.6, 1.8, 2.6);
    this.scene.add(deskLamp, bedLamp);
  }

  _buildRoom() {
    const tf = this._textures;
    const room = new THREE.Group();
    room.name = 'room';
    const wallMat = () => M('#ffffff', {
      map: tf.art({ bg: ['#343a5e', '#262a45'], pattern: 'stripes', accent: '#ffffff', patternAlpha: 0.035, repeat: [5, 1] }, 256, 256),
      roughness: 0.95,
    });
    const floorMat = M('#ffffff', {
      map: tf.art({ bg: ['#8a6541', '#7c5a39'], pattern: 'planks', accent: '#2a1a0a', patternAlpha: 0.55, repeat: [5, 5] }, 256, 256),
      roughness: 0.8,
    });
    const add = (w, h, material, pos, rot) => {
      const mesh = put(room, G.plane(w, h), material, pos, rot);
      mesh.castShadow = false;
      this._occluders.push(mesh);
      return mesh;
    };
    add(ROOM.w, ROOM.d, floorMat, [0, 0, 0], [-PI / 2, 0, 0]);
    add(ROOM.w, ROOM.d, M('#1c1e2c', { roughness: 1 }), [0, ROOM.h, 0], [PI / 2, 0, 0]);
    add(ROOM.w, ROOM.h, wallMat(), [0, ROOM.h / 2, -ROOM.d / 2], [0, 0, 0]);
    add(ROOM.w, ROOM.h, wallMat(), [0, ROOM.h / 2, ROOM.d / 2], [0, PI, 0]);
    add(ROOM.d, ROOM.h, wallMat(), [-ROOM.w / 2, ROOM.h / 2, 0], [0, PI / 2, 0]);
    add(ROOM.d, ROOM.h, wallMat(), [ROOM.w / 2, ROOM.h / 2, 0], [0, -PI / 2, 0]);
    // Plafonnier
    put(room, G.cyl(0.35, 0.35, 0.05, 32), M('#fff6e0', { emissive: '#fff1cc', emissiveIntensity: 1.2 }), [0, ROOM.h - 0.03, 0]);
    this.scene.add(room);
  }

  _buildFurniture() {
    const f = new THREE.Group();
    f.name = 'furniture';
    const wood = () => M('#3b2a1e', { roughness: 0.8 });
    const solid = (geo, material, pos, rot) => {
      const mesh = put(f, geo, material, pos, rot);
      this._occluders.push(mesh);
      return mesh;
    };

    // Zone 1 — bibliothèque murale (5 × 5 cases)
    const libW = LIB.cols * LIB.colW, libH = LIB.rows * LIB.rowH;
    const libCx = LIB.x0 + libW / 2, libCz = LIB.zBack + LIB.depth / 2;
    solid(G.box(libW + 0.06, libH + 0.06, 0.03), M('#2a1e16'), [libCx, LIB.y0 + libH / 2, LIB.zBack + 0.015]);
    for (let r = 0; r <= LIB.rows; r++) solid(G.box(libW + 0.06, 0.03, LIB.depth), wood(), [libCx, LIB.y0 + r * LIB.rowH, libCz]);
    for (let c = 0; c <= LIB.cols; c++) solid(G.box(0.03, libH, LIB.depth), wood(), [LIB.x0 + c * LIB.colW, LIB.y0 + libH / 2, libCz]);
    solid(G.box(libW + 0.06, LIB.y0, LIB.depth), M('#2a1e16'), [libCx, LIB.y0 / 2, libCz]);    // plinthe

    // Zone 2 — bureau + 3 étagères flottantes
    solid(G.box(DESK.w, 0.05, DESK.d), M('#23252e', { roughness: 0.5 }), [DESK.x, DESK.top - 0.025, DESK.z]);
    for (const sx of [-1, 1]) {
      solid(G.box(0.06, DESK.top - 0.05, DESK.d - 0.1), M('#15161c'), [DESK.x + sx * (DESK.w / 2 - 0.08), (DESK.top - 0.05) / 2, DESK.z]);
    }
    put(f, G.box(DESK.w - 0.3, 0.012, 0.02), M('#7a5cff', { emissive: '#7a5cff', emissiveIntensity: 1.5 }), [DESK.x, DESK.top - 0.06, DESK.z + DESK.d / 2]);
    for (const y of SHELVES.ys) {
      solid(G.box(SHELVES.w, 0.04, 0.36), wood(), [SHELVES.x0 + SHELVES.w / 2, y, SHELVES.z]);
    }
    // Chaise de bureau (décor)
    const chair = new THREE.Group();
    chair.position.set(2.3, 0, -3.3);
    chair.rotation.y = 0.25;
    put(chair, G.cyl(0.28, 0.3, 0.04, 5), M('#15161c'), [0, 0.04, 0]);
    put(chair, G.cyl(0.03, 0.03, 0.4, 10), M('#8f96a0', { metalness: 0.8, roughness: 0.3 }), [0, 0.25, 0]);
    put(chair, G.box(0.5, 0.08, 0.5), M('#b3202a', { roughness: 0.9 }), [0, 0.48, 0]);
    put(chair, G.box(0.48, 0.7, 0.08), M('#b3202a', { roughness: 0.9 }), [0, 0.87, 0.24], [0.12, 0, 0]);
    f.add(chair);

    // Zone 4 — lit (tête contre le mur droit)
    solid(G.box(BED.len, 0.3, BED.wid), wood(), [BED.x, 0.15, BED.z]);
    solid(G.box(BED.len - 0.1, 0.25, BED.wid - 0.1), M('#f1f1ee', { roughness: 0.95 }), [BED.x, 0.425, BED.z]);
    solid(G.box(1.4, 0.03, BED.wid - 0.08), M('#3a4a8a', { roughness: 1 }), [BED.x - 0.5, BED.top + 0.015, BED.z]);
    solid(G.box(0.1, 0.9, BED.wid), wood(), [BED.x + BED.len / 2, 0.45, BED.z]);

    this.scene.add(f);
  }

  _buildItems() {
    const tf = this._textures;
    const indexInZone = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const badgeMaterial = new THREE.SpriteMaterial({ map: tf.badge(), transparent: true, depthWrite: false });

    for (const game of GAMES) {
      const builder = BUILDERS[game.kind];
      if (!builder) throw new Error(`GamingRoomQuiz : constructeur inconnu « ${game.kind} » (ID ${game.id}).`);
      const slot = slotFor(game, indexInZone[game.zone]++);
      if (!slot) throw new Error(`GamingRoomQuiz : aucun emplacement pour l'ID ${game.id}.`);

      const group = builder(game.params ?? {}, tf);
      group.name = `item-${game.id}`;
      const localBox = new THREE.Box3().setFromObject(group);   // gabarit local : sert à caler un modèle glTF
      group.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
      group.rotation.set(slot.rot?.[0] ?? 0, slot.rotY ?? slot.rot?.[1] ?? 0, slot.rot?.[2] ?? 0);
      this.scene.add(group);
      group.updateMatrixWorld(true);

      const { materials, artMaterials } = this._collectMaterials(group);

      // Boîte de collision invisible (clic confortable, même sur les objets fins).
      box.setFromObject(group);
      box.getSize(size);
      const center = box.getCenter(new THREE.Vector3());
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(size.x, 0.14) + 0.04, Math.max(size.y, 0.03) + 0.04, Math.max(size.z, 0.14) + 0.04),
        hitMaterial,
      );
      hitbox.position.copy(center);
      hitbox.userData.itemId = game.id;
      this.scene.add(hitbox);
      this._hitboxes.push(hitbox);

      // Badge « Trouvé » (masqué au départ).
      const badge = new THREE.Sprite(badgeMaterial);
      badge.scale.set(0.2, 0.2, 1);
      badge.position.set(center.x, box.max.y + 0.14, center.z);
      badge.visible = false;
      badge.userData.baseY = badge.position.y;
      this.scene.add(badge);

      this._items.set(game.id, {
        game, group, hitbox, badge, center, localBox,
        materials, artMaterials,
        answers: buildAnswerSet(game.title, game.aliases),
        found: false,
        pop: 0,
      });
    }
  }

  /** Recense les matériaux d'un objet : surbrillance (émissif) et surfaces d'illustration. */
  _collectMaterials(group) {
    const materials = new Set(), artMaterials = new Set();
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
        if (m.userData.isArt) artMaterials.add(m);
        if (m.emissive) {
          if (m.userData.baseEmissive === undefined) {
            m.userData.baseEmissive = m.emissive.getHex();
            m.userData.baseIntensity = m.emissiveIntensity;
          }
          materials.add(m);
        }
      });
    });
    return { materials: [...materials], artMaterials: [...artMaterials] };
  }

  /* ══════════════ Assets fournis par l'application (images / modèles) ══════════════ */

  _assetUrl(url) {
    return /^(?:[a-z]+:|\/)/i.test(url) ? url : this.options.assetBaseUrl + url;
  }

  /** Traite un manifeste { id: { image, model, … } }. Tout échec retombe sur l'objet procédural. */
  _loadAssets(manifest) {
    const jobs = [];
    for (const [id, config] of Object.entries(manifest ?? {})) {
      const item = this._items.get(Number(id));
      if (!item || !config) continue;
      const fail = (url) => (error) => {
        console.warn(`GamingRoomQuiz : asset illisible pour l'objet ${id} (${url})`, error);
        this.options.onAssetError?.(Number(id), url, error);
      };
      const image = () => (config.image ? this._applyImage(item, config).catch(fail(config.image)) : undefined);
      jobs.push(config.model
        ? this._applyModel(item, config).catch((error) => { fail(config.model)(error); return image(); })
        : image());
    }
    return Promise.allSettled(jobs).then(() => undefined);
  }

  /** Plaque une image sur la surface d'illustration de l'objet (jaquette, écran, affiche…), recadrée sans déformation. */
  async _applyImage(item, config) {
    if (!item.artMaterials.length) throw new Error('cet objet n\'a pas de surface d\'illustration : fournissez plutôt un modèle');
    const texture = await new THREE.TextureLoader().loadAsync(this._assetUrl(config.image));
    if (this._disposed) { texture.dispose(); return; }
    const imageAspect = texture.image.width / texture.image.height;
    item.artMaterials.forEach((material, index) => {
      const map = index === 0 ? texture : texture.clone();
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const surfaceAspect = material.userData.artAspect ?? 1;       // recadrage « cover »
      if (imageAspect > surfaceAspect) map.repeat.set(surfaceAspect / imageAspect, 1);
      else map.repeat.set(1, imageAspect / surfaceAspect);
      map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2);
      map.needsUpdate = true;
      material.map = map;
      if (material.emissiveMap) material.emissiveMap = map;
      material.needsUpdate = true;
      this._loadedTextures.push(map);
    });
  }

  /** Remplace l'objet procédural par un modèle glTF/GLB, mis à l'échelle et calé dans le même gabarit. */
  async _applyModel(item, config) {
    this._gltfModule ??= import('three/addons/loaders/GLTFLoader.js');
    const { GLTFLoader } = await this._gltfModule;
    const gltf = await new GLTFLoader().loadAsync(this._assetUrl(config.model));
    if (this._disposed) return;

    const model = gltf.scene;
    model.rotation.y += config.modelRotationY ?? 0;
    const target = item.localBox, targetSize = target.getSize(new THREE.Vector3());
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const ratios = ['x', 'y', 'z'].filter((a) => size[a] > 1e-6 && targetSize[a] > 1e-6).map((a) => targetSize[a] / size[a]);
    model.scale.multiplyScalar((ratios.length ? Math.min(...ratios) : 1) * (config.modelScale ?? 1));

    box.setFromObject(model);
    const from = box.getCenter(new THREE.Vector3()), to = target.getCenter(new THREE.Vector3());
    if (item.game.zone === 3) { from.z = box.min.z; to.z = target.min.z; }    // objets muraux : dos contre le mur
    else { from.y = box.min.y; to.y = target.min.y; }                          // objets posés : base au même niveau
    model.position.add(to.sub(from));
    if (config.modelOffset) model.position.add(new THREE.Vector3(...config.modelOffset));

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = obj.receiveShadow = true;
      obj.material = Array.isArray(obj.material) ? obj.material.map((m) => m.clone()) : obj.material.clone();
    });

    // Retire la version procédurale, installe le modèle et rebranche la surbrillance.
    item.group.traverse((obj) => {
      obj.geometry?.dispose();
      (Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []).forEach((m) => m.dispose());
    });
    item.group.clear();
    item.group.add(model);
    Object.assign(item, this._collectMaterials(item.group));
    this._applyVisual(item);
  }

  /* ══════════════ Interactions ══════════════ */

  _bindEvents() {
    const canvas = this.renderer.domElement;
    const isTyping = (target) => !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''));
    const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

    const setPointerFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect();
      this._pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this._pointerDirty = true;
    };
    const look = (dx, dy, factor) => {
      this._yaw -= dx * factor;
      this._pitch = clamp(this._pitch - dy * factor, -1.45, 1.45);
      this._pointerDirty = true;
    };

    // La vue suit la souris : en continu quand elle est capturée, sinon en glissant (souris ou doigt).
    const onPointerMove = (e) => {
      const k = this.options.lookSensitivity;
      if (this._locked) { look(e.movementX || 0, e.movementY || 0, 0.0022 * k); return; }
      if (this._drag && this._drag.id === e.pointerId) {
        look(-(e.clientX - this._drag.x), -(e.clientY - this._drag.y), 0.004 * k);
        this._drag.x = e.clientX; this._drag.y = e.clientY;
      }
      setPointerFromEvent(e);
    };
    const onPointerDown = (e) => {
      this._pointerDown = { x: e.clientX, y: e.clientY, button: e.button };
      if (!this._locked) {
        this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture?.(e.pointerId);
        canvas.style.cursor = 'grabbing';
      }
    };
    const onPointerUp = (e) => {
      const down = this._pointerDown;
      this._pointerDown = null;
      this._drag = null;
      if (!down || down.button !== 0) return;
      if (!this._locked) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { this._pointerDirty = true; return; }  // c'était un glisser
        setPointerFromEvent(e);
      }
      const item = this._pick();                            // souris capturée → viseur central
      if (!item) {
        // Clic « dans le vide » : on capture la souris pour regarder librement.
        if (!this._locked && this.options.pointerLock && e.pointerType === 'mouse') canvas.requestPointerLock?.();
        return;
      }
      if (item.found) { this.options.onSelectFoundObject?.(this._publicData(item)); return; }
      this.releasePointer();                                // rend le curseur à l'interface (modale de saisie)
      this.options.onSelectObject?.(this._publicData(item));
    };
    const onPointerLeave = () => { if (!this._locked) { this._pointer.set(2, 2); this._pointerDirty = true; } };
    const onLockChange = () => {
      this._locked = document.pointerLockElement === canvas;
      if (this._crosshair) this._crosshair.style.display = this._locked ? 'block' : 'none';
      if (this._locked) this._pointer.set(0, 0);
      this._pointerDirty = true;
      this.options.onPointerLockChange?.(this._locked);
    };
    const onWheel = (e) => {                                // molette = zoom optique
      e.preventDefault();
      this.camera.fov = clamp(this.camera.fov + Math.sign(e.deltaY) * 3, 25, 75);
      this.camera.updateProjectionMatrix();
      this._pointerDirty = true;
    };

    // e.code = position physique de la touche : KeyW/A/S/D couvre WASD (QWERTY) ET ZQSD (AZERTY).
    const onKeyDown = (e) => {
      if (!this._keyboardEnabled || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!MOVE_KEYS.has(e.code)) return;
      this._keys[e.code] = true;
      if (e.code.startsWith('Arrow') && document.activeElement === canvas) e.preventDefault();
    };
    const onKeyUp = (e) => { this._keys[e.code] = false; };
    const onBlur = () => { this._keys = Object.create(null); };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.container);

    this._unbind = () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Raycasting : renvoie l'objet du quiz sous le pointeur (les murs/meubles font écran). */
  _pick() {
    if (Math.abs(this._pointer.x) > 1 || Math.abs(this._pointer.y) > 1) return null;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects([...this._hitboxes, ...this._occluders], false);
    const id = hits.length ? hits[0].object.userData.itemId : undefined;
    return id !== undefined ? this._items.get(id) : null;
  }

  _updateHover() {
    const item = this._pick();
    if (item === this._hovered) return;
    const previous = this._hovered;
    this._hovered = item;
    if (previous) this._applyVisual(previous);
    if (item) this._applyVisual(item);
    if (!this._drag) this.renderer.domElement.style.cursor = item ? 'pointer' : 'grab';
    this.options.onHoverObject?.(item ? this._publicData(item) : null);
  }

  /** États visuels : repos / survol (bleu) / trouvé (vert doré). */
  _applyVisual(item) {
    const hovered = item === this._hovered;
    for (const m of item.materials) {
      if (item.found) {
        m.emissive.set('#6fe06a');
        m.emissiveIntensity = hovered ? 0.6 : 0.32;
      } else if (hovered) {
        m.emissive.set('#5aa9ff');
        m.emissiveIntensity = 0.55;
      } else {
        m.emissive.setHex(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseIntensity;
      }
    }
    item.badge.visible = item.found;
  }

  _setFound(item, found) {
    if (item.found === found) return;
    item.found = found;
    this._foundCount += found ? 1 : -1;
    item.pop = found ? 1 : 0;
    if (!found) item.group.scale.setScalar(1);
    this._applyVisual(item);
  }

  _publicData(item) {
    const { game } = item;
    const data = {
      id: game.id,
      zone: game.zone,
      zoneName: ZONES[game.zone],
      objectLabel: game.objet,
      hint: game.hint ?? null,
      found: item.found,
    };
    if (item.found) data.title = game.title;       // jamais de titre avant la bonne réponse
    return data;
  }

  _emitProgress() {
    if (!this._disposed) this.options.onProgressChange?.(this._foundCount, this.total);
  }

  /* ══════════════ Persistance (optionnelle) ══════════════ */

  _save() {
    if (!this.options.storageKey) return;
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(this.getProgress().foundIds));
    } catch { /* stockage indisponible : on continue sans */ }
  }

  _restore() {
    if (!this.options.storageKey) return;
    try {
      const ids = JSON.parse(localStorage.getItem(this.options.storageKey) || '[]');
      if (!Array.isArray(ids)) return;
      for (const id of ids) {
        const item = this._items.get(Number(id));
        if (item) { this._setFound(item, true); item.pop = 0; }
      }
    } catch { /* données illisibles : on repart de zéro */ }
  }

  /* ══════════════ Boucle de rendu ══════════════ */

  _move(dt) {
    const k = this._keys;
    const forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    if (!forward && !strafe) return;

    // Repère de marche dérivé du lacet : avant = (-sin, 0, -cos), droite = (cos, 0, -sin).
    const sin = Math.sin(this._yaw), cos = Math.cos(this._yaw);
    const step = (this.options.moveSpeed * dt) / Math.hypot(forward, strafe);
    this.camera.position.x += (-sin * forward + cos * strafe) * step;
    this.camera.position.z += (-cos * forward - sin * strafe) * step;
    this._pointerDirty = true;
  }

  _tick() {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, this._clock.getDelta());
    const t = this._clock.elapsedTime;

    this._move(dt);
    // La caméra reste dans la pièce et s'oriente selon la souris.
    const p = this.camera.position;
    p.x = clamp(p.x, -ROOM.w / 2 + 0.35, ROOM.w / 2 - 0.35);
    p.z = clamp(p.z, -ROOM.d / 2 + 0.35, ROOM.d / 2 - 0.35);
    this.camera.rotation.set(this._pitch, this._yaw, 0);

    if (this._pointerDirty) { this._pointerDirty = false; this._updateHover(); }

    for (const item of this._items.values()) {
      if (!item.found) continue;
      item.badge.position.y = item.badge.userData.baseY + Math.sin(t * 2 + item.game.id) * 0.015;
      if (item.pop > 0) {                                   // petit « pop » à la découverte
        item.pop = Math.max(0, item.pop - dt * 2.5);
        item.group.scale.setScalar(1 + Math.sin(item.pop * PI) * 0.12);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export { GAMES, ZONES };
export default GamingRoomQuiz;
