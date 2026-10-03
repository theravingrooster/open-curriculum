// Home page background: a cream octahedron, centred on the page, that turns as the page scrolls
// and breaks apart into fragments as you scroll down (and reassembles as you scroll back up).
// Thin grey strings join each fragment to its nearest neighbours, like a network of nodes; they
// stretch as the pieces drift apart and shorten again as they come back together.
// Bundled to assets/js/hero-cube.js with `npm run bundle:hero`. Loaded by pages/index.html
// after the page's load event, and only on wide screens.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Group, MeshPhysicalMaterial, PMREMGenerator, BufferGeometry, Float32BufferAttribute,
  DirectionalLight, HemisphereLight, NoToneMapping, SRGBColorSpace, Vector3, PlaneGeometry, MeshBasicMaterial, Color,
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const DIAMOND_HALF_HEIGHT = 1.1;
const DIAMOND_ASPECT = 1.4;         // height / width
const EDGE_RADIUS = 0.04;          // radius of the rounded edges and tips (0 = knife-sharp)
const FRAGMENTS = 56;             // number of pieces the diamond breaks into
const FRAGMENT_SEED = 7;           // fixed, so the pieces are the same on every visit
const STRING_NEIGHBOURS = 3;       // each piece is strung to this many of its nearest pieces
// Grey, not black: black strings would vanish against the near-black page.
const STRING_COLOR = 0x9a9893;
const STRING_OPACITY = 0.75;
// Width in device pixels. Plain WebGL lines are always 1 device pixel, so these are drawn as
// screen-space quads (three's LineSegments2) to make them thicker.
const STRING_WIDTH = 4;
const START_ANGLE = Math.PI / 4;    // a vertex facing the camera
const CAMERA_AZIMUTH = 42 * Math.PI / 180;
const CAMERA_ELEVATION = 19 * Math.PI / 180; // slightly above
const CAMERA_DISTANCE = 5.2;
// Gem finish.
const GEM_ROUGHNESS = 0.12;
const GEM_METALNESS = 0.18;
const GEM_REFLECTION = 1.2;

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

// ---------- fracture ----------
// The diamond is pre-broken into irregular convex pieces: a Voronoi fracture of the octahedron.
// Each piece is the octahedron clipped by the bisecting planes between its seed point and every
// other seed. Pieces keep their orientation; only their positions change as they fly apart.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A convex polyhedron as a list of faces; each face is a list of points wound counterclockwise
// seen from outside.
function octahedronFaces(a, h) {
  const faces = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    let f = [new Vector3(sx * a, 0, 0), new Vector3(0, sy * h, 0), new Vector3(0, 0, sz * a)];
    const n = f[1].clone().sub(f[0]).cross(f[2].clone().sub(f[0]));
    if (n.dot(f[0]) < 0) f = [f[0], f[2], f[1]];
    faces.push(f);
  }
  return faces;
}

// Keep the part of the polyhedron where n·x <= d, closing the cut with a new face.
function clip(faces, n, d) {
  const out = [];
  const cut = [];
  const EPS = 1e-9;
  for (const f of faces) {
    const kept = [];
    for (let i = 0; i < f.length; i++) {
      const p = f[i], q = f[(i + 1) % f.length];
      const dp = n.dot(p) - d, dq = n.dot(q) - d;
      if (dp <= EPS) kept.push(p);
      if ((dp < -EPS && dq > EPS) || (dp > EPS && dq < -EPS)) {
        const x = p.clone().lerp(q, dp / (dp - dq));
        kept.push(x);
        cut.push(x);
      } else if (Math.abs(dp) <= EPS) cut.push(p);
    }
    if (kept.length >= 3) out.push(kept);
  }
  if (cut.length >= 3) {
    const c = cut.reduce((acc, p) => acc.add(p), new Vector3()).divideScalar(cut.length);
    const u = cut.find((p) => p.distanceToSquared(c) > 1e-12).clone().sub(c).normalize();
    const v = n.clone().cross(u);
    const uniq = [];
    for (const p of cut) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-12)) uniq.push(p);
    uniq.sort((p, q) => {
      const a = Math.atan2(p.clone().sub(c).dot(v), p.clone().sub(c).dot(u));
      const b = Math.atan2(q.clone().sub(c).dot(v), q.clone().sub(c).dot(u));
      return a - b;
    });
    if (uniq.length >= 3) out.push(uniq);
  }
  return out;
}

