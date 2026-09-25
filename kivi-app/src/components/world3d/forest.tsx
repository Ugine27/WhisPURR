import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOMS } from './hubs';
import { canvasTexture } from './kit';
import { mossTexture } from './hubs';
import { seeded, V3 } from './util';

/*
 * Kivi's forest: a clearing ringed by tall trees, with glass domes beyond.
 * Kivi starts on a mossy branch (BRANCH_PERCH), dives through a stand of
 * trees, and lands on the glowing stone (STONE) where the paths meet.
 */

export const STONE = new THREE.Vector3(0, 0, 4.2);
export const STONE_TOP = 0.34;
export const BRANCH_PERCH = new THREE.Vector3(-1.4, 6.32, 24);

// Kivi's dive from the branch, through the canopy, down to the stone.
export const FLIGHT = new THREE.CatmullRomCurve3([
  BRANCH_PERCH.clone(),
  new THREE.Vector3(-1.1, 7.4, 21.8),
  new THREE.Vector3(-0.4, 5.4, 18.2),
  new THREE.Vector3(0.3, 3.4, 14.6),
  new THREE.Vector3(0.2, 1.7, 9.6),
  new THREE.Vector3(0, STONE_TOP + 0.6, 5.4),
  new THREE.Vector3(STONE.x, STONE_TOP, STONE.z),
]);

// Convert a point in a hub's own coordinates into world coordinates.
export function roomToWorld(room: (typeof ROOMS)[number], p: V3) {
  return new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation).add(new THREE.Vector3(...room.position));
}

function distToSegment(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

// Winding path from the stone to each hub's door.
function pathCurve(to: THREE.Vector3, bend: number) {
  const from = STONE.clone().setY(0);
  const mid = from.clone().lerp(to, 0.5);
  const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize();
  return new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.25).addScaledVector(side, -bend * 0.5), mid.addScaledVector(side, bend), to.clone()]);
}

const HUB_PATHS = ROOMS.map((r, i) => pathCurve(roomToWorld(r, r.doorstep), [0.9, -0.8, 0.7][i] ?? 0.6));

function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#dfe7d4') },
          mid: { value: new THREE.Color('#eef0df') },
          low: { value: new THREE.Color('#cfdcc0') },
        },
        vertexShader: 'varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vPos;
          void main() {
            float h = vPos.y;
            vec3 c = h > 0.1 ? mix(mid, top, smoothstep(0.1, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.1, h));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}

function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(180, 180, 180, 180);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const moss = new THREE.Color('#8aa453');
    const deep = new THREE.Color('#6d8a40');
    const earth = new THREE.Color('#8c7a58');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Flat through the clearing and the flight path, rising gently beyond.
      const dx = Math.max(Math.abs(x) - 16, 0);
      const dz = Math.max(-14 - z, z - 30, 0);
      const rise = THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, 30);
      const hills = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.8 + Math.sin(x * 0.05 + z * 0.06) * 2.6;
      pos.setY(i, rise * (hills + rise * 4) - 0.02);
      const n = 0.5 + 0.5 * Math.sin(x * 0.4 + Math.cos(z * 0.35) * 2.2);
      const m = 0.5 + 0.5 * Math.sin(x * 0.13 - z * 0.17);
      c.copy(moss).lerp(deep, n * 0.6).lerp(earth, m * m * 0.35);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  // The same moss, tiled finely across the whole forest floor.
  const groundMoss = useMemo(() => {
    const t = mossTexture().clone();
    t.repeat.set(70, 70);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors map={groundMoss} roughness={1} />
    </mesh>
  );
}

