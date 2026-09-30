// Home page background: a still glass cube with a cream octahedron turning inside it.
// Bundled to assets/js/hero-cube.js with `npm run bundle:hero`. Loaded by pages/index.html
// after the page's load event, and only on wide screens.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Group, MeshPhysicalMaterial, MeshStandardMaterial,
  OctahedronGeometry, CylinderGeometry, MeshBasicMaterial,
  DirectionalLight, HemisphereLight, PMREMGenerator, NoToneMapping, SRGBColorSpace,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TURN_SECONDS = 24;            // one full turn, constant speed
const CUBE = 1.85;                  // block width and depth (world units)
const CUBE_HEIGHT = 2.25;           // the reference block reads taller than wide
const DIAMOND_HALF_HEIGHT = 1.07;   // apexes nearly touch the top and bottom faces
const DIAMOND_ASPECT = 1.55;        // height / width; the reference measures about 1.55 on screen
const START_ANGLE = Math.PI / 4;    // a vertex facing the cube's front corner, as in the reference
const CAMERA_AZIMUTH = 42 * Math.PI / 180;   // near corner-on, slightly toward the left face
const CAMERA_ELEVATION = 19 * Math.PI / 180; // slightly above
const CAMERA_DISTANCE = 5.2;        // close enough for the reference's perspective

export function createHeroScene(canvas) {
  // Opaque black, composited onto the page with mix-blend-mode: screen (see styles.css), which
  // leaves the page untouched wherever the canvas is black. A transparent canvas would make
  // three.js clear its transmission buffer to 50% white, turning the glass grey.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  // Nothing opaque sits behind the glass (the diamond is drawn after it, see below), so the
  // transmission buffer only ever holds black. A small buffer gives the same pixels far cheaper.
  renderer.transmissionResolutionScale = 0.125;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  // The environment map is for the glass only; the diamond is lit by the lights alone.
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // Glass cube: clear, nearly invisible faces; bevelled edges catch the environment.
  const glass = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, ior: 1.5, thickness: 0.1,
    specularIntensity: 1, envMap, envMapIntensity: 0.35, depthWrite: false,
  });
  const cube = new Group();
  cube.add(new Mesh(new RoundedBoxGeometry(CUBE, CUBE_HEIGHT, CUBE, 4, 0.05), glass));
  scene.add(cube);

  // Diamond: elongated octahedron, matte cream, flat-shaded so each face reads as its own shade.
  const diamond = new Mesh(
    new OctahedronGeometry(1, 0),
    // Drawn after the glass (transparent pass, fully opaque) so it stays sharp instead of being
    // resampled through the glass's lower-resolution transmission buffer.
    new MeshStandardMaterial({ color: 0xe6ddcf, roughness: 0.9, metalness: 0, flatShading: true, transparent: true, opacity: 1 }),
  );
  diamond.renderOrder = 1;
  diamond.scale.set(DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT, DIAMOND_HALF_HEIGHT, DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT);
  diamond.rotation.y = START_ANGLE;
  scene.add(diamond);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const viewDir = new Vector3(
    Math.sin(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
    Math.sin(CAMERA_ELEVATION),
    Math.cos(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
  );

  // Edges: thin bright rods, doubled just inside the surface the way thick glass shows its edges.
  // The camera never moves, so edges on the far side of the block are dimmed once, here.
  const rod = new CylinderGeometry(1, 1, 1, 6, 1);
  const w = CUBE / 2, hh = CUBE_HEIGHT / 2;
  const corners = [];
  for (const x of [-w, w]) for (const y of [-hh, hh]) for (const z of [-w, w]) corners.push(new Vector3(x, y, z));
  const edgeMaterials = new Map();
  const edgeMaterial = (opacity) => {
    const k = opacity.toFixed(2);
    if (!edgeMaterials.has(k)) edgeMaterials.set(k, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false }));
    return edgeMaterials.get(k);
  };
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const a = corners[i], b = corners[j];
      const diff = [a.x !== b.x, a.y !== b.y, a.z !== b.z].filter(Boolean).length;
      if (diff !== 1) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const far = mid.dot(viewDir) < -0.01;         // behind the block's centre, seen through glass
      const bottom = mid.y < -hh + 0.01;            // bottom edges catch the most light in the reference
      const base = (bottom ? 0.8 : 0.6) * (far ? 0.4 : 1);
      for (const [inset, radius, opacity] of [[0, 0.0075, base], [0.035, 0.005, base * 0.45]]) {
        const pa = a.clone().multiplyScalar(1 - inset / Math.max(w, hh)), pb = b.clone().multiplyScalar(1 - inset / Math.max(w, hh));
        const m = new Mesh(rod, edgeMaterial(opacity));
        m.position.copy(pa).add(pb).multiplyScalar(0.5);
        m.scale.set(radius, pa.distanceTo(pb), radius);
        m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
        m.renderOrder = 2; // after the diamond, depth-tested against it
        cube.add(m);
      }
    }
  }

  // Key light from the upper left of the camera, soft fill from the right and below.
  const right = new Vector3(Math.cos(CAMERA_AZIMUTH), 0, -Math.sin(CAMERA_AZIMUTH));
  const key = new DirectionalLight(0xffffff, 3.6);
  key.position.copy(right.clone().multiplyScalar(-6)).add(new Vector3(0, -0.2, 0)).addScaledVector(viewDir, 0.8);
  scene.add(key);
  const fill = new DirectionalLight(0xffe2c4, 1.25);
  fill.position.copy(right.clone().multiplyScalar(4)).add(new Vector3(0, -1, 0)).addScaledVector(viewDir, 3);
  scene.add(fill);
  scene.add(new HemisphereLight(0xffffff, 0xcfc8bc, 1.1));

  // heightFraction: share of the viewport height the object fills.
  // centerX / centerY: where the object's centre sits, as a share of the viewport.
  function layout(width, height, { heightFraction = 0.7, centerX = 0.5, centerY = 0.5 } = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const projected = 3.45; // approx. screen height of the cube incl. its top face, in world units
    camera.fov = (2 * Math.atan(projected / (2 * heightFraction * CAMERA_DISTANCE)) * 180) / Math.PI;
    camera.position.copy(viewDir).multiplyScalar(CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, -(centerX - 0.5) * width, -(centerY - 0.5) * height, width, height);
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    layout,
    parts: { cube, diamond, key, fill },
    setAngle(a) { diamond.rotation.y = a; },
    get angle() { return diamond.rotation.y; },
    render() { renderer.render(scene, camera); },
  };
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch (e) { return false; }
}

