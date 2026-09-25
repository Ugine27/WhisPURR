import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Model, ModelName, usePBR, useModelMesh } from './assets';
import { canvasTexture } from './kit';
import { seeded, V3 } from './util';

/*
 * The living forest floor and trees. Everything that sways shares one
 * `wind` time uniform so grass, leaves and feathers move together.
 */

export const wind = { value: 0 };
export function WindClock() {
  useFrame((_, dt) => {
    wind.value += Math.min(dt, 0.1);
  });
  return null;
}

/* --------------------------------- Height ---------------------------------- */

export interface Flat {
  x: number;
  z: number;
  r: number; // fully flat inside r
  soft: number; // blend width outside r
}

// Gentle undulation everywhere, flattened under buildings, paths and stone,
// and rising into hills beyond the clearing.
export function makeHeight(flats: Flat[], paths: THREE.Vector2[][]) {
  return (x: number, z: number) => {
    const bumps = 0.16 * Math.sin(x * 0.9 + Math.sin(z * 0.7)) * Math.cos(z * 0.8) + 0.07 * Math.sin(x * 2.3 + z * 1.7) + 0.04 * Math.sin(x * 4.1 - z * 3.3);
    const dx = Math.max(Math.abs(x) - 16, 0);
    const dz = Math.max(-14 - z, z - 30, 0);
    const beyond = THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, 30);
    const hills = beyond * (Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.8 + Math.sin(x * 0.05 + z * 0.06) * 2.6 + beyond * 4);
    let flat = 0;
    for (const f of flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      flat = Math.max(flat, 1 - THREE.MathUtils.smoothstep(d, f.r, f.r + f.soft));
    }
    for (const pts of paths) {
      let best = Infinity;
      for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSeg(x, z, pts[i - 1], pts[i]));
      flat = Math.max(flat, (1 - THREE.MathUtils.smoothstep(best, 0.5, 1.6)) * 0.85);
    }
    return (bumps + hills) * (1 - flat) - 0.02;
  };
}

export function distToSeg(x: number, z: number, a: THREE.Vector2, b: THREE.Vector2) {
  const abx = b.x - a.x;
  const abz = b.y - a.y;
  const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz || 1), 0, 1);
  return Math.hypot(x - (a.x + abx * t), z - (a.y + abz * t));
}

/* --------------------------------- Terrain --------------------------------- */

// A top-down mask of the paths (red) and packed earth around doors (green).
function pathMask(paths: THREE.Vector2[][], bare: Flat[], half: number) {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 512, 512);
    const px = (v: number) => ((v + half) / (half * 2)) * 512;
    ctx.filter = 'blur(6px)';
    ctx.strokeStyle = '#f00';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = (1.5 / (half * 2)) * 512;
    for (const pts of paths) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), px(p.y)) : ctx.moveTo(px(p.x), px(p.y))));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of bare) {
      const g = ctx.createRadialGradient(px(f.x), px(f.z), 0, px(f.x), px(f.z), (f.r / (half * 2)) * 512);
      g.addColorStop(0, 'rgba(0,255,0,0.9)');
      g.addColorStop(1, 'rgba(0,255,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
  });
}