function Path({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geo = useMemo(() => {
    const pts = curve.getSpacedPoints(60);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      const t = curve.getTangentAt(i / 60);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const w = 0.62 + Math.sin(i * 0.7) * 0.06;
      const l = p.clone().addScaledVector(side, w);
      const r = p.clone().addScaledVector(side, -w);
      pos.push(l.x, 0.025, l.z, r.x, 0.025, r.z);
      uv.push(0, i / 6, 1, i / 6);
      if (i < 60) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [curve]);
  const gravel = useMemo(() => {
    const rand = seeded(55);
    return canvasTexture(
      128,
      128,
      (ctx) => {
        ctx.fillStyle = '#b9a88c';
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 700; i++) {
          ctx.fillStyle = `rgba(${rand() > 0.5 ? '90,75,55' : '235,225,205'},${0.2 + rand() * 0.3})`;
          ctx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 3, 1 + rand() * 3);
        }
        const g = ctx.createLinearGradient(0, 0, 128, 0);
        g.addColorStop(0, 'rgba(70,90,40,0.8)');
        g.addColorStop(0.12, 'rgba(70,90,40,0)');
        g.addColorStop(0.88, 'rgba(70,90,40,0)');
        g.addColorStop(1, 'rgba(70,90,40,0.8)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
      },
      [1, 1],
    );
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={gravel} roughness={1} />
    </mesh>
  );
}

// The landing stone, carved with a ring of softly glowing marks.
function GlowStone({ bright }: { bright: React.MutableRefObject<number> }) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const marks = useMemo(
    () =>
      canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(128, 128, 96, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
          ctx.lineTo(128 + Math.cos(a + 0.12) * 84, 128 + Math.sin(a + 0.12) * 84);
          ctx.stroke();
        }
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(128, 128, 40, 0, Math.PI * 2);
        ctx.stroke();
      }),
    [],
  );
  useFrame(({ clock }) => {
    const pulse = 0.6 + Math.sin(clock.elapsedTime * 1.6) * 0.25 + bright.current * 1.2;
    if (glow.current) glow.current.emissiveIntensity = pulse * 2.2;
    if (light.current) light.current.intensity = pulse * 3;
  });
  return (
    <group position={[STONE.x, 0, STONE.z]}>
      <mesh position={[0, 0.12, 0]} scale={[1.25, 0.26, 1.05]} castShadow receiveShadow>
        <sphereGeometry args={[1, 48, 24]} />
        <meshStandardMaterial color="#8f8b82" roughness={0.85} map={mossTexture()} />
      </mesh>
      <mesh position={[0, STONE_TOP - 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 48]} />
        <meshStandardMaterial ref={glow} color="#000" transparent alphaMap={marks} emissive="#9ff3d0" emissiveIntensity={1.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.8, 0]} color="#a8f5d6" intensity={2} distance={5} decay={1.8} />
    </group>
  );
}