function start() {
  const container = document.querySelector('.hero-art');
  if (!container) return;
  const canvas = container.querySelector('canvas');
  const useStatic = () => container.classList.add('hero-art--static');
  if (!canvas || !webglAvailable()) return useStatic();

  let hero;
  try { hero = createHeroScene(canvas); } catch (e) { return useStatic(); }

  const params = new URLSearchParams(location.search);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const size = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wide = w >= 1100;
    hero.layout(w, h, { heightFraction: wide ? 0.64 : 0.52, centerX: wide ? 0.76 : 0.74, centerY: 0.55 });
  };
  size();
  hero.render();
  container.classList.add('hero-art--ready');

  // Export hook for scripts/hero-media.mjs (renders a square still for assets/hero-static.webp).
  if (params.has('hero-export')) {
    window.__heroExport = (px, angle, heightFraction = 0.9, glass = true) => {
      hero.parts.cube.visible = glass;
      hero.renderer.setPixelRatio(1);
      hero.layout(px, px, { heightFraction });
      hero.setAngle(angle);
      hero.render();
      return canvas.toDataURL('image/png');
    };
  }

  let raf = 0;
  let last = null;
  let running = false;
  let onScreen = true;
  const step = (now) => {
    if (!running) return;
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    hero.setAngle(hero.angle + (dt * 2 * Math.PI) / TURN_SECONDS); // counterclockwise from above
    hero.render();
    raf = requestAnimationFrame(step);
  };
  const play = () => {
    if (running || reduceMotion.matches || document.hidden || !onScreen) return;
    running = true;
    last = null;
    raf = requestAnimationFrame(step);
  };
  const pause = () => { running = false; cancelAnimationFrame(raf); };

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { pause(); hero.render(); } else play(); });
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; onScreen ? play() : pause(); }).observe(canvas);
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; size(); hero.render(); });
  });
  // Fade the object as the page scrolls past the hero, so text further down stays easy to read.
  let fadeQueued = false;
  const fade = () => {
    fadeQueued = false;
    const t = Math.min(window.scrollY / (window.innerHeight * 0.5), 1);
    container.style.setProperty('--hero-scroll-fade', String(1 - 0.78 * t));
  };
  window.addEventListener('scroll', () => { if (!fadeQueued) { fadeQueued = true; requestAnimationFrame(fade); } }, { passive: true });
  fade();

  play();
}

start();