// Same clip as above, for a surface whose vertices carry their own normals (the soft diamond's
// rounded edges): cut edges interpolate the normal, and the closing face is flat.
function clipSmooth(faces, n, d) {
  const out = [];
  const cut = [];
  const EPS = 1e-9;
  for (const f of faces) {
    const kept = [];
    for (let i = 0; i < f.length; i++) {
      const p = f[i], q = f[(i + 1) % f.length];
      const dp = n.dot(p.p) - d, dq = n.dot(q.p) - d;
      if (dp <= EPS) kept.push(p);
      if ((dp < -EPS && dq > EPS) || (dp > EPS && dq < -EPS)) {
        const t = dp / (dp - dq);
        const x = { p: p.p.clone().lerp(q.p, t), n: p.n.clone().lerp(q.n, t).normalize() };
        kept.push(x);
        cut.push(x.p);
      } else if (Math.abs(dp) <= EPS) cut.push(p.p);
    }
    if (kept.length >= 3) { kept.cap = f.cap; out.push(kept); }
  }
  if (cut.length >= 3) {
    const c = cut.reduce((acc, p) => acc.add(p), new Vector3()).divideScalar(cut.length);
    const far = cut.find((p) => p.distanceToSquared(c) > 1e-12);
    if (far) {
      const u = far.clone().sub(c).normalize();
      const v = n.clone().cross(u);
      const uniq = [];
      for (const p of cut) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-12)) uniq.push(p);
      const ang = (p) => Math.atan2(p.clone().sub(c).dot(v), p.clone().sub(c).dot(u));
      uniq.sort((p, q) => ang(p) - ang(q));
      if (uniq.length >= 3) {
        const capFace = uniq.map((p) => ({ p, n: n.clone() }));
        capFace.cap = true; // an inside face, exposed only when the pieces separate
        out.push(capFace);
      }
    }
  }
  return out;
}

// Break the soft-edged diamond (`soft`, a BufferGeometry) into pieces. Each piece's Voronoi cell
// is first found against the plain octahedron (cheap), then the soft surface is cut by just
// that cell's bisecting planes. The pieces' outer surfaces are the soft diamond's own surface,
// normals included, so the reassembled pieces look exactly like the intact diamond.
function fracture(a, h, count, seed, soft) {
  const rand = mulberry32(seed);
  const seeds = [];
  while (seeds.length < count) {
    const p = new Vector3((rand() * 2 - 1) * a, (rand() * 2 - 1) * h, (rand() * 2 - 1) * a);
    if (Math.abs(p.x) / a + Math.abs(p.y) / h + Math.abs(p.z) / a < 0.97) seeds.push(p);
  }
  // The soft surface as triangles with per-vertex normals.
  const sp = soft.attributes.position, sn = soft.attributes.normal;
  const tris = [];
  for (let t = 0; t < sp.count; t += 3) {
    const f = [0, 1, 2].map((k) => ({
      p: new Vector3(sp.getX(t + k), sp.getY(t + k), sp.getZ(t + k)),
      n: new Vector3(sn.getX(t + k), sn.getY(t + k), sn.getZ(t + k)),
    }));
    const c = f[0].p.clone().add(f[1].p).add(f[2].p).divideScalar(3);
    tris.push({ f, c, r: Math.max(...f.map((v) => v.p.distanceTo(c))) });
  }
  const pieces = [];
  for (let i = 0; i < seeds.length; i++) {
    let cell = octahedronFaces(a, h);
    const planes = [];
    for (let j = 0; j < seeds.length && cell.length; j++) {
      if (i === j) continue;
      const n = seeds[j].clone().sub(seeds[i]).normalize();
      const d = n.dot(seeds[i].clone().add(seeds[j]).multiplyScalar(0.5));
      const before = cell.length;
      cell = clip(cell, n, d);
      planes.push({ n, d, before });
    }
    if (cell.length < 4) continue;
    // Keep only the bisecting planes that actually bound the final cell.
    const pts = cell.flat();
    const bounding = planes.filter(({ n, d }) => pts.some((p) => Math.abs(n.dot(p) - d) < 1e-7));
    const cc = pts.reduce((acc, p) => acc.add(p), new Vector3()).divideScalar(pts.length);
    const cr = Math.max(...pts.map((p) => p.distanceTo(cc)));
    let faces = tris.filter((t) => t.c.distanceTo(cc) <= cr + t.r + 1e-6).map((t) => t.f);
    for (const { n, d } of bounding) {
      if (!faces.length) break;
      faces = clipSmooth(faces, n, d);
    }
    if (faces.length < 4) continue;
    // Centre each piece on its own centroid so it can be moved as a unit.
    const verts = faces.flat();
    const centre = verts.reduce((acc, v) => acc.add(v.p), new Vector3()).divideScalar(verts.length);
    // Outer surface first, inside (cut) faces second, as two draw groups: the cut faces get their
    // own material, pushed back in the depth test so that where a cut face meets the outer
    // surface, the surface always wins and the assembled pieces show no seams.
    const pos = [];
    const nor = [];
    let surfaceVerts = 0;
    for (const pass of [false, true]) {
      for (const f of faces) {
        if (!!f.cap !== pass) continue;
        for (let k = 1; k < f.length - 1; k++) {
          for (const v of [f[0], f[k], f[k + 1]]) {
            pos.push(v.p.x - centre.x, v.p.y - centre.y, v.p.z - centre.z);
            nor.push(v.n.x, v.n.y, v.n.z);
          }
        }
      }
      if (!pass) surfaceVerts = pos.length / 3;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    geo.addGroup(0, surfaceVerts, 0);
    geo.addGroup(surfaceVerts, pos.length / 3 - surfaceVerts, 1);
    // Fly outward from the centre, pieces near the surface further, with some variation so the
    // cloud is irregular rather than a scaled-up diamond.
    const dir = centre.lengthSq() > 1e-6 ? centre.clone().normalize() : new Vector3(0, 1, 0);
    dir.add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.6)).normalize();
    const reach = 0.6 + rand() * 0.8 + centre.length() * 0.5;
    pieces.push({ geo, centre, offset: dir.multiplyScalar(reach) });
  }
  return pieces;
}