const NOISE_GLSL = `
float kHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kHash(i), kHash(i + vec2(1.0, 0.0)), u.x), mix(kHash(i + vec2(0.0, 1.0)), kHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float kFbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * kNoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

export function Terrain({ height, paths, bare }: { height: (x: number, z: number) => number; paths: THREE.Vector2[][]; bare: Flat[] }) {
  const moss = usePBR('forrest_ground_01');
  const soil = usePBR('forest_ground_04');
  const peb = usePBR('pebble_ground_01');
  const HALF = 40;
  const mask = useMemo(() => {
    const t = pathMask(paths, bare, HALF);
    t.colorSpace = THREE.NoColorSpace; // data, not colour
    return t;
  }, [paths, bare]);

  const geo = useMemo(() => {
    const far = new THREE.PlaneGeometry(220, 220, 110, 110);
    const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, 240, 240);
    for (const geom of [g, far]) {
      geom.rotateX(-Math.PI / 2);
      const pos = geom.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
      geom.computeVertexNormals();
    }
    // The coarse outer ground sits a touch lower so the fine centre wins.
    far.translate(0, -0.03, 0);
    return { near: g, far };
  }, [height]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ ...moss, roughness: 1, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        tSoil: { value: soil.map },
        tSoilN: { value: soil.normalMap },
        tSoilA: { value: soil.aoMap },
        tPeb: { value: peb.map },
        tPebN: { value: peb.normalMap },
        tPebA: { value: peb.aoMap },
        tMask: { value: mask },
        uHalf: { value: HALF },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos;
          uniform sampler2D tSoil; uniform sampler2D tSoilN; uniform sampler2D tSoilA;
          uniform sampler2D tPeb; uniform sampler2D tPebN; uniform sampler2D tPebA;
          uniform sampler2D tMask; uniform float uHalf;
          ${NOISE_GLSL}
          vec3 kW;
          vec2 kUv;
          void kWeights() {
            kUv = vec2(vWPos.x, -vWPos.z) / 2.5;
            vec4 mk = texture2D(tMask, vec2(vWPos.x, vWPos.z) / (uHalf * 2.0) + 0.5);
            float n = kFbm(vWPos.xz * 0.18);
            float soilW = smoothstep(0.58, 0.82, n) * 0.8 + mk.g * 0.9;
            float pebW = mk.r;
            float mossW = max(0.0, 1.0 - soilW - pebW);
            kW = vec3(mossW, soilW, pebW) / max(mossW + soilW + pebW, 0.001);
          }`,
        )
        .replace(
          '#include <map_fragment>',
          `kWeights();
          // The grassy layer is tinted towards lush moss green.
          vec4 kCol = texture2D(map, kUv) * vec4(0.7, 0.98, 0.5, 1.0) * kW.x + texture2D(tSoil, kUv) * kW.y + texture2D(tPeb, kUv * 1.3) * kW.z;
          // Break up tiling with a slow tonal drift.
          kCol.rgb *= 0.85 + 0.3 * kFbm(vWPos.xz * 0.05);
          diffuseColor *= kCol;`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `vec4 kArm = texture2D(roughnessMap, kUv) * kW.x + texture2D(tSoilA, kUv) * kW.y + texture2D(tPebA, kUv * 1.3) * kW.z;
          float roughnessFactor = roughness * kArm.g;`,
        )
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = 0.0;')
        .replace(
          '#include <normal_fragment_maps>',
          `vec3 mapN = (texture2D(normalMap, kUv) * kW.x + texture2D(tSoilN, kUv) * kW.y + texture2D(tPebN, kUv * 1.3) * kW.z).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);`,
        )
        .replace(
          '#include <aomap_fragment>',
          `float ambientOcclusion = mix(1.0, kArm.r, 0.8);
          reflectedLight.indirectDiffuse *= ambientOcclusion;`,
        );
    };
    return m;
  }, [moss, soil, peb, mask]);

  return (
    <group>
      <mesh geometry={geo.near} material={material} receiveShadow />
      <mesh geometry={geo.far} material={material} receiveShadow />
    </group>
  );
}

/* ---------------------------------- Grass ---------------------------------- */

