// Home page background: a cream octahedron, centred on the page, that turns as the page scrolls.
// Bundled to assets/js/hero-cube.js with `npm run bundle:hero`. Loaded by pages/index.html
// after the page's load event, and only on wide screens.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, MeshStandardMaterial, BufferGeometry, Float32BufferAttribute,
  DirectionalLight, HemisphereLight, NoToneMapping, SRGBColorSpace, Vector3,
} from 'three';

const DIAMOND_HALF_HEIGHT = 1.1;
const DIAMOND_ASPECT = 1.4;         // height / width
const EDGE_RADIUS = 0.04;          // radius of the rounded edges and tips (0 = knife-sharp)
const START_ANGLE = Math.PI / 4;    // a vertex facing the camera
const CAMERA_AZIMUTH = 42 * Math.PI / 180;
const CAMERA_ELEVATION = 19 * Math.PI / 180; // slightly above
const CAMERA_DISTANCE = 5.2;

// An elongated octahedron with softened edges: flat faces joined by narrow rounded bevels.
// Built as the octahedron shrunk inward by `radius`, then grown back by a sphere of that radius
// (a Minkowski sum), so each face stays perfectly flat and keeps its own shade while the light
// rolls over each edge and tip instead of breaking on a hard line. Normals are exact.
function softOctahedron(halfWidth, halfHeight, radius, segments = 8) {
  const V = (x, y, z) => new Vector3(x, y, z);
  const faces = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const n = V(sx / halfWidth, sy / halfHeight, sz / halfWidth).normalize();
    faces.push({ n, verts: [V(sx * halfWidth, 0, 0), V(0, sy * halfHeight, 0), V(0, 0, sz * halfWidth)] });
  }
  // Every face plane is the same distance d from the centre, so shrinking inward by `radius`
  // is a uniform scale about the centre.
  const d = faces[0].verts[0].dot(faces[0].n);
  const k = (d - radius) / d;
  const inner = (v) => v.clone().multiplyScalar(k);

  const pos = [];
  const nor = [];
  // Push a triangle given as [point, normal] pairs, wound to face outward.
  const tri = (a, b, c) => {
    const e1 = b[0].clone().sub(a[0]);
    const e2 = c[0].clone().sub(a[0]);
    const out = a[1].clone().add(b[1]).add(c[1]);
    if (e1.cross(e2).dot(out) < 0) [b, c] = [c, b];
    for (const [p, n] of [a, b, c]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
  };
  const at = (base, n) => [base.clone().addScaledVector(n, radius), n];
  const slerp = (a, b, t) => {
    const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
    if (ang < 1e-6) return a.clone();
    return a.clone().multiplyScalar(Math.sin((1 - t) * ang)).addScaledVector(b, Math.sin(t * ang)).divideScalar(Math.sin(ang));
  };

  // Flat faces.
  for (const f of faces) tri(...f.verts.map((v) => at(inner(v), f.n)));

  // Rounded edges: each edge shared by two faces becomes a strip of cylinder.
  const key = (v) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  const edges = new Map();
  for (const f of faces) {
    for (let e = 0; e < 3; e++) {
      const a = f.verts[e], b = f.verts[(e + 1) % 3];
      const id = [key(a), key(b)].sort().join('|');
      if (!edges.has(id)) edges.set(id, { a, b, normals: [] });
      edges.get(id).normals.push(f.n);
    }
  }
  for (const { a, b, normals: [n1, n2] } of edges.values()) {
    const ia = inner(a), ib = inner(b);
    for (let s = 0; s < segments; s++) {
      const na = slerp(n1, n2, s / segments), nb = slerp(n1, n2, (s + 1) / segments);
      tri(at(ia, na), at(ib, na), at(ib, nb));
      tri(at(ia, na), at(ib, nb), at(ia, nb));
    }
  }

  // Rounded tips: at each vertex, a spherical patch spanning the normals of the faces that meet there.
  const tips = new Map();
  for (const f of faces) for (const v of f.verts) {
    if (!tips.has(key(v))) tips.set(key(v), { v, normals: [] });
    tips.get(key(v)).normals.push(f.n);
  }
  for (const { v, normals } of tips.values()) {
    const iv = inner(v);
    const axis = v.clone().normalize();
    const centre = normals.reduce((acc, n) => acc.add(n), V(0, 0, 0)).normalize();
    // Order the face normals around the vertex axis.
    const ref = normals[0].clone().projectOnPlane(axis).normalize();
    const angle = (n) => {
      const q = n.clone().projectOnPlane(axis).normalize();
      return Math.atan2(ref.clone().cross(q).dot(axis), ref.dot(q));
    };
    const ring = [...normals].sort((p, q) => angle(p) - angle(q));
    for (let r = 0; r < ring.length; r++) {
      const n1 = ring[r], n2 = ring[(r + 1) % ring.length];
      // Fan from the centre normal to the arc between neighbouring face normals, subdivided.
      for (let s = 0; s < segments; s++) {
        const e1 = slerp(n1, n2, s / segments), e2 = slerp(n1, n2, (s + 1) / segments);
        for (let t = 0; t < segments; t++) {
          const a1 = slerp(centre, e1, t / segments), a2 = slerp(centre, e1, (t + 1) / segments);
          const b1 = slerp(centre, e2, t / segments), b2 = slerp(centre, e2, (t + 1) / segments);
          tri(at(iv, a1), at(iv, a2), at(iv, b2));
          if (t > 0) tri(at(iv, a1), at(iv, b2), at(iv, b1));
        }
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return geo;
}

export function createHeroScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); // transparent: the page background shows through
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();

  // Diamond: elongated octahedron with softened edges, matte cream.
  const diamond = new Mesh(
    softOctahedron(DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT, DIAMOND_HALF_HEIGHT, EDGE_RADIUS),
    new MeshStandardMaterial({ color: 0xe6ddcf, roughness: 0.9, metalness: 0 }),
  );
  diamond.rotation.y = START_ANGLE;
  scene.add(diamond);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const viewDir = new Vector3(
    Math.sin(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
    Math.sin(CAMERA_ELEVATION),
    Math.cos(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
  );

  // Light from the upper right of the page. The lights are fixed relative to the camera, so as
  // the diamond turns, each face brightens as it swings toward the upper right and falls into
  // shadow on the lower left. A weak cool fill from the lower left keeps the shadow side from
  // going black, so the edges between shadowed faces still read.
  const right = new Vector3(Math.cos(CAMERA_AZIMUTH), 0, -Math.sin(CAMERA_AZIMUTH));
  const up = new Vector3().crossVectors(right, viewDir).normalize().negate();
  const key = new DirectionalLight(0xfff4e6, 3.9);
  key.position.copy(right).multiplyScalar(4).addScaledVector(up, 4.5).addScaledVector(viewDir, 2.2);
  scene.add(key);
  const fill = new DirectionalLight(0xdfe6f0, 0.45);
  fill.position.copy(right).multiplyScalar(-4).addScaledVector(up, -2).addScaledVector(viewDir, 2);
  scene.add(fill);
  scene.add(new HemisphereLight(0xffffff, 0x3a342c, 0.55));

  // heightFraction: share of the viewport height the diamond fills.
  // centerX / centerY: where its centre sits, as a share of the viewport.
  function layout(width, height, { heightFraction = 0.7, centerX = 0.5, centerY = 0.5 } = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const projected = 2.3; // approx. screen height of the diamond, in world units
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
    hero.layout(w, h, { heightFraction: wide ? 0.62 : 0.52, centerX: 0.5, centerY: 0.55 });
  };
  size();
  hero.render();
  container.classList.add('hero-art--ready');

  // Export hook for scripts/hero-media.mjs (renders a square still for assets/hero-static.webp).
  if (params.has('hero-export')) {
    window.__heroExport = (px, angle, heightFraction = 0.9) => {
      hero.renderer.setPixelRatio(1);
      hero.layout(px, px, { heightFraction });
      hero.setAngle(angle);
      hero.render();
      return canvas.toDataURL('image/png');
    };
  }

  // The diamond turns with the page instead of on its own: scrolling down turns it
  // counterclockwise seen from above (front face moving left to right), one full turn per
  // 1200px scrolled; scrolling back up turns it back. Frames are drawn only while
  // it is catching up with the scroll position, so an idle page costs nothing.
  const SMOOTHING = 0.16; // share of the remaining angle closed per 60 Hz frame
  const PX_PER_TURN = 1200; // scroll distance for one full turn, the same on every page length
  const scrollAngle = () => START_ANGLE + (Math.max(window.scrollY, 0) / PX_PER_TURN) * 2 * Math.PI;

  let raf = 0;
  let last = null;
  let running = false;
  let onScreen = true;
  // Frame-time guard: if 60 consecutive-frame samples average slower than ~25 fps, the GPU can't
  // keep this smooth, so stop and show the still image instead. ?hero=live disables the guard.
  const guard = !params.has('hero') && !params.has('hero-export');
  let sampled = 0;
  let sampledTime = 0;
  const step = (now) => {
    raf = 0;
    if (!running) return;
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    if (guard && dt > 0 && sampled < 60) {
      sampled++;
      sampledTime += dt;
      if (sampled === 60 && sampledTime / 60 > 0.04) {
        running = false;
        container.classList.remove('hero-art--ready');
        container.classList.add('hero-art--static');
        return;
      }
    }
    const target = scrollAngle();
    const diff = target - hero.angle;
    const settled = Math.abs(diff) < 0.0005;
    const k = 1 - Math.pow(1 - SMOOTHING, dt > 0 ? dt * 60 : 1);
    hero.setAngle(settled ? target : hero.angle + diff * k);
    hero.render();
    if (settled) { running = false; last = null; } else raf = requestAnimationFrame(step);
  };
  // Under prefers-reduced-motion the diamond stays still at its starting angle.
  const follow = () => {
    if (running || reduceMotion.matches || document.hidden || !onScreen) return;
    running = true;
    last = null;
    raf = requestAnimationFrame(step);
  };
  const stop = () => { running = false; last = null; cancelAnimationFrame(raf); };

  if (!reduceMotion.matches) { hero.setAngle(scrollAngle()); hero.render(); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : follow()));
  reduceMotion.addEventListener('change', () => {
    stop();
    hero.setAngle(reduceMotion.matches ? START_ANGLE : scrollAngle());
    hero.render();
  });
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; onScreen ? follow() : stop(); }).observe(canvas);
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; size(); hero.render(); follow(); });
  });

  // Fade the object partly as the page scrolls past the hero, so text further down stays readable.
  let scrollQueued = false;
  const onScroll = () => {
    scrollQueued = false;
    const t = Math.min(window.scrollY / (window.innerHeight * 0.5), 1);
    container.style.setProperty('--hero-scroll-fade', String(1 - 0.45 * t));
    follow();
  };
  window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
}
start();