// The reflection environment: black, with emissive panels placed around the diamond in camera
// terms (upper right brightest, matching the key light). Built once and prefiltered.
function studio() {
  const env = new Scene();
  env.background = new Color(0x000000);
  const panel = (w, h, brightness, x, y, z) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(brightness, brightness, brightness * 0.96) }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(4, 3, 6, 5, 6, 4);     // key softbox, upper right front
  panel(2, 5, 3, -6, 3, 2);    // tall strip, left
  panel(5, 1, 2.5, 0, 8, -3);  // overhead strip, behind
  panel(3, 2, 1.5, 4, -2, -6); // low kicker, back right
  panel(2, 2, 1, -3, -5, 5);   // faint fill, below front
  return env;
}

export function createHeroScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); // transparent: the page background shows through
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();

  // Reflections: a dark studio with a few bright softboxes, the way jewellery is photographed.
  // Each flat facet mirrors either darkness or a softbox, so as the diamond turns, facets flash
  // bright and go dark like a cut gem, while the direct lights below keep the overall shading
  // from the upper right.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  pmrem.dispose();

  // Diamond: elongated octahedron with softened edges, cream, glossy like a polished gem: a low
  // roughness base under a clear coat, so highlights stay sharp and the environment reflects.
  const material = new MeshPhysicalMaterial({
    color: 0xe6ddcf,
    roughness: GEM_ROUGHNESS,
    metalness: GEM_METALNESS,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: GEM_REFLECTION,
  });
  // The whole assembly turns around the vertical axis; the pieces inside it never rotate on
  // their own, so every fragment keeps the same orientation as it drifts outward.
  const assembly = new Group();
  assembly.rotation.y = START_ANGLE;
  scene.add(assembly);
  // Intact, the diamond is drawn as one soft-edged mesh; once it starts to break, the pieces,
  // which are cut from that same soft surface, so there is no visible switch between the two.
  const softGeo = softOctahedron(DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT, DIAMOND_HALF_HEIGHT, EDGE_RADIUS);
  // While the pieces are only just parting, the intact diamond stays drawn directly behind them
  // (pushed back slightly in the depth test): it fills the pixel-wide gaps where three pieces
  // meet with exactly the same surface, and then shrinks away inside the pieces as the cracks
  // open, so there is never a moment where one version is swapped for the other.
  const wholeMaterial = material.clone();
  wholeMaterial.polygonOffset = true;
  wholeMaterial.polygonOffsetFactor = 1;
  wholeMaterial.polygonOffsetUnits = 1;
  const whole = new Mesh(softGeo, wholeMaterial);
  assembly.add(whole);
  const cutMaterial = material.clone();
  cutMaterial.polygonOffset = true;
  cutMaterial.polygonOffsetFactor = 4;
  cutMaterial.polygonOffsetUnits = 16;
  const shards = new Group();
  shards.visible = false;
  assembly.add(shards);
  // Cutting the pieces takes ~0.1 s, so it happens in an idle moment after the first frame
  // (see prepare()), or on the spot if the page is scrolled before then.
  let pieces = null;
  const prepare = () => {
    if (pieces) return;
    pieces = fracture(DIAMOND_HALF_HEIGHT / DIAMOND_ASPECT, DIAMOND_HALF_HEIGHT, FRAGMENTS, FRAGMENT_SEED, softGeo)
      .map((p) => {
        const mesh = new Mesh(p.geo, [material, cutMaterial]);
        mesh.position.copy(p.centre);
        shards.add(mesh);
        return { mesh, centre: p.centre, offset: p.offset };
      });
    // Strings run between piece centres, so while the diamond is whole they are buried inside
    // the solid pieces; they come into view in the gaps as the pieces separate.
    const pairs = new Set();
    pieces.forEach((p, i) => {
      pieces.map((q, j) => ({ j, d: p.centre.distanceToSquared(q.centre) }))
        .filter(({ j }) => j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, STRING_NEIGHBOURS)
        .forEach(({ j }) => pairs.add(i < j ? `${i},${j}` : `${j},${i}`));
    });
    links = [...pairs].map((k) => k.split(',').map(Number));
    const geo = new LineSegmentsGeometry();
    geo.setPositions(new Float32Array(links.length * 6));
    strings = new LineSegments2(geo, stringMaterial);
    strings.frustumCulled = false; // its bounds change every frame
    shards.add(strings);
  };
  // linewidth is in CSS pixels; layout() divides by the pixel ratio to get STRING_WIDTH device pixels.
  const stringMaterial = new LineMaterial({ color: STRING_COLOR, linewidth: STRING_WIDTH, transparent: true, opacity: 0, depthWrite: false });
  let links = [];
  let strings = null;
  let explosion = 0;
  // e: 0 = intact, 1 = fully apart.
  const setExplode = (e) => {
    explosion = e;
    const broken = e > 0;
    if (broken) prepare();
    shards.visible = broken;
    whole.visible = e < 0.08;
    whole.scale.setScalar(Math.max(0.7, 1 - 4 * e));
    if (!broken) return;
    for (const p of pieces) p.mesh.position.copy(p.centre).addScaledVector(p.offset, e);
    // Write the endpoints straight into the line geometry's buffer (start and end of each
    // segment, interleaved), instead of rebuilding it every frame.
    const buf = strings.geometry.attributes.instanceStart.data;
    links.forEach(([i, j], k) => {
      const a = pieces[i].mesh.position, b = pieces[j].mesh.position;
      buf.array.set([a.x, a.y, a.z, b.x, b.y, b.z], 6 * k);
    });
    buf.needsUpdate = true;
    // Fade the strings in over the first part of the break so they don't pop on.
    stringMaterial.opacity = STRING_OPACITY * Math.min(1, e / 0.25);
  };

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
    stringMaterial.linewidth = STRING_WIDTH / dpr;
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
    setAngle(a) { assembly.rotation.y = a; },
    get angle() { return assembly.rotation.y; },
    setExplode,
    prepare,
    get explosion() { return explosion; },
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
    window.__heroExport = (px, angle, heightFraction = 0.9, explode = 0) => {
      hero.renderer.setPixelRatio(1);
      hero.layout(px, px, { heightFraction });
      hero.setAngle(angle);
      hero.setExplode(explode);
      hero.render();
      return canvas.toDataURL('image/png');
    };
  }

  // The diamond follows the scroll position instead of moving on its own. Scrolling down turns
  // it counterclockwise seen from above (front face moving left to right), one full turn per
  // 1200px, and breaks it apart over the first 600px; scrolling back up turns it back and
  // reassembles it. The scroll position is eased so wheel steps look smooth, and frames are
  // drawn only while it is catching up, so an idle page costs nothing.
  const SMOOTHING = 0.16;   // share of the remaining distance closed per 60 Hz frame
  const PX_PER_TURN = 1200; // scroll distance for one full turn
  const PX_TO_BREAK = 600;  // scroll distance from intact to fully apart
  const scrollTarget = () => Math.max(window.scrollY, 0);
  let shown = scrollTarget(); // the eased scroll position currently drawn
  const show = (y) => {
    shown = y;
    hero.setAngle(START_ANGLE + (y / PX_PER_TURN) * 2 * Math.PI);
    const t = Math.min(y / PX_TO_BREAK, 1);
    hero.setExplode(t * t * (3 - 2 * t)); // smoothstep: eases out of and into the intact shape
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
    const target = scrollTarget();
    const diff = target - shown;
    const settled = Math.abs(diff) < 0.25;
    const k = 1 - Math.pow(1 - SMOOTHING, dt > 0 ? dt * 60 : 1);
    show(settled ? target : shown + diff * k);
    hero.render();
    if (settled) { running = false; last = null; } else raf = requestAnimationFrame(step);
  };
  // Under prefers-reduced-motion the diamond stays still and intact.
  const follow = () => {
    if (running || reduceMotion.matches || document.hidden || !onScreen) return;
    running = true;
    last = null;
    raf = requestAnimationFrame(step);
  };
  const stop = () => { running = false; last = null; cancelAnimationFrame(raf); };

  if (!reduceMotion.matches) { show(scrollTarget()); hero.render(); }
  if (!reduceMotion.matches) (window.requestIdleCallback || setTimeout)(() => hero.prepare(), { timeout: 3000 });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : follow()));
  reduceMotion.addEventListener('change', () => {
    stop();
    show(reduceMotion.matches ? 0 : scrollTarget());
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