function barkTexture() {
  const rand = seeded(88);
  return canvasTexture(
    128,
    512,
    (ctx) => {
      ctx.fillStyle = '#5b4634';
      ctx.fillRect(0, 0, 128, 512);
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? '30,22,15' : '130,110,85'},${0.25 + rand() * 0.35})`;
        ctx.lineWidth = 1 + rand() * 3;
        const x = rand() * 128;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rand() - 0.5) * 20, 170, x + (rand() - 0.5) * 20, 340, x + (rand() - 0.5) * 10, 512);
        ctx.stroke();
      }
    },
    [2, 2],
  );
}

interface TreeSpec {
  p: THREE.Vector3;
  h: number;
  r: number;
  tones: string[];
  lean: number;
}

function ForestTree({ spec, bark }: { spec: TreeSpec; bark: THREE.Texture }) {
  const crown = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rand = seeded(Math.round(spec.p.x * 13 + spec.p.z * 7));
    return Array.from({ length: 7 }, (_, i) => ({
      p: [(rand() - 0.5) * spec.h * 0.35, spec.h * (0.72 + rand() * 0.28), (rand() - 0.5) * spec.h * 0.35] as V3,
      r: spec.h * (0.14 + rand() * 0.1),
      c: spec.tones[i % spec.tones.length],
    }));
  }, [spec]);
  useFrame(({ clock }) => {
    // Canopies sway a little in the breeze.
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.5 + spec.p.x) * 0.012;
  });
  return (
    <group position={spec.p} rotation={[0, 0, spec.lean]}>
      <mesh position={[0, spec.h * 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[spec.r * 0.55, spec.r, spec.h * 0.8, 14]} />
        <meshStandardMaterial map={bark} roughness={0.95} />
      </mesh>
      <group ref={crown}>
        {puffs.map((pf, i) => (
          <mesh key={i} position={pf.p} castShadow receiveShadow>
            <icosahedronGeometry args={[pf.r, 3]} />
            <meshStandardMaterial color={pf.c} roughness={0.9} bumpMap={mossTexture()} bumpScale={4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Ferns({ spots }: { spots: { p: THREE.Vector3; s: number; a: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const leaves = 7;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let i = 0;
    for (const f of spots) {
      for (let k = 0; k < leaves; k++) {
        const a = f.a + (k / leaves) * Math.PI * 2;
        e.set(0.9, a, 0, 'YXZ');
        q.setFromEuler(e);
        const dir = new THREE.Vector3(Math.sin(a), 0.5, Math.cos(a)).normalize();
        m.compose(f.p.clone().addScaledVector(dir, 0.35 * f.s), q, new THREE.Vector3(0.12 * f.s, 0.02 * f.s, 0.5 * f.s));
        ref.current!.setMatrixAt(i++, m);
      }
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length * leaves]} castShadow receiveShadow>
      <sphereGeometry args={[1, 10, 6]} />
      <meshStandardMaterial color="#5f8a3a" roughness={0.8} />
    </instancedMesh>
  );
}

// Glass geodesic domes in the distance, as in Kivi's storyboard.
function GeoDome({ p, r }: { p: V3; r: number }) {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(r, 3), [r]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  return (
    <group position={p}>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#e6f0ea" transparent opacity={0.12} roughness={0.05} envMapIntensity={2} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#dfe8e0" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

function SunShafts() {
  const tex = useMemo(
    () =>
      canvasTexture(64, 256, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 64, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,250,225,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 256);
        const v = ctx.createLinearGradient(0, 0, 0, 256);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(0.3, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, 64, 256);
      }),
    [],
  );
  const shafts: { p: V3; r: number; w: number }[] = [
    { p: [-4, 7, 12], r: 0.35, w: 2.2 },
    { p: [3, 7, 17], r: 0.3, w: 1.6 },
    { p: [-9, 8, 2], r: 0.4, w: 2.6 },
    { p: [10, 8, -6], r: 0.35, w: 2.2 },
    { p: [1, 8, -10], r: 0.3, w: 3 },
  ];
  return (
    <>
      {shafts.map((s, i) => (
        <mesh key={i} position={s.p} rotation={[0, i * 0.7, s.r]}>
          <planeGeometry args={[s.w, 16]} />
          <meshBasicMaterial map={tex} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
        </mesh>
      ))}
    </>
  );
}

// Kivi's starting perch: a tall tree with a long, mossy branch.
function BranchTree({ bark }: { bark: THREE.Texture }) {
  const branch = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-7.2, 5.4, 24.2), new THREE.Vector3(-4.6, 6.05, 24.1), new THREE.Vector3(-2.2, 6.1, 24), new THREE.Vector3(-0.2, 6.25, 23.9)]);
    const g = new THREE.TubeGeometry(c, 40, 0.24, 14, false);
    // Taper towards the tip.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i <= 40; i++) {
      const centre = c.getPointAt(i / 40);
      const taper = 1 - (i / 40) * 0.55;
      for (let j = 0; j <= 14; j++) {
        const k = i * 15 + j;
        v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return { g, c };
  }, []);
  const tufts = useMemo(() => {
    const rand = seeded(14);
    return Array.from({ length: 34 }, () => {
      const t = rand();
      const p = branch.c.getPointAt(t);
      return { p: [p.x, p.y + 0.16 * (1 - t * 0.5), p.z + (rand() - 0.5) * 0.2] as V3, s: 0.1 + rand() * 0.12 };
    });
  }, [branch]);
  return (
    <group>
      <mesh position={[-7.5, 6, 24.3]} castShadow>
        <cylinderGeometry args={[0.55, 0.85, 12, 16]} />
        <meshStandardMaterial map={bark} roughness={0.95} />
      </mesh>
      {[
        [-7.4, 12.4, 24.2, 2.6],
        [-5.8, 11.6, 23.4, 2],
        [-8.8, 11.2, 25.2, 2.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 3]} />
          <meshStandardMaterial color={['#7a9c4a', '#8fb157', '#6a8a40'][i]} roughness={0.9} bumpMap={mossTexture()} bumpScale={4} />
        </mesh>
      ))}
      <mesh geometry={branch.g} castShadow receiveShadow>
        <meshStandardMaterial map={bark} roughness={0.95} />
      </mesh>
      {tufts.map((t, i) => (
        <mesh key={i} position={t.p} scale={[t.s * 1.6, t.s * 0.7, t.s * 1.3]} castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={i % 3 ? '#6f8f3f' : '#86a64c'} map={mossTexture()} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export default function Forest({ showBranch, stoneGlow }: { showBranch: boolean; stoneGlow: React.MutableRefObject<number> }) {
  const bark = useMemo(barkTexture, []);
  const layout = useMemo(() => {
    const rand = seeded(29);
    const pathSegs = HUB_PATHS.flatMap((c) => {
      const pts = c.getSpacedPoints(8);
      return pts.slice(1).map((p, i) => [new THREE.Vector2(pts[i].x, pts[i].z), new THREE.Vector2(p.x, p.z)] as const);
    });
    const flightSegs = FLIGHT.getSpacedPoints(12)
      .slice(1)
      .map((p, i, arr) => {
        const prev = i === 0 ? FLIGHT.getPointAt(0) : arr[i - 1];
        return [new THREE.Vector2(prev.x, prev.z), new THREE.Vector2(p.x, p.z)] as const;
      });
    const hubs = ROOMS.map((r) => new THREE.Vector2(r.position[0], r.position[2]));
    const clear = (x: number, z: number, hubGap: number, pathGap: number, flightGap: number) => {
      const p = new THREE.Vector2(x, z);
      if (p.distanceTo(new THREE.Vector2(STONE.x, STONE.z)) < 3) return false;
      if (hubs.some((h) => p.distanceTo(h) < hubGap)) return false;
      if (!pathSegs.every(([a, b]) => distToSegment(p, a, b) > pathGap)) return false;
      return flightSegs.every(([a, b]) => distToSegment(p, a, b) > flightGap);
    };

    const greens = [
      ['#7a9c4a', '#8fb157', '#6a8a40'],
      ['#82a352', '#98b964', '#71914a'],
      ['#6f9245', '#86a852', '#628440'],
    ];
    const trees: TreeSpec[] = [];
    // The ring of tall trees around the clearing.
    for (let tries = 0; trees.length < 34 && tries < 3000; tries++) {
      const a = rand() * Math.PI * 2;
      const r = 15 + rand() * 26;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 1;
      if (!clear(x, z, 6.5, 2.4, 3.2)) continue;
      if (trees.some((t) => Math.hypot(t.p.x - x, t.p.z - z) < 3.6)) continue;
      trees.push({ p: new THREE.Vector3(x, 0, z), h: 11 + rand() * 7, r: 0.4 + rand() * 0.25, tones: greens[Math.floor(rand() * 3)], lean: (rand() - 0.5) * 0.06 });
    }
    // A dense stand Kivi dives through on the way in.
    for (let tries = 0; trees.length < 48 && tries < 3000; tries++) {
      const x = (rand() - 0.5) * 16;
      const z = 12.5 + rand() * 7;
      if (!clear(x, z, 6, 1.6, 2.4)) continue;
      if (trees.some((t) => Math.hypot(t.p.x - x, t.p.z - z) < 2.6)) continue;
      trees.push({ p: new THREE.Vector3(x, 0, z), h: 7 + rand() * 4, r: 0.28 + rand() * 0.15, tones: greens[Math.floor(rand() * 3)], lean: (rand() - 0.5) * 0.08 });
    }
    const ferns: { p: THREE.Vector3; s: number; a: number }[] = [];
    for (let tries = 0; ferns.length < 140 && tries < 4000; tries++) {
      const x = (rand() - 0.5) * 40;
      const z = (rand() - 0.5) * 34 + 3;
      if (!clear(x, z, 4.4, 1.0, 0)) continue;
      ferns.push({ p: new THREE.Vector3(x, 0.05, z), s: 0.7 + rand() * 0.9, a: rand() * Math.PI });
    }
    const rocks = Array.from({ length: 30 }, () => {
      const x = (rand() - 0.5) * 36;
      const z = (rand() - 0.5) * 30 + 2;
      return { x, z, s: 0.25 + rand() * 0.6, rot: rand() * 3, ok: clear(x, z, 4.6, 1.1, 1.5) };
    }).filter((r) => r.ok);
    return { trees, ferns, rocks };
  }, []);

  return (
    <group>
      <SkyDome />
      <Ground />
      {HUB_PATHS.map((c, i) => (
        <Path key={i} curve={c} />
      ))}
      <GlowStone bright={stoneGlow} />
      {layout.trees.map((t, i) => (
        <ForestTree key={i} spec={t} bark={bark} />
      ))}
      <Ferns spots={layout.ferns} />
      {layout.rocks.map((r, i) => (
        <mesh key={i} position={[r.x, r.s * 0.3, r.z]} rotation={[r.rot, r.rot * 2, 0]} scale={[r.s * 1.3, r.s * 0.8, r.s]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 2]} />
          <meshStandardMaterial color="#8f8b82" map={mossTexture()} roughness={0.95} />
        </mesh>
      ))}
      <GeoDome p={[-17, -3, -32]} r={11} />
      <GeoDome p={[3, -4, -42]} r={15} />
      <GeoDome p={[21, -3, -30]} r={10} />
      <SunShafts />
      <group visible={showBranch}>
        <BranchTree bark={bark} />
      </group>
    </group>
  );
}