function bladeGeometry() {
  const h = 0.38;
  const segs = 4;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.028 * (1 - t * 0.9);
    const bend = t * t * 0.09;
    pos.push(-w, t * h, bend, w, t * h, bend);
    const c = new THREE.Color('#3f5f22').lerp(new THREE.Color('#a8c26a'), t);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Adds a wind sway to an instanced material: stronger higher up.
function withWind(m: THREE.Material, strength: number, height: number) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec3 ip = vec3(instanceMatrix[3]);
        float h = clamp(position.y / ${height.toFixed(3)}, 0.0, 1.0);
        float gust = sin(uWind * 0.6 + ip.x * 0.05) * 0.5 + 0.5;
        float sway = sin(uWind * 1.9 + ip.x * 0.7 + ip.z * 0.5) * (0.6 + gust) + sin(uWind * 4.3 + ip.z * 1.3) * 0.25;
        transformed.x += sway * ${strength.toFixed(3)} * h * h;
        transformed.z += cos(uWind * 1.4 + ip.x * 0.4) * ${(strength * 0.5).toFixed(3)} * h * h;
      }`,
    );
  };
  return m;
}

export function Grass({ spots }: { spots: { x: number; y: number; z: number; r: number; s: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(bladeGeometry, []);
  const mat = useMemo(() => withWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), 0.07, 0.38), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    spots.forEach((b, i) => {
      e.set((Math.sin(i) * 0.15), b.r, (Math.cos(i * 1.7) * 0.15));
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.s, b.s * (0.7 + (i % 7) * 0.08), b.s));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return <instancedMesh ref={ref} args={[geo, mat, spots.length]} receiveShadow />;
}

/* ---------------------------------- Trees ---------------------------------- */

function leafTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, '#4c6e2a');
    g.addColorStop(1, '#8fb452');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(64, 124);
    ctx.bezierCurveTo(10, 90, 14, 30, 64, 4);
    ctx.bezierCurveTo(114, 30, 118, 90, 64, 124);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,230,160,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(64, 124);
    ctx.lineTo(64, 10);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = 100 - i * 15;
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.lineTo(32 + i * 2, y - 14);
      ctx.moveTo(64, y);
      ctx.lineTo(96 - i * 2, y - 14);
      ctx.stroke();
    }
  });
}

export interface TreeSpec {
  p: THREE.Vector3;
  h: number;
  r: number;
  seed: number;
}

interface TreeBuild {
  wood: THREE.BufferGeometry;
  leaves: THREE.Matrix4[];
}

// A trunk with a flared base, a few kinked limbs and twigs; leaves cluster
// around the twig tips.
function buildTree(spec: TreeSpec): TreeBuild {
  const rand = seeded(spec.seed);
  const parts: THREE.BufferGeometry[] = [];
  const leaves: THREE.Matrix4[] = [];
  const tube = (pts: THREE.Vector3[], r0: number, r1: number, radial: number) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = Math.max(4, Math.round(curve.getLength() * 3));
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = curve.getPointAt(t);
      // Tapered, with a flared root on the trunk.
      const r = THREE.MathUtils.lerp(r0, r1, t) * (1 + (r0 > 0.2 ? Math.max(0, 0.12 - t) * 6 : 0));
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    // Stretch UVs along the length so the bark isn't smeared.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const len = curve.getLength();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 0.8, uv.getY(i) * 2);
    parts.push(g);
    return curve;
  };
  const cluster = (at: THREE.Vector3, count: number, radius: number) => {
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(rand() - 0.5, rand() - 0.3, rand() - 0.5).normalize().multiplyScalar(Math.cbrt(rand()) * radius);
      const p = at.clone().add(d);
      q.setFromEuler(new THREE.Euler(rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI));
      const s = 0.22 + rand() * 0.16;
      leaves.push(new THREE.Matrix4().compose(p.add(spec.p), q, new THREE.Vector3(s, s * 1.3, s)));
    }
  };

  const top = new THREE.Vector3((rand() - 0.5) * 0.6, spec.h, (rand() - 0.5) * 0.6);
  const trunkPts = [0, 0.3, 0.6, 1].map((t) => new THREE.Vector3(Math.sin(t * 3 + spec.seed) * 0.18 * t + top.x * t, t * spec.h, Math.cos(t * 2.4 + spec.seed) * 0.18 * t + top.z * t));
  const trunk = tube(trunkPts, spec.r, spec.r * 0.35, 12);
  const limbs = 5 + Math.floor(rand() * 4);
  for (let b = 0; b < limbs; b++) {
    const t = 0.42 + (b / limbs) * 0.5 + rand() * 0.05;
    const base = trunk.getPointAt(t);
    const az = rand() * Math.PI * 2;
    const len = spec.h * (0.22 + rand() * 0.16) * (1.1 - t * 0.4);
    const up = 0.45 + rand() * 0.5;
    const dir = new THREE.Vector3(Math.cos(az), up, Math.sin(az)).normalize();
    const mid = base.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(0, len * 0.08, 0));
    const tip = base.clone().addScaledVector(dir, len).add(new THREE.Vector3((rand() - 0.5) * 0.4, len * 0.12, (rand() - 0.5) * 0.4));
    const limb = tube([base, mid, tip], spec.r * 0.4 * (1 - t * 0.4), 0.03, 7);
    for (let k = 0; k < 3; k++) {
      const s = limb.getPointAt(0.45 + k * 0.22);
      const tdir = dir.clone().add(new THREE.Vector3(rand() - 0.5, rand() * 0.6, rand() - 0.5)).normalize();
      const tl = len * (0.3 + rand() * 0.2);
      const tw = s.clone().addScaledVector(tdir, tl);
      tube([s, s.clone().lerp(tw, 0.5).add(new THREE.Vector3(0, 0.1, 0)), tw], 0.035, 0.012, 5);
      cluster(tw, 34, 0.75 + rand() * 0.35);
    }
    cluster(tip, 46, 0.95);
  }
  cluster(trunk.getPointAt(1), 60, 1.2);
  const wood = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
  parts.forEach((g) => g.dispose());
  wood.translate(spec.p.x, spec.p.y, spec.p.z);
  return { wood, leaves };
}

export function Trees({ specs, leafTint = '#ffffff' }: { specs: TreeSpec[]; leafTint?: string }) {
  const bark = usePBR('bark_brown_02', [1, 1]);
  const barkMat = useMemo(() => new THREE.MeshStandardMaterial({ ...bark, roughness: 1 }), [bark]);
  const builds = useMemo(() => specs.map(buildTree), [specs]);
  const allLeaves = useMemo(() => builds.flatMap((b) => b.leaves), [builds]);
  const leafMap = useMemo(leafTexture, []);
  const leafGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 2);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const leafMat = useMemo(
    () =>
      withWind(
        new THREE.MeshStandardMaterial({
          map: leafMap,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 0.65,
          color: leafTint,
          // A little self-light fakes sunlight passing through thin leaves.
          emissive: new THREE.Color('#2f4a14'),
          emissiveIntensity: 0.35,
        }),
        0.05,
        1,
      ),
    [leafMap, leafTint],
  );
  const leafRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    const rand = seeded(5);
    allLeaves.forEach((m, i) => {
      leafRef.current!.setMatrixAt(i, m);
      leafRef.current!.setColorAt(i, c.setHSL(0.22 + rand() * 0.06, 0.45 + rand() * 0.2, 0.42 + rand() * 0.18));
    });
    leafRef.current!.instanceMatrix.needsUpdate = true;
    if (leafRef.current!.instanceColor) leafRef.current!.instanceColor.needsUpdate = true;
  }, [allLeaves]);
  return (
    <group>
      {builds.map((b, i) => (
        <mesh key={i} geometry={b.wood} material={barkMat} castShadow receiveShadow />
      ))}
      <instancedMesh ref={leafRef} args={[leafGeo, leafMat, allLeaves.length]} castShadow receiveShadow />
    </group>
  );
}

/* -------------------------------- Scatter ---------------------------------- */

export function Scatter({ name, spots, windStrength = 0 }: { name: ModelName; spots: { p: V3; r: number; s: number }[]; windStrength?: number }) {
  const { geometry, material } = useModelMesh(name);
  const mat = useMemo(() => {
    const m = (material as THREE.Material).clone();
    if (windStrength) {
      geometry.computeBoundingBox();
      withWind(m, windStrength, Math.max(0.1, geometry.boundingBox!.max.y));
    }
    return m;
  }, [material, geometry, windStrength]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.r);
      m.compose(new THREE.Vector3(...s.p), q, new THREE.Vector3(s.s, s.s, s.s));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return <instancedMesh ref={ref} args={[geometry, mat, spots.length]} castShadow receiveShadow />;
}

export function Rocks({ spots }: { spots: { p: V3; r: number; s: number; set: 1 | 2 }[] }) {
  return (
    <>
      {spots.map((s, i) => (
        <Model key={i} name={s.set === 1 ? 'rock_moss_set_01' : 'rock_moss_set_02'} position={s.p} rotation={[0, s.r, 0]} scale={s.s} />
      ))}
    </>
  );
}
