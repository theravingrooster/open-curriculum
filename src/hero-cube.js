// Home page background: a cream octahedron, centred on the page, that turns as the page scrolls.
// Bundled to assets/js/hero-cube.js with `npm run bundle:hero`. Loaded by pages/index.html
// after the page's load event, and only on wide screens.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, MeshStandardMaterial, OctahedronGeometry,
  DirectionalLight, HemisphereLight, NoToneMapping, SRGBColorSpace, Vector3,
} from 'three';

const DIAMOND_HALF_HEIGHT = 1.1;
const DIAMOND_ASPECT = 1.4;         // height / width
const START_ANGLE = Math.PI / 4;    // a vertex facing the camera
const CAMERA_AZIMUTH = 42 * Math.PI / 180;
const CAMERA_ELEVATION = 19 * Math.PI / 180; // slightly above
const CAMERA_DISTANCE = 5.2;

export function createHeroScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); // transparent: the page background shows through
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();

  // Diamond: elongated octahedron, matte cream, flat-shaded so each face reads as its own shade.
  const diamond = new Mesh(
    new OctahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0xe6ddcf, roughness: 0.9, metalness: 0, flatShading: true }),
  );
  diamond.scale.set(DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT, DIAMOND_HALF_HEIGHT, DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT);
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
  // counterclockwise seen from above (front face moving left to right), one full turn from the
  // top of the page to the bottom; scrolling back up turns it back. Frames are drawn only while
  // it is catching up with the scroll position, so an idle page costs nothing.
  const SMOOTHING = 0.16; // share of the remaining angle closed per 60 Hz frame
  const scrollAngle = () => {
    const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const y = Math.min(Math.max(window.scrollY, 0), range);
    return START_ANGLE + (y / range) * 2 * Math.PI;
  };

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
