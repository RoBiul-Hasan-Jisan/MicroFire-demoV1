/**
 * MicroFire Atlas 3D scene (plain three.js, client only).
 *
 * The flame is an ILLUSTRATION driven by a test's recorded conditions and outcome, not a
 * combustion simulation: its colour, size and behaviour encode what NASA wrote down
 * (kept burning, quenched as flow fell, blew off, never ignited).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type Outcome = "burning" | "quench" | "blowoff" | "dim" | "none";

export type CloudPoint = { id: string; label: string; x: number; y: number; z: number; color: string; hollow?: boolean };

export type SceneState = {
  view: "bench" | "duct" | "cloud";
  /** Buoyancy scales with g: Moon and Mars sit between orbit and Earth. An illustration, not a simulation. */
  gravity: "earth" | "moon" | "mars" | "orbit";
  /** Oxygen, vol %: drives flame brightness. */
  o2: number;
  /** Airflow, cm/s: drives drift and streak speed. */
  flow: number;
  outcome: Outcome;
  material?: "PMMA" | "fabric" | "nomex" | "silicone" | "jersey";
  /** No matching NASA evidence: the flame is replaced by a dashed "?" outline. */
  unknown?: boolean;
  cloud?: CloudPoint[];
  highlight?: string[];
  /** Show an empty "no data" region in the cloud (e.g. 34 % O2). */
  voidRegion?: { y: number; label: string } | null;
  /** Installed hardware for the build chapter; undefined means the full rig. */
  parts?: string[];
  /** Hardware slot to outline while the player is placing it. */
  ghost?: string | null;
  /** Hot-wire igniter glow, 0 to 1. */
  igniter?: number;
  /** Readiness-check mix-ups (illustrative game puzzle, not a NASA crew error). */
  sampleLoose?: boolean;
  fanReversed?: boolean;
  /** Quiet-flame search: "hidden" makes the dim flame very hard to see; "found" rings it. */
  seek?: "hidden" | "found" | null;
  /** Show name tags on installed parts. */
  labels?: boolean;
  /** Close observation shot on the sample and flame instead of the whole glovebox. */
  focus?: boolean;
  /** Tighter framing on the flame front only (Flame Lab close-up). */
  zoom?: "flame";
};

/** BASS-II hardware the player can install (positions are illustrative, layout follows NASA's description). */
export const PART_IDS = ["duct", "fan", "straightener", "holder", "igniter", "still", "video", "radiometer", "nozzle", "exit"] as const;
export type PartId = (typeof PART_IDS)[number];
const PART_LABEL: Record<PartId, string> = {
  duct: "Flow duct", fan: "Fan", straightener: "Straightener", holder: "Sample holder", igniter: "Igniter coil",
  still: "Still camera", video: "Video camera", radiometer: "Radiometer", nozzle: "Nitrogen nozzle", exit: "Exit plate",
};

const N = 2600;

