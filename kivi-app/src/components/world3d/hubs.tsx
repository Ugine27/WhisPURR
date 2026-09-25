import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { Activity, Outfit, Pose } from './Kiwi3D';
import { Model, usePBR } from './assets';
import { B, canvasTexture, Cyl, Mug, useGlow } from './kit';
import { wind } from './nature';
import { seeded, V3 } from './util';

/*
 * Kivi's hubs. Each is a building with a furnished interior. To add a hub,
 * write its scene below and append an entry to ROOMS: the map, labels,
 * camera moves, Kivi's route, outfit and the hub's panel all come from it.
 *
 * Coordinates inside a hub are its own: the front door faces +z.
 */

export interface HubRefs {
  lit: React.MutableRefObject<number>; // 0..1: hovered or occupied
  open: React.MutableRefObject<number>; // 0..1: front dissolved for the camera
  door: React.MutableRefObject<number>; // 0..1: door open
}

export interface RoomDef {
  id: string;
  persona: string;
  label: string;
  chip: string;
  outfit: Outfit;
  activity: Activity;
  pose: Pose;
  icon: 'office' | 'cafe' | 'dev';
  position: V3;
  rotation: number;
  footprint: number; // radius the terrain is flattened under
  labelY: number;
  doorstep: V3;
  entry: V3;
  approach: V3[];
  seat: { position: V3; yaw: number };
  focus: V3; // Kivi's device; the hub panel grows from here
  camera: { position: V3; look: V3 };
  arrival: { position: V3; look: V3 };
  Scene: (props: HubRefs) => JSX.Element;
}

/* ------------------------------ shared pieces ------------------------------ */

// Fades a group's materials together; hides it once fully transparent.
function useFade(group: React.RefObject<THREE.Group>, amount: React.MutableRefObject<number>) {
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const a = 1 - amount.current;
    g.visible = a > 0.01;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!m || Array.isArray(m)) return;
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
      const base = m.userData.baseOpacity as number;
      const fading = a < 0.999;
      const want = fading || base < 1 || !!(m as THREE.MeshPhysicalMaterial).transmission;
      if (m.transparent !== want) {
        m.transparent = want;
        m.needsUpdate = true;
      }
      m.opacity = base * a;
      m.depthWrite = !fading && base >= 1;
    });
  });
}

// Keep only the triangles of a geometry whose centre passes `keep`.
function filterTriangles(src: THREE.BufferGeometry, keep: (c: THREE.Vector3) => boolean) {
  const g = src.index ? src.toNonIndexed() : src;
  const out = new THREE.BufferGeometry();
  const c = new THREE.Vector3();
  const a = new THREE.Vector3();
  const names = Object.keys(g.attributes);
  const data: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(a.fromBufferAttribute(pos, i + k));
    c.divideScalar(3);
    if (!keep(c)) continue;
    for (const n of names) {
      const attr = g.attributes[n] as THREE.BufferAttribute;
      for (let k = 0; k < 3; k++) for (let d = 0; d < attr.itemSize; d++) data[n].push(attr.getComponent(i + k, d));
    }
  }
  for (const n of names) out.setAttribute(n, new THREE.Float32BufferAttribute(data[n], (g.attributes[n] as THREE.BufferAttribute).itemSize));
  return out;
}

function archShape(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

function Stones({ r, count, seed, skipFront }: { r: number; count: number; seed: number; skipFront?: boolean }) {
  const rock = usePBR('mossy_rock', [1, 1]);
  const stones = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.1;
      return { a, s: 0.22 + rand() * 0.2, x: Math.cos(a) * r, z: Math.sin(a) * r, tilt: rand() };
    }).filter((st) => !(skipFront && st.z > r * 0.75 && Math.abs(st.x) < 1.4));
  }, [r, count, seed, skipFront]);
  return (
    <>
      {stones.map((st, i) => (
        <mesh key={i} position={[st.x, st.s * 0.3, st.z]} rotation={[st.tilt, st.a, 0]} scale={[st.s * 1.4, st.s * 0.8, st.s]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 2]} />
          <meshStandardMaterial {...rock} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------------------------- Office --------------------------------- */
// A geodesic glass-and-steel dome set into a mossy rock face.

const OFFICE_R = 4.3;
const officeFront = (c: THREE.Vector3) => c.z > OFFICE_R * 0.42 && Math.abs(c.x) < OFFICE_R * 0.85;
const officeHole = (c: THREE.Vector3) => Math.abs(c.x) < 0.75 && c.y < 2.35;

function inlayTexture() {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#0b1a24';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(125,211,230,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.roundRect(40 + i * 76, 90, 56, 56, 12);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(125,211,230,0.35)';
    ctx.fillRect(40, 190, 432, 4);
  });
}

// One steel strut per unique triangle edge.
function edgeStruts(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const seen = new Set<string>();
  const out: THREE.Matrix4[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const key = (v: THREE.Vector3) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  for (let i = 0; i < pos.count; i += 3)
    for (const [p, q] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      a.fromBufferAttribute(pos, i + p);
      b.fromBufferAttribute(pos, i + q);
      const k = [key(a), key(b)].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      out.push(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(0.045, len, 0.045)));
    }
  return out;
}

function Struts({ geo }: { geo: THREE.BufferGeometry }) {
  const mats = useMemo(() => edgeStruts(geo), [geo]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    mats.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [mats]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]} castShadow>
      <cylinderGeometry args={[1, 1, 1, 8]} />
      <meshStandardMaterial color="#9aa2a8" metalness={1} roughness={0.28} />
    </instancedMesh>
  );
}

