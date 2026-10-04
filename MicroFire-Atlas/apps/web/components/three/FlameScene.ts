/**
 * MicroFire Atlas 3D scene (plain three.js, client only).
 *
 * The flame is an ILLUSTRATION driven by a test's recorded conditions and outcome, not a
 * combustion simulation: its colour, size and behaviour encode what NASA wrote down
 * (kept burning, quenched as flow fell, blew off, never ignited).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type Outcome = "burning" | "quench" | "blowoff" | "dim" | "none";

export type CloudPoint = { id: string; label: string; x: number; y: number; z: number; color: string; hollow?: boolean };

export type SceneState = {
  view: "bench" | "duct" | "cloud";
  gravity: "earth" | "orbit";
  /** Oxygen, vol %: drives flame brightness. */
  o2: number;
  /** Airflow, cm/s: drives drift and streak speed. */
  flow: number;
  outcome: Outcome;
  material?: "PMMA" | "fabric";
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
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
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
  private recentering = 0;
  private snap = true; // jump the camera straight to its framing on the first frame and on view cuts

  constructor(private canvas: HTMLCanvasElement, initial: SceneState, opts: { compact?: boolean; panelLeft?: boolean } = {}) {
    this.panelLeft = !!opts.panelLeft;
    this.state = initial;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2)); // phones: fewer pixels, smoother frames
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    if (opts.compact) this.camera.position.set(3.4, 1.7, 5.6);
    else this.camera.position.set(5.5, 2.6, 8.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.autoRotate = false; // no constant orbit: the camera only moves to frame a new task
    this.controls.target.set(0, 0.2, 0);

    this.scene.add(new THREE.AmbientLight(0x8fa3c8, 0.85));
    const key = new THREE.DirectionalLight(0xbfd2ff, 1.1);
    key.position.set(4, 6, 5);
    this.scene.add(key);

    this.buildDuct();
    this.buildRig();
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
  }

  /* ---------------- construction ---------------- */

  private buildDuct() {
    // BASS flow duct: square cross-section, roughly 2.2× longer than wide (7.6 cm × 17 cm test section).
    const box = new THREE.BoxGeometry(8, 3.6, 3.6);
    const glass = new THREE.Mesh(box, new THREE.MeshPhysicalMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.06, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x56d4e4, transparent: true, opacity: 0.82 }));
    const ductPart = this.part("duct");
    ductPart.add(glass, edges);
    // flow straightener at the inlet
    const grid = new THREE.Group();
    for (let i = -3; i <= 3; i++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.4, 0.02), new THREE.MeshBasicMaterial({ color: 0x2c3a58 }));
      v.position.set(-4, 0, i * 0.5);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 3.4), new THREE.MeshBasicMaterial({ color: 0x2c3a58 }));
      h.position.set(-4, i * 0.5, 0);
      grid.add(v, h);
    }
    this.part("straightener").add(grid);
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
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a4766, metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2438, metalness: 0.4, roughness: 0.6 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0b0f1a, metalness: 0.9, roughness: 0.15, emissive: 0x112244 });

    // variable-speed fan at the inlet
    const fan = this.part("fan");
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.55, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c3a58, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    housing.rotation.z = Math.PI / 2;
    housing.position.x = -4.7;
    fan.add(housing);
    for (let k = 0; k < 5; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, 0.32), metal);
      blade.position.y = 0.62;
      const arm = new THREE.Group();
      arm.rotation.x = (k / 5) * Math.PI * 2;
      blade.rotation.y = 0.5;
      arm.add(blade);
      this.fanBlades.add(arm);
    }
    this.fanBlades.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), metal));
    this.fanBlades.position.x = -4.7;
    fan.add(this.fanBlades);

    // sample holder frame (BASS sample holders carry a built-in igniter)
    const holder = this.part("holder");
    const bar = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), metal);
      m.position.set(x, -0.62, z);
      holder.add(m);
    };
    bar(5.6, 0.12, 0.3, 0.68);
    bar(5.6, 0.12, 0.3, -0.68);
    bar(0.12, 1.48, -2.5, 0);
    bar(0.12, 1.48, 3.1, 0);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), dark);
    rail.position.set(0.3, 0.05, -0.68);
    holder.add(rail);

    // Kanthal hot-wire igniter coil at the leading edge
    const igniter = this.part("igniter");
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.01) pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 12) * 0.09, Math.sin(t * Math.PI * 12) * 0.09, (t - 0.5) * 1.0));
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.018, 6), this.coilMat);
    coil.position.set(-0.95, -0.5, 0);
    igniter.add(coil);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), dark);
    lever.position.set(-0.95, -0.5, 1.2);
    igniter.add(lever);

    // Nikon still camera at the top window
    const still = this.part("still");
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), dark);
    body.position.set(0.3, 2.45, 0);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 24), lensMat);
    lens.position.set(0.3, 2.0, 0);
    still.add(body, lens);

    // Panasonic video camera at the front window
    const video = this.part("video");
    const vbody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), dark);
    vbody.position.set(0.3, -0.2, 2.65);
    const vlens = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.4, 24), lensMat);
    vlens.rotation.x = Math.PI / 2;
    vlens.position.set(0.3, -0.2, 2.15);
    video.add(vbody, vlens);

    // thermopile radiometer, downstream top back corner, looking upstream
    const rad = this.part("radiometer");
    const rbody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20), metal);
    rbody.rotation.z = Math.PI / 2;
    rbody.position.set(3.55, 1.45, -1.45);
    rad.add(rbody);

    // nozzle for N2 flow (oxygen control)
    const nozzle = this.part("nozzle");
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x8fb0ff, metalness: 0.5, roughness: 0.3 }));
    tube.rotation.z = Math.PI / 2;
    tube.position.set(-3.1, -1.45, 1.1);
    nozzle.add(tube);

    // perforated copper plate at the exit
    const exit = this.part("exit");
    const holes = document.createElement("canvas");
    holes.width = holes.height = 128;
    const hc = holes.getContext("2d")!;
    hc.fillStyle = "#fff";
    hc.fillRect(0, 0, 128, 128);
    hc.fillStyle = "#000";
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      hc.beginPath();
      hc.arc(8 + i * 16, 8 + j * 16, 4.5, 0, Math.PI * 2);
      hc.fill();
    }
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35, alphaMap: new THREE.CanvasTexture(holes), transparent: true, side: THREE.DoubleSide }),
    );
    plate.rotation.y = Math.PI / 2;
    plate.position.x = 4.02;
    exit.add(plate);
  }

  /** The ISS glovebox around the duct: a clear work volume with two glove ports (illustration). */
  private buildGlovebox() {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(13.5, 7.4, 6.6);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x2c3a58, transparent: true, opacity: 0.7 })));
    const floor = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.18, 6.6), new THREE.MeshStandardMaterial({ color: 0x263956, metalness: 0.3, roughness: 0.8 }));
    floor.position.y = -3.7;
    g.add(floor);
    const grid = new THREE.GridHelper(13, 13, 0x3c91a8, 0x24445f);
    grid.position.y = -3.59;
    g.add(grid);
    for (const x of [-3.2, 3.2]) {
      const port = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 12, 40), new THREE.MeshStandardMaterial({ color: 0x577b9a, emissive: 0x0a2232, metalness: 0.6, roughness: 0.4 }));
      port.position.set(x, -1.2, 3.3);
      g.add(port);
    }
    // feet that hold the duct off the floor
    for (const x of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x2c3a58, metalness: 0.5, roughness: 0.5 }));
      leg.position.set(x, -2.7, 0);
      g.add(leg);
    }
    g.position.y = 0.05;
    this.duct.add(g);
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
    this.seekRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 }));
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
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0x121b30, roughness: 0.9 }));
    plate.position.y = -0.9;
    this.bench.add(plate);
  }

  private buildFlame() {
    this.sample = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 1.1), new THREE.MeshStandardMaterial({ color: 0xc9d1e3, roughness: 0.5, transparent: true, opacity: 0.85 }));
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
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), color: 0xf0a044, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
    this.glow.scale.set(1.6, 1.6, 1);
    this.flameGroup.add(this.glow);
    this.coilGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow.material.map, color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.coilGlow.position.set(-0.95, -0.5, 0);
    this.coilGlow.scale.set(1, 1, 1);
    this.duct.add(this.coilGlow);
    this.light = new THREE.PointLight(0xf0a044, 4, 8, 1.6);
    this.flameGroup.add(this.light);
    for (let i = 0; i < N; i++) this.age[i] = this.life[i] = 1;
  }

  private buildStreaks() {
    const g = new THREE.BufferGeometry();
    for (let i = 0; i < 160; i++) {
      const y = rand(-1.6, 1.6), z = rand(-1.6, 1.6), x = rand(-3.9, 3.9);
      this.streakPos.set([x, y, z, x + 0.3, y, z], i * 6);
    }
    g.setAttribute("position", new THREE.BufferAttribute(this.streakPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x56d4e4, transparent: true, opacity: 0.35 }));
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
    (this.sample.material as THREE.MeshStandardMaterial).color.set(s.material === "fabric" ? 0xb9a98c : 0xc9d1e3);
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
      this.p.grav = s.gravity === "earth" ? 1 : 0;
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
    p.grav = lerp(p.grav, s.gravity === "earth" ? 1 : 0, k);
    p.o2 = lerp(p.o2, s.o2, k);
    p.flow = lerp(p.flow, s.flow, k);
    p.cloud = lerp(p.cloud, s.view === "cloud" ? 1 : 0, k);
    p.blue = lerp(p.blue, s.outcome === "dim" || s.outcome === "quench" ? 1 : s.gravity === "orbit" ? 0.55 : 0, k * 0.6);
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
    const half = s.view === "bench" ? { w: 2.2, h: 2.0 } : s.view === "cloud" ? { w: 4.8, h: 3.4 } : s.focus ? { w: 3.7, h: 1.9 } : { w: 7.3, h: 4.1 };
    const visAspect = portrait && s.view === "bench" ? Math.max(aspect, 0.55) : portrait && s.view === "duct" ? Math.max(aspect, 0.36) : wide ? aspect * 0.62 : aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const want = Math.max(half.h / tan, half.w / (tan * visAspect)) * (portrait ? 1.08 : 1.15);
    const shiftX = portrait && s.view === "bench" ? -0.9 : wide ? -(want * tan * aspect) * 0.34 : 0;
    const liftY = portrait && this.panelLeft ? -want * tan * 0.42 : 0;
    const baseY = s.view === "cloud" ? (s.voidRegion ? 1.2 : 0.2) : s.view === "bench" ? 0.6 : s.focus ? -0.3 : 0.1;
    const camTarget = new THREE.Vector3(shiftX + (s.focus ? 0.3 : 0), baseY + liftY, 0);
    const kc = this.snap ? 1 : k;
    this.controls.target.lerp(camTarget, kc);
    if (this.panelLeft) {
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