const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor.rgb, min(1.0, vColor.a * a * a * 2.5));
}`;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const G: Record<SceneState["gravity"], number> = { earth: 1, mars: 0.38, moon: 0.17, orbit: 0 };

/** Woven or knitted sample surfaces, drawn once on a canvas (no texture downloads). */
const SAMPLE_LOOK: Record<NonNullable<SceneState["material"]>, { color: number; rough: number; opacity: number; weave?: [string, string] }> = {
  PMMA: { color: 0xd6e6f2, rough: 0.12, opacity: 0.72 },
  fabric: { color: 0xffffff, rough: 0.85, opacity: 1, weave: ["#b9a27e", "#8c7655"] },
  nomex: { color: 0xffffff, rough: 0.8, opacity: 1, weave: ["#d4b13c", "#a88b25"] },
  silicone: { color: 0xb79a96, rough: 0.9, opacity: 1 },
  jersey: { color: 0xffffff, rough: 0.9, opacity: 1, weave: ["#ece6da", "#c9c0ad"] },
};
const weaveCache = new Map<string, THREE.CanvasTexture>();
function weave([a, b]: [string, string]) {
  const key = a + b;
  if (weaveCache.has(key)) return weaveCache.get(key)!;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = a; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = b; x.lineWidth = 2;
  for (let i = 0; i < 64; i += 8) { x.beginPath(); x.moveTo(0, i + 2); x.lineTo(64, i + 2); x.stroke(); x.beginPath(); x.moveTo(i + 6, 0); x.lineTo(i + 6, 64); x.globalAlpha = 0.5; x.stroke(); x.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  weaveCache.set(key, t);
  return t;
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A square frame (outer minus inner opening) in the y-z plane, `t` thick along x. */
function ringFrame(outerH: number, outerD: number, innerH: number, innerD: number, t: number) {
  const sh = new THREE.Shape();
  sh.moveTo(-outerD / 2, -outerH / 2); sh.lineTo(outerD / 2, -outerH / 2); sh.lineTo(outerD / 2, outerH / 2); sh.lineTo(-outerD / 2, outerH / 2); sh.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-innerD / 2, -innerH / 2); hole.lineTo(-innerD / 2, innerH / 2); hole.lineTo(innerD / 2, innerH / 2); hole.lineTo(innerD / 2, -innerH / 2); hole.closePath();
  sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  g.translate(0, 0, -t / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function textSprite(text: string, color = "#e6eaf2", size = 44, weight = 600) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `${weight} ${size}px Archivo, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  c.width = w;
  c.height = size + 16;
  ctx.font = `${weight} ${size}px Archivo, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(w / 200, c.height / 200, 1);
  return s;
}

export class FlameScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = true;
  private reduced: boolean;

  private state: SceneState;
  // smoothed parameters
  private p = { grav: 1, o2: 21, flow: 5, life: 1, lift: 0, blue: 0, cloud: 0, gust: 0, loose: 0, fanDir: 1, flash: 0, seek: 1 };

  private duct = new THREE.Group();
  private bench = new THREE.Group();
  private flameGroup = new THREE.Group();
  private cloudGroup = new THREE.Group();
  private sample!: THREE.Mesh;
  private glow!: THREE.Sprite;
  private light!: THREE.PointLight;

  private pos = new Float32Array(N * 3);
  private vel = new Float32Array(N * 3);
  private col = new Float32Array(N * 4);
  private size = new Float32Array(N);
  private age = new Float32Array(N);
  private life = new Float32Array(N);
  private geo = new THREE.BufferGeometry();
  private next = 0;

  private streaks!: THREE.LineSegments;
  private streakPos = new Float32Array(160 * 6);
  private cloudMeshes = new Map<string, { mesh: THREE.Mesh; label: THREE.Sprite }>();
  private voidBox: THREE.Group | null = null;
  private fadeIn = 1;
  private partGroups = new Map<string, THREE.Group>();
  private installedAt = new Map<string, number>();
  private ghostBox: THREE.Box3Helper | null = null;
  private fanBlades = new THREE.Group();
  private coilMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a, emissive: 0x000000, metalness: 0.6, roughness: 0.4 });
  private coilGlow!: THREE.Sprite;
  private gentle = false;
  private time = 0;

  private panelLeft = false;
  private partTags = new Map<string, THREE.Sprite>();
  private seekRing!: THREE.Sprite;
  private ghost = new THREE.Group();
  private recentering = 0;
  private glovebox: THREE.Group | null = null;
  private gloveFront = new THREE.Group(); // glove ports and gloves: hidden in close-up shots so they never block the sample
  private disposed = false;
  private snap = true; // jump the camera straight to its framing on the first frame and on view cuts

  private fit = false; // frame the subject by distance (zoom) as well as target, without a side-panel shift

  constructor(private canvas: HTMLCanvasElement, initial: SceneState, opts: { compact?: boolean; panelLeft?: boolean; fit?: boolean } = {}) {
    this.panelLeft = !!opts.panelLeft;
    this.fit = !!opts.fit;
    this.state = initial;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2)); // phones: fewer pixels, smoother frames
    // studio look: filmic tone mapping and a soft room environment for metal and glass reflections
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    if (opts.compact) this.camera.position.set(3.4, 1.7, 5.6);
    else this.camera.position.set(5.5, 2.6, 8.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.autoRotate = false; // no constant orbit: the camera only moves to frame a new task
    this.controls.target.set(0, 0.2, 0);

    this.scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x1a2234, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.8);
    key.position.set(4, 7, 6);
    const rim = new THREE.DirectionalLight(0x6fb6ff, 1.2);
    rim.position.set(-6, 3, -6);
    this.scene.add(key, rim);

    this.buildDuct();
    this.buildRig();
    this.buildCameraStandIns();
    if (opts.compact) this.duct.children.filter((c) => (c as THREE.Sprite).isSprite).forEach((c) => (c.visible = false)); // caption explains instead
    this.buildGlovebox();
    this.buildTags();
    this.buildBench();
    this.buildFlame();
    this.buildStreaks();
    this.scene.add(this.duct, this.bench, this.flameGroup, this.cloudGroup);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.setState(initial, true);
    this.loop();
    void this.loadModels();
  }

  /* ---------------- construction ---------------- */

  /* Materials shared by the rig: brushed aluminium frames, satin black anodising, glass, copper, rubber. */
  private mat = {
    alu: new THREE.MeshPhysicalMaterial({ color: 0xc3ccd6, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0x9aa4b2, metalness: 1, roughness: 0.22 }),
    anod: new THREE.MeshPhysicalMaterial({ color: 0x1b2232, metalness: 0.85, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    blue: new THREE.MeshPhysicalMaterial({ color: 0x2a4f8f, metalness: 0.7, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.13, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    copper: new THREE.MeshPhysicalMaterial({ color: 0xd08a5a, metalness: 1, roughness: 0.28, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0, roughness: 0.85 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, metalness: 0, roughness: 0.35, clearcoat: 0.5 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xe8edf3, metalness: 1, roughness: 0.08 }),
  };

  private buildDuct() {
    // BASS flow duct: square cross-section, roughly 2.2x longer than wide (7.6 cm x 17 cm test section).
    const ductPart = this.part("duct");
    const L = 8, H = 3.6, D = 3.6;
    // four clear walls (top, bottom, front, back), open at the ends for the fan and the exit plate
    for (const [w, h, pos, rot] of [
      [L, D, [0, H / 2, 0], [-Math.PI / 2, 0, 0]], [L, D, [0, -H / 2, 0], [Math.PI / 2, 0, 0]],
      [L, H, [0, 0, D / 2], [0, 0, 0]], [L, H, [0, 0, -D / 2], [0, Math.PI, 0]],
    ] as const) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat.glass);
      pane.position.set(...(pos as [number, number, number]));
      pane.rotation.set(...(rot as [number, number, number]));
      pane.renderOrder = 2;
      ductPart.add(pane);
    }
    // brushed aluminium frame on every edge, with rounded corners
    const rail = (len: number, axis: "x" | "y" | "z", x: number, y: number, z: number) => {
      const g = new RoundedBoxGeometry(axis === "x" ? len : 0.16, axis === "y" ? len : 0.16, axis === "z" ? len : 0.16, 3, 0.05);
      const m = new THREE.Mesh(g, this.mat.alu);
      m.position.set(x, y, z);
      ductPart.add(m);
    };
    for (const y of [-H / 2, H / 2]) for (const z of [-D / 2, D / 2]) rail(L + 0.16, "x", 0, y, z);
    for (const x of [-L / 2, L / 2]) {
      for (const z of [-D / 2, D / 2]) rail(H, "y", x, 0, z);
      for (const y of [-H / 2, H / 2]) rail(D, "z", x, y, 0);
      // end flanges with bolt heads
      const flange = new THREE.Mesh(ringFrame(H + 0.34, D + 0.34, H - 0.05, D - 0.05, 0.1), this.mat.anod);
      flange.position.x = x;
      ductPart.add(flange);
      const k = H / 2 + 0.085, out = x < 0 ? -0.08 : 0.08;
      for (const [by, bz] of [[-k, -k], [-k, 0], [-k, k], [0, -k], [0, k], [k, -k], [k, 0], [k, k]]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), this.mat.chrome);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(x + out, by, bz);
        ductPart.add(bolt);
      }
    }

    // flow straightener at the inlet: a honeycomb of thin hexagonal cells
    const straight = this.part("straightener");
    const cell = new THREE.CylinderGeometry(0.15, 0.15, 0.55, 6, 1, true);
    cell.rotateZ(Math.PI / 2);
    const cells: THREE.Vector3[] = [];
    for (let row = -6; row <= 6; row++) for (let col = -6; col <= 6; col++) {
      const y = row * 0.26, z = col * 0.3 + (row % 2 ? 0.15 : 0);
      if (Math.abs(y) < 1.66 && Math.abs(z) < 1.66) cells.push(new THREE.Vector3(-3.72, y, z));
    }
    const comb = new THREE.InstancedMesh(cell, new THREE.MeshPhysicalMaterial({ color: 0xd9dee6, metalness: 1, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false }), cells.length); // see-through so the fan behind it stays visible
    const mx = new THREE.Matrix4();
    cells.forEach((p, i) => comb.setMatrixAt(i, mx.makeTranslation(p.x, p.y, p.z)));
    straight.add(comb);
    const sframe = new THREE.Mesh(ringFrame(3.5, 3.5, 3.3, 3.3, 0.6), this.mat.alu);
    sframe.position.x = -3.72;
    straight.add(sframe);

    const label = textSprite("BASS-II flow duct, ISS glovebox (illustration)", "#8f9ab1", 30, 500);
    label.position.set(0, 3.25, 0);
    this.duct.add(label);
  }

  private part(id: string) {
    let g = this.partGroups.get(id);
    if (!g) {
      g = new THREE.Group();
      g.name = id;
      this.partGroups.set(id, g);
      this.duct.add(g);
    }
    return g;
  }

  private buildRig() {
    const { alu, steel, anod, blue, copper, rubber, ceramic, chrome } = this.mat;

    // variable-speed fan at the inlet: bell-mouth shroud, swept blades, spinner, guard and motor
    const fan = this.part("fan");
    const shroudProfile = [[1.62, -0.42], [1.5, -0.36], [1.44, -0.2], [1.42, 0.2], [1.46, 0.32], [1.58, 0.36]].map(([x, y]) => new THREE.Vector2(x, y));
    const shroud = new THREE.Mesh(new THREE.LatheGeometry(shroudProfile, 72), new THREE.MeshPhysicalMaterial({ color: 0x24324d, metalness: 0.8, roughness: 0.3, clearcoat: 0.9, side: THREE.DoubleSide }));
    shroud.rotation.z = Math.PI / 2;
    shroud.position.x = -4.7;
    fan.add(shroud);
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.12);
    blade.bezierCurveTo(0.35, -0.24, 1.05, -0.3, 1.28, -0.08);
    blade.bezierCurveTo(1.34, 0.1, 1.0, 0.24, 0.0, 0.14);
    const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 16 });
    for (let k = 0; k < 7; k++) {
      const arm = new THREE.Group();
      const b = new THREE.Mesh(bladeGeo, alu);
      b.rotation.set(0.5, 0, Math.PI / 2); // radial along y, pitched into the flow
      b.position.y = 0.12;
      arm.add(b);
      arm.rotation.x = (k / 7) * Math.PI * 2;
      this.fanBlades.add(arm);
    }
    const spinner = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.42], [0.12, 0.38], [0.24, 0.26], [0.3, 0.05], [0.3, -0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 48), chrome);
    spinner.rotation.z = -Math.PI / 2;
    this.fanBlades.add(spinner);
    this.fanBlades.position.x = -4.7;
    fan.add(this.fanBlades);
    const guard = new THREE.Group();
    for (const rr of [0.55, 0.95, 1.35]) guard.add(new THREE.Mesh(new THREE.TorusGeometry(rr, 0.018, 8, 72), chrome));
    for (let k = 0; k < 8; k++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.4, 6), chrome);
      spoke.position.y = 0.7;
      const s = new THREE.Group();
      s.add(spoke);
      s.rotation.z = (k / 8) * Math.PI * 2;
      guard.add(s);
    }
    guard.rotation.y = Math.PI / 2;
    guard.position.x = -5.15;
    fan.add(guard);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 40), anod);
    motor.rotation.z = Math.PI / 2;
    motor.position.x = -5.6;
    fan.add(motor);
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, 40), alu);
      fin.rotation.y = Math.PI / 2;
      fin.position.x = -5.85 + i * 0.1;
      fan.add(fin);
    }
    const strut = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.7, 0.5, 2, 0.05), anod);
    strut.position.set(-5.6, -1.2, 0);
    fan.add(strut);

    // sample holder: brushed frame with clamp bars and screws (BASS sample holders carry a built-in igniter)
    const holder = this.part("holder");
    const bar = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.1, d, 2, 0.03), steel);
      m.position.set(x, -0.64, z);
      holder.add(m);
    };
    bar(5.6, 0.16, 0.3, 0.68);
    bar(5.6, 0.16, 0.3, -0.68);
    bar(0.16, 1.52, -2.5, 0);
    bar(0.16, 1.52, 3.1, 0);
    for (const x of [-2.5, 3.1]) for (const z of [-0.68, 0.68]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), chrome);
      screw.position.set(x, -0.57, z);
      holder.add(screw);
    }
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.14, 1.15, 0.14, 2, 0.04), anod);
    post.position.set(0.3, -1.2, -0.68);
    holder.add(post);

    // Kanthal hot-wire igniter coil at the leading edge, on ceramic posts with copper leads
    const igniter = this.part("igniter");
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.005) pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 16) * 0.08, Math.sin(t * Math.PI * 16) * 0.08, (t - 0.5) * 1.0));
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.016, 8), this.coilMat);
    coil.position.set(-0.95, -0.5, 0);
    igniter.add(coil);
    for (const z of [-0.56, 0.56]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 20), ceramic);
      p.position.set(-0.95, -0.56, z);
      igniter.add(p);
    }
    const lead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.95, -0.6, 0.6), new THREE.Vector3(-1.1, -0.75, 1.0), new THREE.Vector3(-1.4, -0.7, 1.6)]), 30, 0.02, 8), copper);
    igniter.add(lead);

    // still camera above the top window and video camera at the front window: downloaded models, see loadModels()
    // radiometer: thermopile head, downstream top back corner, looking upstream
    const rad = this.part("radiometer");
    const head = new THREE.Mesh(new THREE.LatheGeometry([[0, -0.3], [0.17, -0.3], [0.17, 0.12], [0.13, 0.16], [0.13, 0.3], [0.08, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)), 40), blue);
    head.rotation.z = Math.PI / 2;
    head.position.set(3.45, 1.45, -1.45);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshPhysicalMaterial({ color: 0x101820, metalness: 0.2, roughness: 0.05, clearcoat: 1 }));
    win.rotation.y = -Math.PI / 2;
    win.position.set(3.125, 1.45, -1.45);
    const knurl = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.025, 6, 40), steel);
    knurl.rotation.y = Math.PI / 2;
    knurl.position.set(3.55, 1.45, -1.45);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(3.75, 1.45, -1.45), new THREE.Vector3(4.1, 1.6, -1.5), new THREE.Vector3(4.4, 2.1, -1.7)]), 24, 0.03, 8), rubber);
    rad.add(head, win, knurl, cable);

    // nozzle for N2 flow (oxygen control): a bent chrome line with a valve
    const nozzle = this.part("nozzle");
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-2.3, -1.45, 1.1), new THREE.Vector3(-3.3, -1.45, 1.1), new THREE.Vector3(-3.7, -1.5, 1.5), new THREE.Vector3(-3.8, -1.6, 2.4)]), 48, 0.06, 12), chrome);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 6), steel);
    valve.position.set(-3.6, -1.45, 1.3);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 24), blue);
    knob.position.set(-3.6, -1.2, 1.3);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.18, 16), copper);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(-2.22, -1.45, 1.1);
    nozzle.add(line, valve, knob, tip);

    // perforated copper plate at the exit, in an anodised frame
    const exit = this.part("exit");
    const holes = document.createElement("canvas");
    holes.width = holes.height = 512;
    const hc = holes.getContext("2d")!;
    hc.fillStyle = "#fff";
    hc.fillRect(0, 0, 512, 512);
    hc.fillStyle = "#000";
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      hc.beginPath();
      hc.arc(16 + i * 32 + (j % 2 ? 8 : 0), 16 + j * 32, 10, 0, Math.PI * 2);
      hc.fill();
    }
    const alpha = new THREE.CanvasTexture(holes);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), new THREE.MeshPhysicalMaterial({ color: 0xd08a5a, metalness: 1, roughness: 0.3, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide }));
    plate.rotation.y = Math.PI / 2;
    plate.position.x = 4.02;
    const eframe = new THREE.Mesh(ringFrame(3.7, 3.7, 3.4, 3.4, 0.1), anod);
    eframe.position.x = 4.02;
    exit.add(plate, eframe);
  }

  /** The ISS glovebox around the duct: work-volume floor with tie-down holes, framed glass, glove ports (illustration). */
  private buildGlovebox() {
    const g = new THREE.Group();
    const W = 13.5, Hh = 7.4, Dd = 6.6;
    const tex = document.createElement("canvas");
    tex.width = tex.height = 512;
    const t = tex.getContext("2d")!;
    t.fillStyle = "#283043";
    t.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      t.fillStyle = "#1a2030";
      t.beginPath();
      t.arc(32 + i * 64, 32 + j * 64, 7, 0, Math.PI * 2);
      t.fill();
      t.strokeStyle = "#5a6680";
      t.lineWidth = 2;
      t.stroke();
    }
    const floorTex = new THREE.CanvasTexture(tex);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 1.5);
    floorTex.anisotropy = 8;
    const floor = new THREE.Mesh(new RoundedBoxGeometry(W, 0.24, Dd, 3, 0.08), new THREE.MeshPhysicalMaterial({ map: floorTex, metalness: 0.45, roughness: 0.62, envMapIntensity: 0.45 }));
    floor.position.y = -3.7;
    g.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshPhysicalMaterial({ color: 0x1a2336, metalness: 0.6, roughness: 0.55 }));
    back.position.set(0, 0, -Dd / 2);
    g.add(back);
    // framed edges of the work volume
    const edge = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.04), this.mat.alu);
      m.position.set(x, y, z);
      g.add(m);
    };
    for (const y of [-Hh / 2, Hh / 2]) for (const z of [-Dd / 2, Dd / 2]) edge(W, 0.14, 0.14, 0, y, z);
    for (const x of [-W / 2, W / 2]) {
      for (const z of [-Dd / 2, Dd / 2]) edge(0.14, Hh, 0.14, x, 0, z);
      for (const y of [-Hh / 2, Hh / 2]) edge(0.14, 0.14, Dd, x, y, 0);
    }
    // front window with two glove ports
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.06, clearcoat: 1, envMapIntensity: 1.2, depthWrite: false }));
    front.position.z = Dd / 2;
    front.renderOrder = 3;
    g.add(front);
    for (const x of [-3.2, 3.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 20, 64), this.mat.rubber);
      ring.position.set(x, -1.2, Dd / 2);
      const flange = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.07, 12, 64), this.mat.alu);
      flange.position.set(x, -1.2, Dd / 2 + 0.05);
      this.gloveFront.add(ring, flange);
    }
    g.add(this.gloveFront);
    // feet that hold the duct off the floor
    for (const x of [-3, 3]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.8, 0.34, 2, 0.06), this.mat.anod);
      leg.position.set(x, -2.7, 0);
      g.add(leg);
    }
    g.position.y = 0.05;
    this.glovebox = g;
    this.duct.add(g);
  }

  /** Downloaded models (see public/models/CREDITS.txt). The scene works without them; they slot in when loaded. */
  private async loadModels() {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    // decode embedded textures through <img> (img-src blob: is allowed) instead of fetch(blob:), which the strict CSP blocks
    loader.register((parser) => {
      (parser as unknown as { textureLoader: THREE.Loader }).textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: "microfire_img_textures" };
    });
    const fit = (obj: THREE.Object3D, size: number) => {
      const box = new THREE.Box3().setFromObject(obj);
      const s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
      obj.scale.multiplyScalar(s);
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      obj.position.sub(c);
      const wrap = new THREE.Group();
      wrap.add(obj);
      return wrap;
    };
    const load = (url: string) => new Promise<THREE.Group>((ok, bad) => loader.load(url, (g) => ok(g.scene), undefined, bad));
    try {
      const [still, video, glove] = await Promise.all([load("/models/camera-still.glb"), load("/models/camera-video.glb"), load("/models/glove.glb")]);
      if (this.disposed) return;
      // still camera: lens pointing down through the top window
      const s = fit(still, 1.25);
      s.rotation.set(Math.PI / 2, 0, 0);
      s.position.set(0.3, 2.35, 0);
      this.swapIn("still", s);
      // video camera: NASA infrared-camera model, re-finished as a dark video camera, looking in through the front window
      video.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const name = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? "";
        m.material = name === "lens" ? this.mat.chrome.clone() : name === "screen" ? new THREE.MeshPhysicalMaterial({ color: 0x0d1f3a, emissive: 0x16365e, roughness: 0.1, clearcoat: 1 })
          : name === "AL" ? this.mat.alu : name === "black" ? this.mat.rubber : this.mat.anod;
        if (name === "lens") (m.material as THREE.MeshPhysicalMaterial).color.set(0x2a3340);
      });
      const v = fit(video, 1.2);
      v.rotation.set(0.2, Math.PI / 2, 0); // below the sample, tilted up, so it never hides the flame
      v.position.set(0.6, -1.25, 2.9);
      this.swapIn("video", v);
      // NASA astronaut gloves reaching in through the glove ports
      for (const x of [-3.2, 3.2]) {
        const gl = fit(glove.clone(true), 2.3);
        gl.rotation.set(-0.25, x < 0 ? -Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, 0);
        gl.position.set(x * 0.92, -1.35, 2.2);
        this.gloveFront.add(gl);
      }
    } catch {
      // keep the simple stand-ins built below
    }
  }

  /** Replace a part's stand-in with a loaded model, keeping the part group (visibility, install animation, tags). */
  private swapIn(id: string, model: THREE.Object3D) {
    const g = this.part(id);
    g.clear();
    g.add(model);
    if (this.state.labels) this.placeTags();
  }

  /** Stand-ins for the cameras until (or if) the models load. */
  private buildCameraStandIns() {
    const body = (w: number, h: number, d: number) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.08), this.mat.anod);
    const lens = (r: number, l: number) => new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, l, 32), this.mat.chrome);
    const still = this.part("still");
    const sb = body(0.9, 0.55, 0.7);
    sb.position.set(0.3, 2.45, 0);
    const sl = lens(0.22, 0.45);
    sl.position.set(0.3, 2.0, 0);
    still.add(sb, sl);
    const video = this.part("video");
    const vb = body(0.8, 0.5, 0.6);
    vb.position.set(0.6, -1.25, 3.1);
    const vl = lens(0.17, 0.4);
    vl.rotation.x = Math.PI / 2;
    vl.position.set(0.6, -1.25, 2.6);
    video.add(vb, vl);
  }

  private buildTags() {
    for (const id of PART_IDS) {
      const t = textSprite(PART_LABEL[id], "#e6eaf2", 34, 600);
      t.visible = false;
      this.partTags.set(id, t);
      this.duct.add(t);
    }
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#56d4e4";
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.stroke();
    this.seekRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
    this.seekRing.scale.set(2.4, 2.4, 1);
    this.duct.add(this.seekRing);
  }

  private placeTags() {
    for (const [id, tag] of this.partTags) {
      const g = this.partGroups.get(id)!;
      if (!g.visible) continue;
      const box = new THREE.Box3().setFromObject(g);
      const c = box.getCenter(new THREE.Vector3());
      // the duct's tag sits on its top edge; everything else just above the part
      tag.position.set(c.x, (id === "duct" ? box.max.y - 0.2 : box.max.y) + 0.35, c.z);
    }
  }

  private buildBench() {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 96), new THREE.MeshPhysicalMaterial({ color: 0x0f1626, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.4 }));
    plate.position.y = -0.9;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.045, 12, 128), this.mat.alu);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.86;
    this.bench.add(plate, rim);
  }

  private buildFlame() {
    this.sample = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 1.1), new THREE.MeshStandardMaterial({ color: 0xb8c1d4, roughness: 0.6, transparent: true, opacity: 0.85, envMapIntensity: 0.35 }));
    this.sample.position.set(0.3, -0.6, 0);
    this.flameGroup.add(this.sample);

    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const pts = new THREE.Points(this.geo, mat);
    pts.frustumCulled = false;
    this.flameGroup.add(pts);

    const g = document.createElement("canvas");
    g.width = g.height = 128;
    const ctx = g.getContext("2d")!;
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), color: 0xf0a044, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false }));
    this.glow.scale.set(1.6, 1.6, 1);
    this.flameGroup.add(this.glow);
    this.coilGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow.material.map, color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
    this.coilGlow.position.set(-0.95, -0.5, 0);
    this.coilGlow.scale.set(1, 1, 1);
    this.duct.add(this.coilGlow);
    this.light = new THREE.PointLight(0xf0a044, 4, 8, 1.6);
    this.flameGroup.add(this.light);
    for (let i = 0; i < N; i++) this.age[i] = this.life[i] = 1;

    // evidence boundary: a dashed teardrop outline and a "?" where no NASA test supports drawing a flame
    const prof = Array.from({ length: 14 }, (_, i) => { const t = i / 13; return new THREE.Vector2(Math.sin(Math.PI * t) * 0.42 * (1 - t * 0.55), t * 1.9); });
    const lathe = new THREE.LatheGeometry(prof, 18);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(lathe, 1), new THREE.LineDashedMaterial({ color: 0xff8a5a, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.55, toneMapped: false }));
    lines.computeLineDistances();
    const q = textSprite("?", "#ffc3a8", 120, 800);
    q.position.set(0, 0.95, 0);
    q.scale.multiplyScalar(1.4);
    this.ghost.add(lines, q);
    this.ghost.visible = false;
    this.flameGroup.add(this.ghost);
  }

  private buildStreaks() {
    const g = new THREE.BufferGeometry();
    for (let i = 0; i < 160; i++) {
      const y = rand(-1.6, 1.6), z = rand(-1.6, 1.6), x = rand(-3.9, 3.9);
      this.streakPos.set([x, y, z, x + 0.3, y, z], i * 6);
    }
    g.setAttribute("position", new THREE.BufferAttribute(this.streakPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x56d4e4, transparent: true, opacity: 0.35, toneMapped: false }));
    this.duct.add(this.streaks);
  }

  private buildCloud(points: CloudPoint[]) {
    this.cloudGroup.clear();
    this.cloudMeshes.clear();
    const axis = (from: THREE.Vector3, to: THREE.Vector3) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      this.cloudGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x2c3a58 })));
    };
    axis(new THREE.Vector3(-4, -2, -2), new THREE.Vector3(4, -2, -2));
    axis(new THREE.Vector3(-4, -2, -2), new THREE.Vector3(-4, 2.4, -2));
    axis(new THREE.Vector3(-4, -2, -2), new THREE.Vector3(-4, -2, 2));
    const lx = textSprite("Airflow (log) →", "#8f9ab1", 30, 500);
    lx.position.set(3.2, -2.35, -2);
    const ly = textSprite("Oxygen ↑", "#8f9ab1", 30, 500);
    ly.position.set(-4, 2.7, -2);
    const lz = textSprite("Material: PMMA, fabric, Nomex", "#8f9ab1", 26, 500);
    lz.position.set(-4, -2.4, 1.6);
    this.cloudGroup.add(lx, ly, lz);
    const sphere = new THREE.SphereGeometry(1, 20, 16);
    for (const p of points) {
      const mat = new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: p.hollow ? 0.25 : 0.7, transparent: true, opacity: p.hollow ? 0.45 : 0.95, wireframe: !!p.hollow });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(0.09);
      const label = textSprite(p.label, "#ffffff", 40, 700);
      label.position.set(p.x, p.y + 0.45, p.z);
      label.visible = false;
      this.cloudGroup.add(mesh, label);
      this.cloudMeshes.set(p.id, { mesh, label });
    }
  }

  private setVoid(v: SceneState["voidRegion"]) {
    if (this.voidBox) this.cloudGroup.remove(this.voidBox);
    this.voidBox = null;
    if (!v) return;
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(8, 0.9, 4);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineDashedMaterial({ color: 0xf0a044, dashSize: 0.15, gapSize: 0.12 })));
    (g.children[0] as THREE.LineSegments).computeLineDistances();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf0a044, transparent: true, opacity: 0.05, depthWrite: false })));
    const label = textSprite(v.label, "#f0a044", 40, 700);
    label.position.set(0, 0.8, 0);
    g.add(label);
    g.position.set(0, v.y, 0);
    this.voidBox = g;
    this.cloudGroup.add(g);
  }

  /* ---------------- state ---------------- */

  setState(s: SceneState, immediate = false) {
    const prevCloud = this.state.cloud;
    if (s.view !== this.state.view && !immediate) {
      this.fadeIn = 0; // quick cut between views
      this.snap = true;
    }
    this.state = s;
    if (s.cloud && (s.cloud !== prevCloud || this.cloudMeshes.size === 0)) this.buildCloud(s.cloud);
    if (s.view === "cloud") this.setVoid(s.voidRegion ?? null);
    const hi = new Set(s.highlight ?? []);
    for (const [id, { mesh, label }] of this.cloudMeshes) {
      const on = hi.has(id);
      mesh.scale.setScalar(on ? 0.2 : hi.size ? 0.07 : 0.09);
      (mesh.material as THREE.MeshStandardMaterial).opacity = hi.size && !on ? 0.25 : 0.95;
      label.visible = on;
    }
    const look = SAMPLE_LOOK[s.material ?? "PMMA"];
    const sm = this.sample.material as THREE.MeshStandardMaterial;
    sm.color.set(look.color); sm.roughness = look.rough; sm.opacity = look.opacity;
    sm.map = look.weave ? weave(look.weave) : null;
    sm.needsUpdate = true;
    if (s.outcome !== "quench" && s.outcome !== "blowoff") this.p.lift = 0;
    const installed = new Set(s.parts ?? PART_IDS);
    for (const [id, g] of this.partGroups) {
      const was = g.visible;
      g.visible = installed.has(id);
      if (g.visible && !was && !immediate) this.installedAt.set(id, this.time);
    }
    for (const [id, tag] of this.partTags) tag.visible = !!s.labels && installed.has(id);
    if (s.labels) this.placeTags();
    if (this.ghostBox) this.duct.remove(this.ghostBox);
    this.ghostBox = null;
    if (s.ghost && this.partGroups.has(s.ghost) && !installed.has(s.ghost)) {
      const g = this.partGroups.get(s.ghost)!;
      g.visible = true;
      const box = new THREE.Box3().setFromObject(g).expandByScalar(0.12);
      g.visible = false;
      this.ghostBox = new THREE.Box3Helper(box, 0x56d4e4);
      this.duct.add(this.ghostBox);
    }
    if (immediate) {
      this.p.grav = G[s.gravity];
      this.p.o2 = s.o2;
      this.p.flow = s.flow;
      this.p.cloud = s.view === "cloud" ? 1 : 0;
      this.p.life = s.outcome === "none" ? 0 : 1;
      this.p.loose = s.sampleLoose ? 1 : 0;
      this.p.fanDir = s.fanReversed ? -1 : 1;
    } else if (s.outcome === "burning" || s.outcome === "dim") {
      this.p.life = Math.max(this.p.life, 0.3);
    }
  }

  /** Gentle motion: no auto-rotation, fewer particles. */
  setGentle(on: boolean) {
    this.gentle = on;
    this.controls.autoRotate = false;
  }

  /** Ignition payoff: a short bright flash, then the flame settles. */
  ignite() {
    this.p.flash = 1;
  }

  /** Swing the camera back to the framing chosen for this view. */
  recenter() {
    this.recentering = 1;
  }

  /** A sudden gust of ventilation: NASA warns a small flame may flare up. */
  gust() {
    this.p.gust = 1;
  }

  /* ---------------- frame ---------------- */

  private spawn(i: number, s: SceneState) {
    const p = this.p;
    const front = this.sample.position.x - 1.2 + p.lift * 3.5;
    const z = rand(0.15, 0.7); // front edge of the illustrated sample, visible from the default camera
    this.pos.set([front + rand(-0.15, 0.15), this.sample.position.y + 0.04 + p.lift * 0.4, z], i * 3);
    const strength = 0.5 + (p.o2 - 14) / 14; // brighter with more oxygen
    const earthUp = rand(1.4, 2.4) * strength;
    const theta = rand(0, Math.PI * 2), phi = rand(0, Math.PI);
    const r = rand(0.12, 0.32) * strength;
    const ox = Math.sin(phi) * Math.cos(theta) * r, oy = Math.abs(Math.cos(phi)) * r * 0.9 + 0.05, oz = Math.sin(phi) * Math.sin(theta) * r;
    const drift = p.flow * 0.035 * (s.view === "duct" ? 1 : 0.2);
    this.vel.set([lerp(ox, rand(-0.15, 0.15), p.grav) + drift * (1 - p.grav), lerp(oy, earthUp, p.grav), lerp(oz, rand(-0.15, 0.15), p.grav)], i * 3);
    this.age[i] = 0;
    this.life[i] = lerp(rand(1.2, 2.2), rand(0.6, 1.1), p.grav) * (1 + p.gust * 0.6);
    this.size[i] = rand(0.12, 0.28) * (0.6 + strength * 0.5) * (1 + p.gust * 0.8) * (0.65 + p.grav * 0.7); // world units
  }

  private step(dt: number) {
    const s = this.state, p = this.p, k = 1 - Math.exp(-dt * 2.2);
    this.time += dt;
    for (const [id, t0] of this.installedAt) {
      const g = this.partGroups.get(id)!;
      const t = Math.min(1, (this.time - t0) / 0.55);
      const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // ease-out-back
      g.scale.setScalar(0.4 + 0.6 * back);
      g.position.y = (1 - t) * 1.6;
      if (t >= 1) {
        g.scale.setScalar(1);
        g.position.y = 0;
        this.installedAt.delete(id);
      }
    }
    if (this.ghostBox) (this.ghostBox.material as THREE.LineBasicMaterial).opacity = 0.45 + 0.45 * Math.sin(this.time * 5);
    if (this.ghostBox) (this.ghostBox.material as THREE.LineBasicMaterial).transparent = true;
    p.loose = lerp(p.loose, s.sampleLoose ? 1 : 0, k * 1.4);
    p.fanDir = lerp(p.fanDir, s.fanReversed ? -1 : 1, k * 1.4);
    p.flash = Math.max(0, p.flash - dt * 1.6);
    p.seek = lerp(p.seek, s.seek === "hidden" ? 0.03 : 1, k * 2);
    // the illustrative loose sample drifts up and out of its holder, tilted
    this.sample.position.set(0.3 + p.loose * 1.2, -0.6 + p.loose * 1.3, p.loose * 0.4);
    this.sample.rotation.z = p.loose * 0.35;
    this.fanBlades.rotation.x += dt * (0.4 + p.flow * 0.9) * p.fanDir;
    const heat = s.igniter ?? 0;
    this.coilMat.emissive.setRGB(heat * 1.0, heat * 0.42, heat * 0.12);
    (this.coilGlow.material as THREE.SpriteMaterial).opacity = heat * 0.8;
    this.coilGlow.visible = this.partGroups.get("igniter")!.visible;
    this.sample.visible = s.view !== "duct" || this.partGroups.get("holder")!.visible;
    this.gloveFront.visible = !s.focus;
    p.grav = lerp(p.grav, G[s.gravity], k);
    p.o2 = lerp(p.o2, s.o2, k);
    p.flow = lerp(p.flow, s.flow, k);
    p.cloud = lerp(p.cloud, s.view === "cloud" ? 1 : 0, k);
    p.blue = lerp(p.blue, s.outcome === "dim" || s.outcome === "quench" ? 1 : 0.55 * (1 - G[s.gravity]), k * 0.6);
    p.gust = Math.max(0, p.gust - dt * 0.5);
    const targetLife = s.outcome === "none" ? 0 : s.outcome === "quench" ? 0 : s.outcome === "blowoff" ? 0 : 1;
    p.life = lerp(p.life, targetLife, s.outcome === "quench" ? dt * 1.1 : s.outcome === "blowoff" ? dt * 0.8 : k);
    if (s.outcome === "blowoff") p.lift = Math.min(1, p.lift + dt * 0.45);

    // views
    this.duct.visible = s.view === "duct";
    this.bench.visible = s.view === "bench";
    this.flameGroup.visible = s.view !== "cloud";
    this.cloudGroup.visible = s.view === "cloud";
    if (this.fadeIn < 1) {
      this.fadeIn = Math.min(1, this.fadeIn + dt * 2.5);
      this.canvas.style.opacity = String(this.fadeIn); // CSSOM, allowed by the strict CSP
    }

    // spawn
    const rate = (s.view === "cloud" ? 0 : this.gentle ? 450 : 900) * p.life * (s.outcome === "dim" ? 0.35 : 1) * (0.45 + p.grav * 0.55) * (1 + p.gust * 1.5);
    let n = rate * dt;
    while (n > 0 && (n >= 1 || Math.random() < n)) {
      this.spawn(this.next, s);
      this.next = (this.next + 1) % N;
      n -= 1;
    }
    // integrate + colour
    const hot = new THREE.Color(0xfff1c4), mid = new THREE.Color(0xf0a044), red = new THREE.Color(0x8a2a12), blue = new THREE.Color(0x5b8cff), core = new THREE.Color(0xbfd2ff);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      if (this.age[i] >= this.life[i]) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // earth: plume narrows as it rises
      this.pos[i * 3 + 2] *= 1 - dt * 1.2 * p.grav;
      // flame colour: hot core -> amber -> dark red; orbit and near-limit flames shift to blue
      // under gravity the plume stays bright for longer so the tall teardrop reads clearly
      const split = 0.3 + 0.3 * p.grav;
      if (t < split) c.copy(hot).lerp(mid, t / split);
      else c.copy(mid).lerp(red, (t - split) / (1 - split));
      const b = p.blue * (1 - p.gust * 0.8);
      if (b > 0) c.lerp(t < 0.4 ? core : blue, b);
      const a = Math.sin(Math.PI * Math.min(1, t * 1.1)) * (0.35 + 0.25 * (1 - b)) * (0.4 + 0.6 * p.life) * p.seek * (1 + p.flash);
      this.col.set([c.r, c.g, c.b, a], i * 4);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;

    const fx = this.sample.position.x - 1.2 + p.lift * 3.5;
    this.glow.position.set(fx, -0.1 + p.grav * 0.5, 0.55);
    (this.glow.material as THREE.SpriteMaterial).color.set(0xf0a044).lerp(new THREE.Color(0x5b8cff), p.blue);
    (this.glow.material as THREE.SpriteMaterial).opacity = ((0.2 + 0.08 * p.grav) * p.life * (1 + p.gust) + p.flash * 0.7) * p.seek;
    this.glow.scale.setScalar(1.6 + p.flash * 3);
    this.light.position.copy(this.glow.position);
    this.light.intensity = ((2 + 3 * p.grav) * p.life * (1 + p.gust) + p.flash * 30) * p.seek;
    this.seekRing.position.set(fx, -0.3, 0.55);
    (this.seekRing.material as THREE.SpriteMaterial).opacity = s.seek === "found" ? 0.55 + 0.35 * Math.sin(this.time * 3) * (this.gentle ? 0 : 1) : 0;
    this.light.color.copy((this.glow.material as THREE.SpriteMaterial).color);
    this.ghost.visible = !!s.unknown && s.view === "duct";
    if (this.ghost.visible) {
      this.ghost.position.set(this.sample.position.x - 1.2, this.sample.position.y + 0.05, 0.4);
      this.ghost.rotation.y += dt * (this.gentle || this.reduced ? 0 : 0.35);
      ((this.ghost.children[0] as THREE.LineSegments).material as THREE.LineDashedMaterial).opacity = 0.4 + 0.2 * Math.sin(this.time * 2.2) * (this.gentle ? 0 : 1);
    }

    // airflow streaks
    const sp = p.flow * 0.12 * p.fanDir;
    (this.streaks.material as THREE.LineBasicMaterial).opacity = Math.min(0.5, p.flow / 12) * (s.view === "duct" ? 1 : 0);
    for (let i = 0; i < 160; i++) {
      let x = this.streakPos[i * 6] + sp * dt * 8;
      if (x > 3.9) x = -3.9;
      if (x < -3.9) x = 3.9;
      this.streakPos[i * 6] = x;
      this.streakPos[i * 6 + 3] = x + 0.12 + sp * 0.08;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;

    // camera framing: fit the active object in the visible area. Wide screens with a side panel
    // push it right; portrait phones lift it above the bottom task sheet.
    const aspect = this.camera.aspect;
    const wide = this.panelLeft && aspect > 1.3;
    const portrait = aspect < 0.9;
    const half = s.view === "bench" ? { w: 2.2, h: 2.0 } : s.view === "cloud" ? { w: 4.8, h: 3.4 } : s.zoom === "flame" ? { w: 2.3, h: 1.35 } : s.focus ? { w: 3.7, h: 1.9 } : { w: 7.3, h: 4.1 };
    const visAspect = portrait && s.view === "bench" ? Math.max(aspect, 0.55) : portrait && s.view === "duct" ? Math.max(aspect, 0.36) : wide ? aspect * 0.62 : aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const want = Math.max(half.h / tan, half.w / (tan * visAspect)) * (portrait ? 1.08 : 1.15);
    const shiftX = portrait && s.view === "bench" ? -0.9 : wide ? -(want * tan * aspect) * 0.34 : 0;
    const liftY = portrait && this.panelLeft ? -want * tan * 0.42 : 0;
    const baseY = s.view === "cloud" ? (s.voidRegion ? 1.2 : 0.2) : s.view === "bench" ? 0.6 : s.focus ? -0.3 : 0.1;
    const camTarget = s.zoom === "flame" ? new THREE.Vector3(this.sample.position.x - 0.7, -0.15, 0.2) : new THREE.Vector3(shiftX + (s.focus ? 0.3 : 0), baseY + liftY, 0);
    const kc = this.snap ? 1 : k;
    this.controls.target.lerp(camTarget, kc);
    if (this.panelLeft || this.fit) {
      const off = this.camera.position.clone().sub(this.controls.target);
      if (this.recentering > 0) {
        off.lerp(new THREE.Vector3(0.45, 0.24, 0.86).multiplyScalar(off.length()), Math.min(1, dt * 4));
        this.recentering = Math.max(0, this.recentering - dt * 0.8);
      }
      off.setLength(lerp(off.length(), want, kc));
      this.camera.position.copy(this.controls.target).add(off);
    }
    this.snap = false;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.step(this.reduced ? dt * 0.5 : dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // pixels per world unit at distance 1: particle size stays physical under perspective
    const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    (((this.flameGroup.children[1] as THREE.Points).material as THREE.ShaderMaterial).uniforms.uScale.value) = scale;
  }

  setRunning(on: boolean) {
    this.running = on;
    if (on) this.clock.getDelta();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