function GlassPane({ geo }: { geo: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial color="#eef6f2" transmission={1} ior={1.5} thickness={0.04} roughness={0.04} metalness={0} envMapIntensity={1.4} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

function OfficeScene({ lit, open, door }: HubRefs) {
  const floor = usePBR('dark_wood', [3, 3]);
  const inlay = useMemo(inlayTexture, []);
  const front = useRef<THREE.Group>(null);
  const slide = useRef<THREE.Group>(null);
  const lamps = useRef<(THREE.PointLight | null)[]>([]);
  const glow = useGlow(lit, 0.4, 1);
  useFade(front, open);
  useFrame(() => {
    if (slide.current) slide.current.position.x = door.current * 1.3;
    lamps.current.forEach((l) => l && (l.intensity = 3 + glow.current * 3));
  });
  const { back, frontGeo } = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(OFFICE_R, 2);
    const upper = filterTriangles(ico, (c) => c.y > 0.05);
    return { back: filterTriangles(upper, (c) => !officeFront(c)), frontGeo: filterTriangles(upper, (c) => officeFront(c) && !officeHole(c)) };
  }, []);
  const chair = (p: V3, yaw: number) => <Model name="dining_chair_02" position={p} rotation={[0, yaw, 0]} />;
  return (
    <group>
      {/* The rock face the dome is built into, with mossy boulders */}
      <Model name="rock_face_01" position={[-1.4, -0.3, -OFFICE_R - 0.2]} rotation={[0, 0.15, 0]} scale={1.9} />
      <Model name="rock_face_01" position={[3.3, -0.3, -OFFICE_R + 1.2]} rotation={[0, -0.7, 0]} scale={1.5} />
      <Model name="rock_moss_set_02" position={[-OFFICE_R - 0.4, 0, 0.6]} rotation={[0, 1.3, 0]} scale={0.6} />

      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[OFFICE_R - 0.05, 72]} />
        <meshPhysicalMaterial {...floor} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[OFFICE_R - 0.05, OFFICE_R + 0.25, 72]} />
        <meshStandardMaterial color="#8f949a" metalness={0.6} roughness={0.35} />
      </mesh>

      <GlassPane geo={back} />
      <Struts geo={back} />
      <group ref={front}>
        <GlassPane geo={frontGeo} />
        <Struts geo={frontGeo} />
        <group ref={slide} position={[0, 0, OFFICE_R - 0.35]}>
          {/* A slim steel frame around a glass door */}
          <B s={[1.4, 0.06, 0.06]} p={[0, 2.27, 0]} r={0.02} c="#9aa2a8" metal={1} rough={0.3} />
          <B s={[1.4, 0.06, 0.06]} p={[0, 0.03, 0]} r={0.02} c="#9aa2a8" metal={1} rough={0.3} />
          {[-0.67, 0.67].map((x) => (
            <B key={x} s={[0.06, 2.3, 0.06]} p={[x, 1.15, 0]} r={0.02} c="#9aa2a8" metal={1} rough={0.3} />
          ))}
          <B s={[0.03, 0.4, 0.05]} p={[-0.5, 1.1, 0.05]} r={0.01} c="#c9ced4" metal={1} rough={0.2} />
          <mesh position={[0, 1.15, 0.0]}>
            <planeGeometry args={[1.25, 2.15]} />
            <meshPhysicalMaterial color="#eef6f2" transmission={1} ior={1.5} thickness={0.02} roughness={0.04} transparent />
          </mesh>
        </group>
      </group>

      {/* Conference room behind a glass screen */}
      <mesh position={[-1.55, 1.2, -0.75]}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshPhysicalMaterial color="#eef6f2" transmission={1} ior={1.5} thickness={0.02} roughness={0.06} side={THREE.DoubleSide} transparent />
      </mesh>
      <B s={[3.2, 0.05, 0.06]} p={[-1.55, 2.42, -0.75]} r={0.02} c="#9aa2a8" metal={1} rough={0.3} />
      <Model name="dining_table" position={[-1.6, 0, -2.1]} rotation={[0, 0.05, 0]} />
      {[-2.4, -1.6, -0.8].map((x) => (
        <group key={x}>
          {chair([x, 0, -1.3], Math.PI)}
          {chair([x, 0, -2.9], 0)}
        </group>
      ))}

      {/* Mahogany desk with a digital inlay; laptop and lamp */}
      <B s={[2.2, 0.07, 0.95]} p={[1.35, 0.76, 0.5]} r={0.03} c="#5a1f14" rough={0.22} />
      <B s={[2.1, 0.62, 0.85]} p={[1.35, 0.41, 0.5]} r={0.03} c="#4a1a10" rough={0.35} />
      <mesh position={[1.0, 0.797, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.28]} />
        <meshStandardMaterial map={inlay} emissiveMap={inlay} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.2} />
      </mesh>
      <Model name="classic_laptop" position={[1.45, 0.795, 0.45]} rotation={[0, Math.PI, 0]} />
      <Model name="desk_lamp_arm_01" position={[0.5, 0.795, 0.3]} rotation={[0, 2.4, 0]} />
      <group position={[1.4, 0, -0.35]}>
        <B s={[0.52, 0.08, 0.5]} p={[0, 0.46, 0]} r={0.035} c="#1f1f22" rough={0.5} />
        <B s={[0.52, 0.58, 0.07]} p={[0, 0.8, -0.24]} r={0.035} c="#1f1f22" rough={0.5} />
        <Cyl r={0.025} h={0.42} p={[0, 0.21, 0]} c="#9aa0a6" metal={0.9} rough={0.25} />
      </group>

      <Model name="potted_plant_02" position={[-3.1, 0, 1.6]} scale={1.6} />
      <Model name="potted_plant_02" position={[3.1, 0, 1.2]} rotation={[0, 2, 0]} scale={1.3} />
      <Model name="potted_plant_04" position={[2.2, 0.795, 0.75]} scale={1.2} />

      {[-1.2, 1.2].map((x, i) => (
        <pointLight key={x} ref={(l) => (lamps.current[i] = l)} position={[x, 3.2, 0]} color="#f4f8ff" intensity={3} distance={7} decay={1.4} />
      ))}
    </group>
  );
}

/* ----------------------------------- Café ---------------------------------- */
// A hobbit-hole: an earthen mound with a round door and glowing windows.

const CAFE_R = 4.4;
const CAFE_SQUASH = 0.62;
const CAFE_FACE_Z = 2.9;

function Smoke({ p }: { p: V3 }) {
  const g = useRef<THREE.Group>(null);
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx) => {
        const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(235,235,230,0.8)');
        gr.addColorStop(1, 'rgba(235,235,230,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, 64, 64);
      }),
    [],
  );
  useFrame(() => {
    const t = wind.value;
    g.current?.children.forEach((c, i) => {
      const u = (t * 0.12 + i / 8) % 1;
      c.position.set(Math.sin(u * 5 + i) * 0.2 + u * 0.8, u * 3.2, Math.cos(u * 4 + i) * 0.15);
      c.scale.setScalar(0.35 + u * 1.4);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.35 * Math.sin(u * Math.PI);
    });
  });
  return (
    <group ref={g} position={p}>
      {Array.from({ length: 8 }, (_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

function CafeScene({ lit, open, door }: HubRefs) {
  const moss = usePBR('forrest_ground_01', [5, 3]);
  const plaster = usePBR('clay_plaster', [4, 2]);
  const stone = usePBR('mossy_rock', [2, 1.2]);
  const tiles = usePBR('old_mosaic_floor', [3, 3]);
  const front = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const windows = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const glow = useGlow(lit, 0.5, 1);
  useFade(front, open);
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.y = door.current * 1.6;
    windows.current.forEach((m) => m && (m.emissiveIntensity = 1.2 + glow.current * 1.6));
    lights.current.forEach((l) => l && (l.intensity = 2.4 + glow.current * 2.4));
  });

  const { shell, face } = useMemo(() => {
    const s = new THREE.SphereGeometry(CAFE_R, 80, 40, 0, Math.PI * 2, 0, Math.PI / 2);
    s.scale(1, CAFE_SQUASH, 1);
    const shell = filterTriangles(s, (c) => c.z < CAFE_FACE_Z);
    // The flat front: a stone wall with a round door and two round windows.
    const rx = Math.sqrt(CAFE_R * CAFE_R - CAFE_FACE_Z * CAFE_FACE_Z);
    const ry = rx * CAFE_SQUASH * 1.25;
    const sh = new THREE.Shape();
    sh.absellipse(0, 0, rx, ry, 0, Math.PI, false);
    sh.lineTo(-rx, 0);
    const doorHole = new THREE.Path();
    doorHole.absarc(0, 1.0, 0.82, 0, Math.PI * 2, true);
    sh.holes.push(doorHole);
    for (const x of [-1.9, 1.9]) {
      const p = new THREE.Path();
      p.absarc(x, 1.2, 0.42, 0, Math.PI * 2, true);
      sh.holes.push(p);
    }
    const face = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 48 });
    const uv = face.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
    return { shell, face };
  }, []);

  const doorLeaf = useMemo(() => {
    const c = new THREE.Shape();
    c.absarc(0, 0, 0.8, 0, Math.PI * 2, false);
    const g = new THREE.ExtrudeGeometry(c, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48 });
    g.translate(0.8, 0, -0.04);
    return g;
  }, []);
  const planks = useMemo(
    () =>
      canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#3f6b4a';
        ctx.fillRect(0, 0, 256, 256);
        for (let x = 0; x < 256; x += 32) {
          ctx.fillStyle = `rgba(0,0,0,${0.12 + (x % 64 ? 0.05 : 0)})`;
          ctx.fillRect(x, 0, 3, 256);
        }
      }),
    [],
  );

  const greenery = useMemo(() => {
    const rand = seeded(12);
    const out: { p: V3; r: number; s: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * CAFE_R * 0.92;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (z > CAFE_FACE_Z - 0.3) continue;
      const y = CAFE_SQUASH * Math.sqrt(Math.max(0, CAFE_R * CAFE_R - x * x - z * z));
      out.push({ p: [x, y - 0.03, z], r: rand() * 6, s: 0.5 + rand() * 0.5 });
    }
    return out;
  }, []);

  const ribs = useMemo(
    () =>
      [-0.9, -0.3, 0.3, 0.9].map((a) => {
        const pts = Array.from({ length: 20 }, (_, i) => {
          const th = (i / 19) * Math.PI - Math.PI / 2;
          const r = CAFE_R - 0.12;
          return new THREE.Vector3(Math.sin(th) * r * Math.cos(a), Math.cos(th) * r * CAFE_SQUASH * 0.98, Math.sin(th) * r * Math.sin(a));
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 8, false);
      }),
    [],
  );

  return (
    <group>
      {/* Earth mound, mossy and planted over */}
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial {...moss} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={shell} scale={0.985} receiveShadow>
        <meshStandardMaterial {...plaster} side={THREE.BackSide} />
      </mesh>
      {greenery.map((g, i) => (
        <Model key={i} name={i % 3 ? 'shrub_04' : 'fern_02'} position={g.p} rotation={[0, g.r, 0]} scale={i % 3 ? g.s * 1.6 : g.s * 0.6} />
      ))}
      <Cyl r={0.28} top={0.24} h={1.3} p={[1.6, CAFE_R * CAFE_SQUASH - 0.1, -0.8]} c="#8a8074" rough={0.9} />
      <Smoke p={[1.6, CAFE_R * CAFE_SQUASH + 0.6, -0.8]} />

      {/* Stone front with a round door and windows; it fades to let you in */}
      <group ref={front}>
        <mesh geometry={face} position={[0, 0, CAFE_FACE_Z - 0.1]} castShadow receiveShadow>
          <meshStandardMaterial {...stone} />
        </mesh>
        {[-1.9, 1.9].map((x, i) => (
          <group key={x} position={[x, 1.2, CAFE_FACE_Z + 0.1]}>
            <mesh>
              <circleGeometry args={[0.42, 40]} />
              <meshStandardMaterial ref={(m) => (windows.current[i] = m)} color="#ffe2b0" emissive="#ffb760" emissiveIntensity={1.4} roughness={0.2} />
            </mesh>
            <B s={[0.84, 0.04, 0.04]} p={[0, 0, 0.03]} r={0.01} c="#3f6b4a" />
            <B s={[0.04, 0.84, 0.04]} p={[0, 0, 0.03]} r={0.01} c="#3f6b4a" />
            <mesh position={[0, 0, 0.02]}>
              <torusGeometry args={[0.44, 0.05, 10, 40]} />
              <meshStandardMaterial color="#3f6b4a" roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.0, CAFE_FACE_Z + 0.26]}>
          <torusGeometry args={[0.86, 0.07, 12, 56]} />
          <meshStandardMaterial color="#6b4a2e" roughness={0.6} />
        </mesh>
        <group ref={hinge} position={[-0.8, 1.0, CAFE_FACE_Z + 0.2]}>
          <mesh geometry={doorLeaf} castShadow>
            <meshStandardMaterial map={planks} roughness={0.6} />
          </mesh>
          <mesh position={[0.8, 0, 0.08]} castShadow>
            <sphereGeometry args={[0.07, 20, 20]} />
            <meshStandardMaterial color="#c8a36a" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>
      </group>
      <mesh position={[0, 1.0, CAFE_FACE_Z - 0.3]}>
        <circleGeometry args={[0.82, 40]} />
        <meshBasicMaterial color="#ffc27a" toneMapped={false} />
      </mesh>
      <group position={[1.35, 0, CAFE_FACE_Z + 0.9]}>
        <Cyl r={0.04} h={2.1} p={[0, 1.05, 0]} c="#3a302a" rough={0.5} />
        <B s={[0.5, 0.05, 0.05]} p={[-0.22, 2.05, 0]} r={0.015} c="#3a302a" />
        <Model name="caged_hanging_light" position={[-0.42, 2.02, 0]} scale={0.8} />
        <pointLight position={[-0.42, 1.6, 0]} color="#ffb46a" intensity={2} distance={4} decay={1.6} />
      </group>
      <Model name="rock_moss_set_01" position={[-CAFE_R + 0.2, 0, 1.8]} rotation={[0, 0.8, 0]} scale={0.32} />

      {/* Inside: wooden ribs, mosaic floor, coffee cart, vintage seats */}
      {ribs.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#6b4a2e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[CAFE_R - 0.1, 72]} />
        <meshStandardMaterial {...tiles} />
      </mesh>
      <Model name="CoffeeCart_01" position={[0.3, 0, -2.6]} rotation={[0, 0.05, 0]} scale={1.05} />
      <Model name="ArmChair_01" position={[1.35, 0, 0.35]} rotation={[0, -0.75 + Math.PI, 0]} />
      <Model name="ArmChair_01" position={[-1.9, 0, 0.1]} rotation={[0, 0.9 + Math.PI, 0]} tint="#8fa8a0" />
      <Model name="Sofa_01" position={[-1.2, 0, 2.0]} rotation={[0, Math.PI + 0.3, 0]} />
      <Model name="coffee_table_round_01" position={[0.35, 0, 0.9]} scale={0.75} />
      <Model name="round_wooden_table_01" position={[-1.6, 0, -1.3]} scale={0.8} />
      <Mug p={[0.45, 0.37, 0.8]} c="#f4efe7" steam={glow} />
      <Model name="potted_plant_02" position={[2.7, 0, -1.4]} rotation={[0, 1.2, 0]} scale={1.3} />
      <Model name="potted_plant_02" position={[-3.0, 0, -0.6]} scale={1.1} />
      <Model name="potted_plant_04" position={[-1.6, 0.8, -1.3]} scale={1.3} />
      {[-1.1, 0.2, 1.4].map((x, i) => (
        <group key={x} position={[x, CAFE_R * CAFE_SQUASH - 0.35, -0.8 + (i % 2) * 0.9]}>
          <Model name="caged_hanging_light" position={[0, 0, 0]} scale={0.7} />
          <pointLight ref={(l) => (lights.current[i] = l)} position={[0, -0.45, 0]} color="#ffbf74" intensity={2.4} distance={4.5} decay={1.5} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------ Developer room ----------------------------- */
// A sleek metal pod with fibre-optic veins pulsing across its skin.

const DEV_R = 4.0;
const DEV_SQUASH = 0.72;
const DEV_FACE_Z = 2.5;

function veinTexture() {
  const rand = seeded(61);
  const t = canvasTexture(1024, 512, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      for (let i = 0; i < 6; i++) {
        a += (rand() - 0.5) * 0.5;
        cx += Math.cos(a) * (len / 6);
        cy += Math.sin(a) * (len / 6);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      if (depth > 0) for (let k = 0; k < 2; k++) branch(cx, cy, a + (rand() - 0.5) * 1.4, len * 0.6, w * 0.65, depth - 1);
    };
    for (let i = 0; i < 14; i++) branch(rand() * 1024, 512, -Math.PI / 2 + (rand() - 0.5) * 0.6, 220 + rand() * 120, 4, 3);
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Additive glow layer: light pulses travel up the veins.
function VeinLayer({ geo, lit }: { geo: THREE.BufferGeometry; lit: React.MutableRefObject<number> }) {
  const tex = useMemo(veinTexture, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { tVein: { value: tex }, uTime: wind, uLit: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tVein; uniform float uTime; uniform float uLit; varying vec2 vUv;
          void main() {
            float v = texture2D(tVein, vec2(vUv.x * 2.0, vUv.y)).r;
            float pulse = pow(0.5 + 0.5 * sin((vUv.y * 14.0 - uTime * 2.2) + vUv.x * 30.0), 6.0);
            vec3 col = vec3(0.35, 0.9, 1.0) * v * (0.25 + pulse * (1.4 + uLit * 1.6));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [tex],
  );
  useFrame(() => {
    mat.uniforms.uLit.value = lit.current;
  });
  return <mesh geometry={geo} material={mat} scale={1.004} />;
}

function codeTexture(seed: number) {
  const rand = seeded(seed);
  const t = canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 8; y < 512; y += 14) {
      let x = 8 + Math.floor(rand() * 3) * 14;
      const n = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const len = 12 + rand() * 60;
        const g = 120 + Math.floor(rand() * 135);
        ctx.fillStyle = `rgb(${Math.floor(g * 0.35)},${g},${Math.floor(g * 0.5)})`;
        ctx.fillRect(x, y, len, 6);
        x += len + 8;
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function Keyboard({ p, yaw = 0, keys }: { p: V3; yaw?: number; keys: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cols = 14;
  const rows = 4;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color(keys);
    const accent = new THREE.Color('#e8e4dc');
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const i = r * cols + k;
        m.makeTranslation(-0.2 + k * 0.03, 0.022, -0.05 + r * 0.03);
        ref.current!.setMatrixAt(i, m);
        ref.current!.setColorAt(i, (k + r) % 5 === 0 ? accent : c);
      }
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [keys]);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <B s={[0.46, 0.03, 0.15]} p={[0, 0.015, 0]} r={0.01} c="#1f2227" metal={0.4} rough={0.4} />
      <instancedMesh ref={ref} args={[undefined, undefined, rows * cols]}>
        <boxGeometry args={[0.024, 0.016, 0.024]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

// A monitor with two code layers a few millimetres apart: the back layer
// scrolls slowly, the front one faster, so the text reads with depth.
function Monitor({ p, yaw, index, layers, glow }: { p: V3; yaw: number; index: number; layers: [THREE.Texture, THREE.Texture]; glow: React.MutableRefObject<number> }) {
  const back = useRef<THREE.MeshBasicMaterial>(null);
  const texs = useMemo(
    () =>
      layers.map((l, k) => {
        const t = l.clone();
        t.needsUpdate = true;
        t.repeat.set(1, k ? 0.5 : 0.8);
        t.offset.set(0, (index * 0.37 + k * 0.5) % 1);
        return t;
      }),
    [layers, index],
  );
  useFrame((_, dt) => {
    const speed = 1 + glow.current;
    texs[0].offset.y = (texs[0].offset.y + dt * 0.02 * speed) % 1;
    texs[1].offset.y = (texs[1].offset.y + dt * (0.06 + (index % 3) * 0.015) * speed) % 1;
    if (back.current) back.current.opacity = 0.45 + glow.current * 0.2;
  });
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <B s={[0.82, 0.52, 0.05]} p={[0, 0, 0]} r={0.015} c="#0f1216" metal={0.5} rough={0.35} />
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[0.76, 0.46]} />
        <meshBasicMaterial color="#021208" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.76, 0.46]} />
        <meshBasicMaterial ref={back} map={texs[0]} transparent blending={THREE.AdditiveBlending} color="#3f8f5a" toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.038]}>
        <planeGeometry args={[0.76, 0.46]} />
        <meshBasicMaterial map={texs[1]} transparent opacity={0.9} blending={THREE.AdditiveBlending} color="#b8ffc8" toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DevScene({ lit, open, door }: HubRefs) {
  const metal = usePBR('metal_plate', [4, 2]);
  const layers = useMemo(() => [codeTexture(23), codeTexture(57)] as [THREE.Texture, THREE.Texture], []);
  const front = useRef<THREE.Group>(null);
  const slide = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const blue = useRef<THREE.PointLight>(null);
  const glow = useGlow(lit, 0.4, 1);
  useFade(front, open);
  useFrame(() => {
    if (ring.current) ring.current.emissiveIntensity = 1.5 + glow.current * 2;
    if (blue.current) blue.current.intensity = 3 + glow.current * 3;
    if (slide.current) slide.current.position.x = door.current * 1.2;
  });
  const { shell, face } = useMemo(() => {
    const s = new THREE.SphereGeometry(DEV_R, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
    s.scale(1.18, DEV_SQUASH, 1);
    const shell = filterTriangles(s, (c) => c.z < DEV_FACE_Z);
    const k = Math.sqrt(1 - (DEV_FACE_Z / DEV_R) ** 2) * DEV_R;
    const rx = k * 1.18;
    const ry = k * DEV_SQUASH;
    const sh = new THREE.Shape();
    sh.absellipse(0, 0, rx, ry, 0, Math.PI, false);
    sh.lineTo(-rx, 0);
    sh.holes.push(new THREE.Path(archShape(1.3, 2.2).getPoints(40)));
    const face = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 64 });
    const uv = face.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (rx * 2) + 0.5, uv.getY(i) / (rx * 2));
    return { shell, face };
  }, []);

  const monitors = useMemo(() => {
    const out: { p: V3; yaw: number }[] = [];
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 7; k++) {
        const a = -1.0 + (k / 6) * 2.0;
        const r = 3.35 - row * 0.12;
        out.push({ p: [Math.sin(a) * r * 1.1, 1.35 + row * 0.72, -Math.cos(a) * r], yaw: -a });
      }
    return out;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DEV_R, 72]} />
        <meshStandardMaterial color="#161b24" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DEV_R - 0.35, DEV_R - 0.3, 96]} />
        <meshStandardMaterial ref={ring} color="#111" emissive="#4fb3ff" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      {/* Brushed metal skin with pulsing fibre-optic veins */}
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial {...metal} metalness={1} roughness={0.35} envMapIntensity={1.3} />
      </mesh>
      <VeinLayer geo={shell} lit={lit} />
      <mesh geometry={shell} scale={0.985}>
        <meshStandardMaterial color="#121821" roughness={0.6} side={THREE.BackSide} />
      </mesh>

      <group ref={front}>
        <mesh geometry={face} position={[0, 0, DEV_FACE_Z]} castShadow receiveShadow>
          <meshStandardMaterial {...metal} metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.1, DEV_FACE_Z + 0.02]}>
          <planeGeometry args={[1.3, 2.2]} />
          <meshBasicMaterial color="#7fe6ff" toneMapped={false} />
        </mesh>
        <group ref={slide} position={[0, 0, DEV_FACE_Z + 0.2]}>
          <mesh>
            <extrudeGeometry args={[archShape(1.25, 2.15), { depth: 0.05, bevelEnabled: false, curveSegments: 40 }]} />
            <meshStandardMaterial color="#5e666f" metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.2, 0.06]}>
            <planeGeometry args={[0.8, 1.3]} />
            <meshStandardMaterial color="#b8f4ff" emissive="#7fe6ff" emissiveIntensity={1.2} roughness={0.1} transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
      <Stones r={DEV_R * 1.12} count={22} seed={9} skipFront />

      {monitors.map((m, i) => (
        <Monitor key={i} p={m.p} yaw={m.yaw} index={i} layers={layers} glow={glow} />
      ))}
      <pointLight position={[0, 1.8, -1.8]} color="#5cff9a" intensity={2.2} distance={4.5} decay={1.6} />
      <pointLight ref={blue} position={[0, 2.4, 0.4]} color="#5aa7ff" intensity={3} distance={6} decay={1.5} />

      {/* Standing desks, keyboards and a duck */}
      {[
        { x: -0.9, yaw: 0.25 },
        { x: 0.9, yaw: -0.25 },
      ].map((d) => (
        <group key={d.x} position={[d.x, 0, -1.4]} rotation={[0, d.yaw, 0]}>
          <B s={[1.3, 0.05, 0.6]} p={[0, 0.88, 0]} r={0.02} c="#2b2f36" metal={0.3} rough={0.4} />
          {[-0.55, 0.55].map((x) => (
            <B key={x} s={[0.06, 0.86, 0.5]} p={[x, 0.43, 0]} r={0.02} c="#15181d" metal={0.6} rough={0.35} />
          ))}
          <Keyboard p={[0, 0.905, 0.1]} keys={d.x < 0 ? '#e8c77a' : '#9db4ff'} />
        </group>
      ))}
      <Model name="rubber_duck_toy" position={[-1.3, 0.905, -1.3]} rotation={[0, 0.6, 0]} scale={0.6} />

      {/* Circuit boards under glass */}
      <group position={[-1.7, 0, 0.9]} rotation={[0, 0.5, 0]}>
        <B s={[1.1, 0.7, 0.7]} p={[0, 0.35, 0]} r={0.03} c="#1f242c" metal={0.4} rough={0.4} />
        <Model name="circuit_board" position={[-0.15, 0.7, 0]} scale={1.2} />
        <Model name="circuit_board" position={[0.25, 0.7, 0.05]} rotation={[0, 1.2, 0]} scale={1} />
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[1.08, 0.02, 0.68]} />
          <meshPhysicalMaterial color="#ffffff" transmission={1} ior={1.5} thickness={0.02} roughness={0.03} transparent />
        </mesh>
      </group>

      {/* Hardware workshop */}
      <group position={[2.4, 0, 0.5]} rotation={[0, -Math.PI / 2 - 0.35, 0]}>
        <B s={[1.5, 0.06, 0.6]} p={[0, 0.82, 0]} r={0.02} c="#8a6446" rough={0.6} />
        {[-0.65, 0.65].map((x) => (
          <B key={x} s={[0.06, 0.8, 0.5]} p={[x, 0.4, 0]} r={0.02} c="#2b2f36" metal={0.5} />
        ))}
        <Model name="retro_multimeter" position={[0.35, 0.85, 0]} />
        <Model name="circuit_board" position={[-0.3, 0.85, 0.05]} scale={0.8} />
      </group>
      <Model name="tool_cart" position={[2.0, 0, -0.9]} rotation={[0, -1.2, 0]} />
      <Model name="metal_stool_01" position={[1.6, 0, 0.9]} />
      {[-0.9, 0.9].map((x) => (
        <Model key={x} name="hanging_industrial_lamp" position={[x, DEV_R * DEV_SQUASH - 0.25, -0.9]} scale={0.8} />
      ))}
      <Sparkles count={20} scale={[5, 2, 5]} position={[0, 1.5, 0]} size={2} speed={0.2} color="#7de7f0" />
    </group>
  );
}

/* ---------------------------------- Data ----------------------------------- */

export const ROOMS: RoomDef[] = [
  {
    id: 'office',
    persona: 'Formal',
    label: 'Office',
    chip: 'Professional',
    outfit: 'suit',
    activity: 'type',
    pose: 'sit',
    icon: 'office',
    position: [-6.9, 0, -2.8],
    rotation: 0.5,
    footprint: OFFICE_R + 0.8,
    labelY: OFFICE_R + 0.6,
    doorstep: [0, 0, OFFICE_R + 1.1],
    entry: [0, 0, OFFICE_R - 1.2],
    approach: [
      [2.5, 0, 1.6],
      [2.5, 0, -0.4],
      [1.4, 0, -0.35],
    ],
    seat: { position: [1.4, 0.34, -0.35], yaw: 0 },
    focus: [1.45, 0.95, 0.5],
    camera: { position: [-0.9, 1.9, 2.9], look: [0.9, 1.0, -0.4] },
    arrival: { position: [-1.4, 2.0, 9.2], look: [0, 1.4, OFFICE_R - 0.5] },
    Scene: OfficeScene,
  },
  {
    id: 'cafe',
    persona: 'Casual',
    label: 'Café',
    chip: 'Casual',
    outfit: 'casual',
    activity: 'sip',
    pose: 'sit',
    icon: 'cafe',
    position: [5.4, 0, -5.2],
    rotation: -0.4,
    footprint: CAFE_R + 0.8,
    labelY: CAFE_R * CAFE_SQUASH + 1.3,
    doorstep: [0, 0, CAFE_FACE_Z + 1.3],
    entry: [0, 0, CAFE_FACE_Z - 1.0],
    approach: [
      [0.9, 0, 1.2],
      [1.35, 0, 0.8],
    ],
    seat: { position: [1.35, 0.34, 0.35], yaw: -0.75 },
    focus: [0.45, 0.5, 0.8],
    camera: { position: [-0.9, 1.7, 2.4], look: [0.6, 0.95, -0.1] },
    arrival: { position: [-1.5, 1.9, 9.6], look: [0, 1.2, CAFE_FACE_Z] },
    Scene: CafeScene,
  },
  {
    id: 'dev',
    persona: 'Developer',
    label: 'Developer',
    chip: 'Developer',
    outfit: 'dev',
    activity: 'type',
    pose: 'stand',
    icon: 'dev',
    position: [7.0, 0, 2.8],
    rotation: -1.2,
    footprint: DEV_R * 1.18 + 0.8,
    labelY: DEV_R * DEV_SQUASH + 1.1,
    doorstep: [0, 0, DEV_FACE_Z + 1.4],
    entry: [0, 0, DEV_FACE_Z - 0.9],
    approach: [
      [0.4, 0, 0.3],
      [0.9, 0, -0.85],
    ],
    seat: { position: [0.9, 0, -0.85], yaw: Math.PI + 0.25 },
    focus: [0.9, 1.3, -1.4],
    camera: { position: [-1.3, 1.65, 1.7], look: [0.3, 1.15, -1.4] },
    arrival: { position: [-1.4, 1.8, 8.6], look: [0, 1.1, DEV_FACE_Z] },
    Scene: DevScene,
  },
];
