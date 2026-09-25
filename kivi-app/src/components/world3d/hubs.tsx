import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { Activity, Outfit, Pose } from './Kiwi3D';
import { B, canvasTexture, Cyl, Mug, Plant, useGlow, woodTexture } from './kit';
import { seeded, V3 } from './util';

/*
 * Kivi's hubs. Each is a small building in the forest with a furnished
 * interior. To add a hub, write its scene below and append an entry to ROOMS:
 * the map, labels, camera moves, Kivi's route, outfit and the hub's panel all
 * come from this data.
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
  persona: string; // mode id used by the app (see useKiviInput MODES)
  label: string;
  chip: string;
  outfit: Outfit;
  activity: Activity;
  pose: Pose;
  icon: 'office' | 'cafe' | 'dev';
  position: V3;
  rotation: number;
  labelY: number;
  doorstep: V3;
  entry: V3;
  approach: V3[];
  seat: { position: V3; yaw: number };
  focus: V3;
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
      const wantTransparent = fading || base < 1;
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent;
        m.needsUpdate = true;
      }
      m.opacity = base * a;
      m.depthWrite = !fading && base >= 1;
    });
  });
}

let moss: THREE.CanvasTexture | null = null;
export function mossTexture() {
  if (moss) return moss;
  const rand = seeded(77);
  moss = canvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#5d7a37';
      ctx.fillRect(0, 0, 256, 256);
      const tones = ['#6f8f3f', '#4d6a2c', '#7fa048', '#58763a', '#8aa955'];
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.globalAlpha = 0.35 + rand() * 0.5;
        ctx.beginPath();
        ctx.arc(rand() * 256, rand() * 256, 1 + rand() * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [4, 3],
  );
  return moss;
}

function Glass({ w, h, p, rot }: { w: number; h: number; p: V3; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <planeGeometry args={[w, h]} />
      <meshPhysicalMaterial color="#e4eef0" roughness={0.04} metalness={0.1} transparent opacity={0.16} envMapIntensity={2.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// A glass curtain wall along the x axis: mullions, rails and panes.
function GlassWall({ length, height, p, rot, gap }: { length: number; height: number; p: V3; rot?: V3; gap?: [number, number] }) {
  const bays = Math.max(2, Math.round(length / 1.2));
  const bw = length / bays;
  return (
    <group position={p} rotation={rot}>
      <B s={[length, 0.08, 0.1]} p={[0, 0.04, 0]} r={0.02} c="#2b2f33" metal={0.6} rough={0.35} />
      <B s={[length, 0.08, 0.1]} p={[0, height - 0.04, 0]} r={0.02} c="#2b2f33" metal={0.6} rough={0.35} />
      {Array.from({ length: bays + 1 }, (_, i) => (
        <B key={i} s={[0.06, height, 0.1]} p={[-length / 2 + i * bw, height / 2, 0]} r={0.015} c="#2b2f33" metal={0.6} rough={0.35} />
      ))}
      {Array.from({ length: bays }, (_, i) => {
        const cx = -length / 2 + (i + 0.5) * bw;
        if (gap && cx > gap[0] && cx < gap[1]) return null;
        return <Glass key={i} w={bw - 0.06} h={height - 0.16} p={[cx, height / 2, 0]} />;
      })}
    </group>
  );
}

// A dome sliced into a back part that always stays and a front part that can
// fade. Triangles inside `hole` (x/y extents) are removed to leave a doorway.
function domeGeometry(r: number, squash: number, keep: (c: THREE.Vector3) => boolean) {
  const g = new THREE.SphereGeometry(r, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  g.scale(1, squash, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const outP: number[] = [];
  const outN: number[] = [];
  const outU: number[] = [];
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(pos, i + k));
    c.divideScalar(3);
    if (!keep(c)) continue;
    for (let k = 0; k < 3; k++) {
      outP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      outN.push(nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k));
      outU.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(outU, 2));
  return out;
}

function MossDome({ r, squash, inner, front }: { r: number; squash: number; inner: string; front: (c: THREE.Vector3) => boolean }) {
  const back = useMemo(() => domeGeometry(r, squash, (c) => !front(c)), [r, squash, front]);
  return (
    <group>
      <mesh geometry={back} castShadow receiveShadow>
        <meshStandardMaterial map={mossTexture()} bumpMap={mossTexture()} bumpScale={3} roughness={1} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={back} scale={0.985} receiveShadow>
        <meshStandardMaterial color={inner} roughness={0.95} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function MossDomeFront({ r, squash, inner, front, hole }: { r: number; squash: number; inner: string; front: (c: THREE.Vector3) => boolean; hole: (c: THREE.Vector3) => boolean }) {
  const geo = useMemo(() => domeGeometry(r, squash, (c) => front(c) && !hole(c)), [r, squash, front, hole]);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={mossTexture()} bumpMap={mossTexture()} bumpScale={3} roughness={1} />
      </mesh>
      <mesh geometry={geo} scale={0.985}>
        <meshStandardMaterial color={inner} roughness={0.95} side={THREE.BackSide} />
      </mesh>
    </group>
  );
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

function RoundDoor({ w, h, color, glass, door, glow }: { w: number; h: number; color: string; glass?: string; door: React.MutableRefObject<number>; glow: string }) {
  const hinge = useRef<THREE.Group>(null);
  const leaf = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(archShape(w - 0.06, h - 0.03), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 40 });
    g.translate((w - 0.06) / 2, 0, -0.04);
    return g;
  }, [w, h]);
  const frame = useMemo(() => {
    const outer = archShape(w + 0.3, h + 0.15);
    outer.holes.push(new THREE.Path(archShape(w, h).getPoints(40)));
    return new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 40 });
  }, [w, h]);
  useFrame(() => {
    // Swings inward, away from the viewer.
    if (hinge.current) hinge.current.rotation.y = door.current * 1.7;
  });
  return (
    <group>
      <mesh geometry={frame} position={[0, 0, -0.12]} castShadow>
        <meshStandardMaterial color="#b3a894" roughness={0.9} />
      </mesh>
      <mesh position={[0, h / 2, -0.08]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <group ref={hinge} position={[-(w - 0.06) / 2, 0.015, 0]}>
        <mesh geometry={leaf} castShadow>
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        {glass && (
          <mesh position={[(w - 0.06) / 2, h * 0.68, 0.05]}>
            <circleGeometry args={[w * 0.18, 28]} />
            <meshStandardMaterial color={glass} emissive={glass} emissiveIntensity={0.8} roughness={0.1} />
          </mesh>
        )}
        <mesh position={[w - 0.22, h * 0.45, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.07, 16]} />
          <meshStandardMaterial color="#c8a36a" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function Armchair({ p, yaw, color }: { p: V3; yaw: number; color: string }) {
  const velvet = { color, roughness: 0.9, sheen: 1, sheenColor: '#ffffff', sheenRoughness: 0.4 };
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <RoundedBox args={[0.95, 0.2, 0.85]} radius={0.08} smoothness={4} position={[0, 0.36, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...velvet} />
      </RoundedBox>
      <RoundedBox args={[0.95, 0.75, 0.22]} radius={0.1} smoothness={4} position={[0, 0.72, -0.34]} castShadow>
        <meshPhysicalMaterial {...velvet} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.18, 0.5, 0.8]} radius={0.08} smoothness={4} position={[s * 0.44, 0.52, 0]} castShadow>
          <meshPhysicalMaterial {...velvet} />
        </RoundedBox>
      ))}
      {[
        [-0.36, 0.32],
        [0.36, 0.32],
        [-0.36, -0.32],
        [0.36, -0.32],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.03} top={0.02} h={0.26} p={[x, 0.13, z]} c="#4a3222" rough={0.5} />
      ))}
    </group>
  );
}

/* ---------------------------------- Office --------------------------------- */

function inlayTexture() {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#0b1a24';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(125,211,230,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 76;
      ctx.beginPath();
      ctx.roundRect(x, 90, 56, 56, 12);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(125,211,230,0.35)';
    ctx.fillRect(40, 190, 432, 4);
  });
}

function OfficeScene({ lit, open, door }: HubRefs) {
  const floor = useMemo(() => {
    const t = woodTexture('#3b2618', 9);
    t.repeat.set(3, 2.5);
    return t;
  }, []);
  const inlay = useMemo(inlayTexture, []);
  const front = useRef<THREE.Group>(null);
  const slide = useRef<THREE.Group>(null);
  const ceiling = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const glow = useGlow(lit, 0.4, 1);
  useFade(front, open);
  useFrame(() => {
    if (slide.current) slide.current.position.x = door.current * 1.05;
    ceiling.current.forEach((m) => m && (m.emissiveIntensity = 1.2 + glow.current * 1.5));
    lights.current.forEach((l) => l && (l.intensity = 2.5 + glow.current * 2));
  });
  const W = 7.2;
  const D = 5.4;
  const H = 3.0;
  const chair = (p: V3, yaw: number) => (
    <group position={p} rotation={[0, yaw, 0]}>
      <B s={[0.5, 0.08, 0.5]} p={[0, 0.46, 0]} r={0.035} c="#1f1f22" rough={0.5} />
      <B s={[0.5, 0.55, 0.07]} p={[0, 0.78, -0.23]} r={0.035} c="#1f1f22" rough={0.5} />
      <Cyl r={0.025} h={0.42} p={[0, 0.21, 0]} c="#9aa0a6" metal={0.8} rough={0.25} />
    </group>
  );
  return (
    <group>
      {/* Mossy bank behind, planters along the base */}
      <mesh position={[0, -0.4, -D / 2 - 2.4]} scale={[6, 1.6, 2]} receiveShadow castShadow>
        <sphereGeometry args={[1, 40, 20]} />
        <meshStandardMaterial map={mossTexture()} roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshPhysicalMaterial map={floor} roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      <B s={[W + 0.4, 0.12, D + 0.4]} p={[0, -0.05, 0]} r={0.05} c="#a39c90" rough={0.9} />

      {/* Roof: a thin slab with a slight tilt, lit strips underneath */}
      <group position={[0, H, 0]} rotation={[-0.05, 0, 0]}>
        <B s={[W + 1.0, 0.16, D + 1.0]} p={[0, 0.12, 0.2]} r={0.05} c="#2f3439" metal={0.5} rough={0.4} />
        {[-1.6, 0, 1.6].map((x, i) => (
          <mesh key={x} position={[x, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.12, D - 1]} />
            <meshStandardMaterial ref={(m) => (ceiling.current[i] = m)} color="#ffffff" emissive="#f4f8ff" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {[-1.6, 1.6].map((x, i) => (
        <pointLight key={x} ref={(l) => (lights.current[i] = l)} position={[x, H - 0.4, 0]} color="#f2f6ff" intensity={3} distance={6} decay={1.4} />
      ))}

      {/* Glass walls: back, sides; the front fades so the camera can enter */}
      <GlassWall length={W} height={H} p={[0, 0, -D / 2]} />
      <GlassWall length={D} height={H} p={[-W / 2, 0, 0]} rot={[0, Math.PI / 2, 0]} />
      <GlassWall length={D} height={H} p={[W / 2, 0, 0]} rot={[0, Math.PI / 2, 0]} />
      <group ref={front}>
        <GlassWall length={W} height={H} p={[0, 0, D / 2]} gap={[-0.6, 0.6]} />
        <group ref={slide} position={[0, 0, D / 2 + 0.08]}>
          <B s={[1.1, H - 0.12, 0.05]} p={[0, (H - 0.12) / 2 + 0.06, 0]} r={0.02} c="#2b2f33" metal={0.6} />
          <Glass w={1.0} h={H - 0.3} p={[0, H / 2, 0.03]} />
        </group>
      </group>

      {/* Conference room behind a glass partition */}
      <GlassWall length={4.0} height={H - 0.1} p={[-1.6, 0, -0.95]} />
      <GlassWall length={1.75} height={H - 0.1} p={[0.4, 0, -1.82]} rot={[0, Math.PI / 2, 0]} />
      <B s={[3.0, 0.07, 1.05]} p={[-1.7, 0.75, -1.85]} r={0.03} c="#5a2a1c" rough={0.3} />
      {[-2.7, -0.7].map((x) => (
        <Cyl key={x} r={0.05} h={0.72} p={[x, 0.36, -1.85]} c="#1f1f22" metal={0.6} rough={0.3} />
      ))}
      {[-2.6, -1.7, -0.8].map((x) => (
        <group key={x}>
          {chair([x, 0, -1.2], Math.PI)}
          {chair([x, 0, -2.45], 0)}
        </group>
      ))}

      {/* Mahogany desk with a digital inlay, laptops, papers */}
      <B s={[2.3, 0.08, 1.0]} p={[1.6, 0.76, 0.35]} r={0.035} c="#5a1f14" rough={0.25} />
      <B s={[2.2, 0.62, 0.9]} p={[1.6, 0.41, 0.35]} r={0.03} c="#4a1a10" rough={0.35} />
      <mesh position={[1.25, 0.803, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.3]} />
        <meshStandardMaterial map={inlay} emissiveMap={inlay} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.2} />
      </mesh>
      <group position={[1.75, 0.8, 0.3]} rotation={[0, Math.PI, 0]}>
        <B s={[0.62, 0.02, 0.42]} p={[0, 0.01, 0]} r={0.008} c="#c9ccd1" metal={0.8} rough={0.25} />
        <group position={[0, 0.02, -0.2]} rotation={[-0.3, 0, 0]}>
          <B s={[0.62, 0.42, 0.015]} p={[0, 0.21, 0]} r={0.008} c="#c9ccd1" metal={0.8} rough={0.25} />
        </group>
      </group>
      {[0, 1].map((i) => (
        <B key={i} s={[0.3, 0.005, 0.4]} p={[2.45, 0.803 + i * 0.006, 0.4]} rot={[0, 0.15 * i, 0]} r={0.002} c="#fbfaf6" rough={0.9} shadow={false} />
      ))}
      {chair([1.7, 0, -0.45], 0)}
      <B s={[1.6, 0.06, 0.6]} p={[3.1, 0.74, -1.6]} r={0.02} c="#5a1f14" rough={0.3} />
      <group position={[3.1, 0.77, -1.6]}>
        <B s={[0.5, 0.018, 0.34]} p={[0, 0.01, 0]} r={0.006} c="#c9ccd1" metal={0.8} rough={0.25} />
      </group>

      <Plant p={[-3.1, 0, 2.2]} s={1.8} pot="#e8e2d6" />
      <Plant p={[3.1, 0, 2.2]} s={1.5} pot="#e8e2d6" />
      <Plant p={[-3.1, 0, -0.4]} s={1.2} pot="#2f3439" />
      {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
        <Plant key={x} p={[x, 0, -D / 2 - 0.35]} s={0.8} pot="#6b6358" />
      ))}
      <B s={[2.6, 0.02, 1.8]} p={[1.5, 0.03, 0.4]} r={0.01} c="#8c8f93" rough={1} shadow={false} />
    </group>
  );
}

/* ----------------------------------- Café ---------------------------------- */

function mosaicTexture() {
  const rand = seeded(19);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#e8dccb';
      ctx.fillRect(0, 0, 512, 512);
      const cols = ['#c9785a', '#e9dfcf', '#6d9b8f', '#d9b27a', '#b85f47', '#f1ebe0'];
      const c = 256;
      for (let y = 0; y < 512; y += 11) {
        for (let x = 0; x < 512; x += 11) {
          const d = Math.hypot(x - c, y - c);
          const ring = Math.floor(d / 34) % 3;
          const col = d < 60 ? cols[(Math.floor((Math.atan2(y - c, x - c) + Math.PI) * 3) % 2) * 2] : ring === 0 ? cols[1] : ring === 1 ? cols[Math.floor(rand() * 6)] : cols[5];
          ctx.fillStyle = col;
          ctx.fillRect(x + 1 + rand(), y + 1 + rand(), 9, 9);
        }
      }
    },
    [1, 1],
  );
}

function EspressoMachine({ p }: { p: V3 }) {
  const copper = { color: '#b8733f', metalness: 0.95, roughness: 0.22 };
  const chrome = { color: '#d9dde1', metalness: 1, roughness: 0.15 };
  return (
    <group position={p}>
      <RoundedBox args={[0.9, 0.42, 0.5]} radius={0.06} smoothness={4} position={[0, 0.21, 0]} castShadow>
        <meshStandardMaterial {...chrome} />
      </RoundedBox>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.3, 0.4, 32]} />
        <meshStandardMaterial {...copper} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <sphereGeometry args={[0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...copper} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#d9a441" metalness={1} roughness={0.2} />
      </mesh>
      {[-0.26, 0.26].map((x) => (
        <group key={x}>
          <Cyl r={0.05} h={0.12} p={[x, 0.18, 0.3]} c="#2e2e30" metal={0.7} rough={0.3} />
          <mesh position={[x * 1.35, 0.45, 0.1]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]}>
            <torusGeometry args={[0.12, 0.018, 8, 24, Math.PI]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.34, 0.26]}>
        <circleGeometry args={[0.07, 28]} />
        <meshStandardMaterial color="#f4efe6" emissive="#f4efe6" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function PastryCase({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <RoundedBox args={[0.9, 0.42, 0.5]} radius={0.02} smoothness={3} position={[0, 0.21, 0]}>
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.18} roughness={0.05} envMapIntensity={2} depthWrite={false} />
      </RoundedBox>
      <pointLight position={[0, 0.35, 0]} color="#ffd9a0" intensity={1.2} distance={1.2} />
      {[-0.28, 0, 0.28].map((x, i) => (
        <group key={x}>
          <mesh position={[x, 0.08, -0.05]} rotation={[Math.PI / 2, 0, 0.4]} castShadow>
            <torusGeometry args={[0.07, 0.03, 10, 20, Math.PI * 1.2]} />
            <meshStandardMaterial color="#d59a55" roughness={0.6} />
          </mesh>
          <mesh position={[x, 0.06, 0.12]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.06, 16, 12]} />
            <meshStandardMaterial color={['#c98a4b', '#e4c27a', '#8a4b2a'][i]} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const CAFE_R = 3.9;
const CAFE_SQUASH = 0.8;
const cafeFront = (c: THREE.Vector3) => c.z > CAFE_R * 0.55 && Math.abs(c.x) < CAFE_R * 0.95;
const cafeHole = (c: THREE.Vector3) => Math.abs(c.x) < 0.62 && c.y < 2.12;

function CupCottage({ p, yaw }: { p: V3; yaw: number }) {
  const latte = useMemo(
    () =>
      canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#8a5a36';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#f3e7d3';
        ctx.beginPath();
        ctx.moveTo(128, 200);
        ctx.bezierCurveTo(20, 120, 70, 40, 128, 90);
        ctx.bezierCurveTo(186, 40, 236, 120, 128, 200);
        ctx.fill();
      }),
    [],
  );
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.2, 0.1, 64]} />
        <meshPhysicalMaterial color="#d9c6aa" roughness={0.3} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.35, 2.3, 64]} />
        <meshPhysicalMaterial color="#c9a27e" roughness={0.35} clearcoat={1} clearcoatRoughness={0.15} />
      </mesh>
      <mesh position={[0, 2.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 64]} />
        <meshStandardMaterial map={latte} roughness={0.6} />
      </mesh>
      <mesh position={[1.75, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.55, 0.16, 16, 40, Math.PI]} />
        <meshPhysicalMaterial color="#c9a27e" roughness={0.35} clearcoat={1} />
      </mesh>
      <group position={[0, 0.1, 1.52]} rotation={[-0.07, 0, 0]}>
        <mesh position={[0, 0.72, 0]}>
          <planeGeometry args={[0.8, 1.4]} />
          <meshStandardMaterial color="#6d4a30" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.05, 0.01]}>
          <circleGeometry args={[0.16, 24]} />
          <meshStandardMaterial color="#ffd9a0" emissive="#ffc27a" emissiveIntensity={1.2} />
        </mesh>
      </group>
    </group>
  );
}

function CafeScene({ lit, open, door }: HubRefs) {
  const tiles = useMemo(mosaicTexture, []);
  const front = useRef<THREE.Group>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const bulbs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const glow = useGlow(lit, 0.45, 1);
  useFade(front, open);
  useFrame(({ clock }) => {
    lights.current.forEach((l, i) => l && (l.intensity = 2.2 + glow.current * 2.2 + Math.sin(clock.elapsedTime * 2 + i) * 0.05));
    bulbs.current.forEach((b) => b && (b.emissiveIntensity = 1.8 + glow.current * 2.5));
  });
  const counterArc = [-0.75, -0.38, 0, 0.38, 0.75];
  return (
    <group>
      {/* Floor and walls */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[CAFE_R - 0.05, 64]} />
        <meshStandardMaterial map={tiles} roughness={0.55} />
      </mesh>
      <MossDome r={CAFE_R} squash={CAFE_SQUASH} inner="#efe0c8" front={cafeFront} />
      <group ref={front}>
        <MossDomeFront r={CAFE_R} squash={CAFE_SQUASH} inner="#efe0c8" front={cafeFront} hole={cafeHole} />
      </group>
      {/* Round wooden door set in a stone arch */}
      <group position={[0, 0, CAFE_R - 0.25]}>
        <RoundDoor w={1.2} h={2.1} color="#7a5234" glass="#ffd9a0" door={door} glow="#ffcf8a" />
      </group>
      {/* A cup on the roof, stones around the base */}
      <group position={[0.4, CAFE_R * CAFE_SQUASH - 0.05, 0]}>
        <Cyl r={0.28} top={0.34} h={0.42} p={[0, 0.21, 0]} c="#f4efe7" rough={0.35} />
        <mesh position={[0.36, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.12, 0.035, 10, 20, Math.PI]} />
          <meshStandardMaterial color="#f4efe7" roughness={0.35} />
        </mesh>
      </group>
      <Stones r={CAFE_R + 0.15} count={26} seed={3} skipFront />

      {/* Curved coffee bar with an ornate espresso machine and pastries */}
      {counterArc.map((a) => {
        const x = Math.sin(a) * 2.45;
        const z = -Math.cos(a) * 2.45;
        return (
          <group key={a} position={[x, 0, z]} rotation={[0, -a, 0]}>
            <B s={[0.95, 0.95, 0.55]} p={[0, 0.475, 0]} r={0.04} c="#6b4430" rough={0.5} />
            <B s={[1.0, 0.05, 0.65]} p={[0, 0.975, 0.03]} r={0.02} c="#eee7de" rough={0.2} />
          </group>
        );
      })}
      <EspressoMachine p={[0, 1.0, -2.55]} />
      <PastryCase p={[-0.95, 1.0, -2.25]} />
      <Mug p={[0.8, 1.0, -2.3]} c="#f4efe7" steam={glow} />

      {/* Mismatched vintage seating */}
      <Armchair p={[1.45, 0, 0.35]} yaw={-0.75} color="#c9973e" />
      <Armchair p={[-1.7, 0, 0.6]} yaw={0.7} color="#3f7470" />
      <group position={[-1.2, 0, 1.9]} rotation={[0, 0.3, 0]}>
        <RoundedBox args={[1.5, 0.3, 0.7]} radius={0.12} smoothness={4} position={[0, 0.34, 0]} castShadow>
          <meshPhysicalMaterial color="#b76e6e" roughness={0.9} sheen={1} sheenColor="#ffd9d9" />
        </RoundedBox>
        <RoundedBox args={[1.5, 0.55, 0.2]} radius={0.1} smoothness={4} position={[0, 0.66, -0.28]} castShadow>
          <meshPhysicalMaterial color="#b76e6e" roughness={0.9} sheen={1} sheenColor="#ffd9d9" />
        </RoundedBox>
      </group>
      <group position={[0.55, 0, 0.9]}>
        <Cyl r={0.36} h={0.04} p={[0, 0.55, 0]} c="#7a5234" rough={0.4} />
        <Cyl r={0.03} h={0.53} p={[0, 0.27, 0]} c="#3b2a1f" rough={0.5} />
        <Mug p={[0.05, 0.57, -0.1]} c="#f4efe7" steam={glow} />
        <mesh position={[-0.15, 0.6, 0.12]} rotation={[Math.PI / 2, 0, 0.5]} castShadow>
          <torusGeometry args={[0.08, 0.035, 10, 20, Math.PI * 1.2]} />
          <meshStandardMaterial color="#d59a55" roughness={0.6} />
        </mesh>
      </group>
      <group position={[-0.5, 0, -0.4]}>
        <Cyl r={0.3} h={0.04} p={[0, 0.7, 0]} c="#e9e2d6" rough={0.3} />
        <Cyl r={0.025} h={0.68} p={[0, 0.34, 0]} c="#2b2b2b" metal={0.5} rough={0.4} />
      </group>
      <B s={[2.8, 0.02, 2.0]} p={[0, 0.03, 0.9]} r={0.01} c="#b9876a" rough={1} shadow={false} />

      {/* Plants everywhere, some hanging */}
      <Plant p={[2.6, 0, -1.2]} s={1.4} pot="#c47a5a" />
      <Plant p={[-2.7, 0, -1.0]} s={1.5} pot="#e8dfd2" />
      <Plant p={[2.4, 0, 1.9]} s={1.0} pot="#6d9b8f" />
      {[-1.4, 1.3].map((x) => (
        <group key={x} position={[x, 0, -1.0]}>
          <Cyl r={0.006} h={0.8} p={[0, 2.55, 0]} c="#3b2f2a" />
          <Plant p={[0, 1.85, 0]} s={0.55} pot="#e8dfd2" />
        </group>
      ))}

      {/* Warm pendants */}
      {[-0.9, 0, 0.9].map((x, i) => (
        <group key={x} position={[x, 0, -1.7 + Math.abs(x) * 0.3]}>
          <Cyl r={0.006} h={0.7} p={[0, 2.65, 0]} c="#3b2f2a" />
          <mesh position={[0, 2.25, 0]} castShadow>
            <sphereGeometry args={[0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#b8733f" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 2.21, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial ref={(m) => (bulbs.current[i] = m)} color="#fff4dc" emissive="#ffcf8a" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <pointLight ref={(l) => (lights.current[i] = l)} position={[0, 2.05, 0]} color="#ffbf74" intensity={2.4} distance={4} decay={1.5} />
        </group>
      ))}
      <pointLight position={[0, 1.4, CAFE_R - 0.3]} color="#ffcf8a" intensity={2} distance={3} />

      <CupCottage p={[-5.6, 0, 2.2]} yaw={0.5} />
    </group>
  );
}

/* ------------------------------ Developer room ----------------------------- */

const DEV_R = 3.9;
const DEV_SQUASH = 0.76;
const DEV_FACE_Z = 2.35;
const devFront = (c: THREE.Vector3) => c.z > DEV_FACE_Z;

function codeTexture() {
  const rand = seeded(23);
  const tex = canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = '#04110a';
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
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function circuitTexture() {
  const rand = seeded(41);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#8a929b';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#5e666f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 70; i++) {
        let x = rand() * 512;
        let y = rand() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          if (rand() > 0.5) x += (rand() - 0.5) * 140;
          else y += (rand() - 0.5) * 140;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#4c535b';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [1, 1],
  );
}

function circuitGlow() {
  const rand = seeded(41);
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#7de7f0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      let x = rand() * 512;
      let y = rand() * 512;
      ctx.globalAlpha = rand() > 0.6 ? 0.9 : 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        if (rand() > 0.5) x += (rand() - 0.5) * 140;
        else y += (rand() - 0.5) * 140;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function Keyboard({ p, yaw = 0, keys }: { p: V3; yaw?: number; keys: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cols = 14;
  const rows = 4;
  useLayoutEffect(() => {
    {
      const m = new THREE.Matrix4();
      const c = new THREE.Color(keys);
      const accent = new THREE.Color('#e8e4dc');
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < cols; k++) {
          const i = r * cols + k;
          m.makeTranslation(-0.2 + k * 0.03, 0.022, -0.05 + r * 0.03);
          ref.current?.setMatrixAt(i, m);
          ref.current?.setColorAt(i, (k + r) % 5 === 0 ? accent : c);
        }
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    }
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

function DevScene({ lit, open, door }: HubRefs) {
  const code = useMemo(codeTexture, []);
  const screens = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const t = code.clone();
    t.needsUpdate = true;
    t.offset.set(0, (i * 0.37) % 1);
    t.repeat.set(1, 0.55);
    return t;
  }), [code]);
  const faceMap = useMemo(circuitTexture, []);
  const faceGlow = useMemo(circuitGlow, []);
  const front = useRef<THREE.Group>(null);
  const slide = useRef<THREE.Group>(null);
  const screenMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const blue = useRef<THREE.PointLight>(null);
  const glow = useGlow(lit, 0.4, 1);
  useFade(front, open);
  useFrame((_, dt) => {
    // Code scrolls up every screen at slightly different speeds.
    screens.forEach((t, i) => (t.offset.y = (t.offset.y + dt * (0.04 + (i % 4) * 0.012) * (1 + glow.current)) % 1));
    screenMats.current.forEach((m) => m && (m.emissiveIntensity = 1.1 + glow.current * 0.8));
    if (ring.current) ring.current.emissiveIntensity = 1.5 + glow.current * 2;
    if (blue.current) blue.current.intensity = 3 + glow.current * 3;
    if (slide.current) slide.current.position.x = door.current * 1.1;
  });

  // Monitors line the curved back wall in two rows.
  const monitors = useMemo(() => {
    const out: { p: V3; yaw: number }[] = [];
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 7; k++) {
        const a = -1.05 + (k / 6) * 2.1;
        const r = 3.05 - row * 0.12;
        out.push({ p: [Math.sin(a) * r, 1.35 + row * 0.72, -Math.cos(a) * r], yaw: -a });
      }
    return out;
  }, []);

  const face = useMemo(() => {
    const rx = Math.sqrt(DEV_R * DEV_R - DEV_FACE_Z * DEV_FACE_Z);
    const ry = rx * DEV_SQUASH;
    const s = new THREE.Shape();
    s.absellipse(0, 0, rx, ry, 0, Math.PI, false);
    s.lineTo(-rx, 0);
    s.holes.push(new THREE.Path(archShape(1.25, 2.15).getPoints(40)));
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 64 });
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (rx * 2) + 0.5, uv.getY(i) / (rx * 2));
    return g;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DEV_R - 0.05, 64]} />
        <meshStandardMaterial color="#1b2029" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DEV_R - 0.35, DEV_R - 0.3, 96]} />
        <meshStandardMaterial ref={ring} color="#111" emissive="#4fb3ff" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <MossDome r={DEV_R} squash={DEV_SQUASH} inner="#151b24" front={devFront} />

      {/* The metal circuit facade with a sliding, glowing door */}
      <group ref={front}>
        <mesh geometry={face} position={[0, 0, DEV_FACE_Z]} castShadow receiveShadow>
          <meshStandardMaterial map={faceMap} emissiveMap={faceGlow} emissive="#7de7f0" emissiveIntensity={0.9} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.075, DEV_FACE_Z + 0.02]}>
          <planeGeometry args={[1.25, 2.15]} />
          <meshBasicMaterial color="#7fe6ff" toneMapped={false} />
        </mesh>
        <group ref={slide} position={[0, 0, DEV_FACE_Z + 0.2]}>
          <mesh position={[0, 0, 0]}>
            <extrudeGeometry args={[archShape(1.2, 2.1), { depth: 0.05, bevelEnabled: false, curveSegments: 40 }]} />
            <meshStandardMaterial color="#5e666f" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.2, 0.06]}>
            <planeGeometry args={[0.8, 1.3]} />
            <meshStandardMaterial color="#b8f4ff" emissive="#7fe6ff" emissiveIntensity={1.2} roughness={0.1} transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
      <Stones r={DEV_R + 0.15} count={24} seed={9} skipFront />

      {/* A curved wall of monitors, streaming green code */}
      {monitors.map((m, i) => (
        <group key={i} position={m.p} rotation={[0, m.yaw, 0]}>
          <B s={[0.82, 0.52, 0.05]} p={[0, 0, 0]} r={0.015} c="#0f1216" metal={0.4} rough={0.4} />
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[0.76, 0.46]} />
            <meshStandardMaterial ref={(mm) => (screenMats.current[i] = mm)} map={screens[i]} emissiveMap={screens[i]} emissive="#ffffff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 1.8, -1.6]} color="#5cff9a" intensity={2.2} distance={4.5} decay={1.6} />
      <pointLight ref={blue} position={[0, 2.4, 0.4]} color="#5aa7ff" intensity={3} distance={6} decay={1.5} />

      {/* Standing desks with mechanical keyboards */}
      {[
        { x: -0.9, yaw: 0.25 },
        { x: 0.9, yaw: -0.25 },
      ].map((d) => (
        <group key={d.x} position={[d.x, 0, -1.3]} rotation={[0, d.yaw, 0]}>
          <B s={[1.3, 0.05, 0.6]} p={[0, 0.88, 0]} r={0.02} c="#2b2f36" metal={0.3} rough={0.4} />
          {[-0.55, 0.55].map((x) => (
            <B key={x} s={[0.06, 0.86, 0.5]} p={[x, 0.43, 0]} r={0.02} c="#15181d" metal={0.6} rough={0.35} />
          ))}
          <Keyboard p={[0, 0.905, 0.1]} keys={d.x < 0 ? '#e8c77a' : '#9db4ff'} />
        </group>
      ))}

      {/* Keyboard collection on a wall shelf */}
      <group position={[-2.55, 1.1, 1.0]} rotation={[0, Math.PI / 2 + 0.45, 0]}>
        <B s={[1.5, 0.04, 0.3]} p={[0, 0, 0]} r={0.01} c="#3a3f48" rough={0.5} />
        {['#f0a8a0', '#7dd3c0', '#c7b6f2'].map((c, i) => (
          <Keyboard key={c} p={[-0.48 + i * 0.48, 0.02, 0]} keys={c} />
        ))}
      </group>

      {/* Circuit boards under glass */}
      <group position={[-1.5, 0, 0.9]} rotation={[0, 0.5, 0]}>
        <B s={[1.1, 0.7, 0.7]} p={[0, 0.35, 0]} r={0.03} c="#1f242c" metal={0.4} rough={0.4} />
        {[
          [-0.25, 0.1],
          [0.2, -0.1],
          [0.25, 0.18],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.71, z]} rotation={[0, i * 0.4, 0]}>
            <B s={[0.36, 0.015, 0.24]} p={[0, 0, 0]} r={0.004} c="#1f6b3a" rough={0.5} />
            <mesh position={[0.08, 0.012, 0.05]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#ff5a5a" emissive="#ff5a5a" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            <B s={[0.06, 0.02, 0.06]} p={[-0.06, 0.015, -0.03]} r={0.004} c="#15171b" />
          </group>
        ))}
        <mesh position={[0, 0.76, 0]}>
          <boxGeometry args={[1.08, 0.02, 0.68]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.15} roughness={0.03} envMapIntensity={2} depthWrite={false} />
        </mesh>
      </group>

      {/* Hardware workshop corner */}
      <group position={[2.3, 0, 0.6]} rotation={[0, -Math.PI / 2 - 0.35, 0]}>
        <B s={[1.5, 0.06, 0.6]} p={[0, 0.82, 0]} r={0.02} c="#8a6446" rough={0.6} />
        {[-0.65, 0.65].map((x) => (
          <B key={x} s={[0.06, 0.8, 0.5]} p={[x, 0.4, 0]} r={0.02} c="#2b2f36" metal={0.5} />
        ))}
        <B s={[1.5, 0.8, 0.03]} p={[0, 1.4, -0.3]} r={0.01} c="#c9b28f" rough={0.9} />
        {[-0.5, -0.3, -0.1].map((x, i) => (
          <Cyl key={x} r={0.012} h={0.25} p={[x, 1.45, -0.26]} c={['#d9534f', '#e8c77a', '#5aa7ff'][i]} rough={0.4} />
        ))}
        <B s={[0.28, 0.12, 0.2]} p={[0.35, 0.91, 0]} r={0.02} c="#23262c" />
        <mesh position={[0.3, 0.92, 0.105]}>
          <circleGeometry args={[0.015, 12]} />
          <meshStandardMaterial color="#ff5a5a" emissive="#ff5a5a" emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <B key={i} s={[0.16, 0.08, 0.14]} p={[-0.45 + i * 0.18, 0.89, 0.12]} r={0.02} c={['#5aa7ff', '#7dd3c0', '#e8c77a'][i]} rough={0.4} />
        ))}
        <group position={[0.05, 0.85, 0]}>
          <Cyl r={0.012} h={0.5} p={[0, 0.25, 0]} rot={[0, 0, 0.3]} c="#2b2f36" metal={0.6} />
          <mesh position={[-0.12, 0.5, 0.05]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.08, 0.012, 8, 24]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
      <Sparkles count={20} scale={[5, 2, 5]} position={[0, 1.5, 0]} size={2} speed={0.2} color="#7de7f0" />
    </group>
  );
}

function Stones({ r, count, seed, skipFront }: { r: number; count: number; seed: number; skipFront?: boolean }) {
  const stones = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.1;
      return { a, s: 0.2 + rand() * 0.18, x: Math.cos(a) * r, z: Math.sin(a) * r, tilt: rand() };
    }).filter((st) => !(skipFront && st.z > r * 0.8 && Math.abs(st.x) < 1.3));
  }, [r, count, seed, skipFront]);
  return (
    <>
      {stones.map((st, i) => (
        <mesh key={i} position={[st.x, st.s * 0.35, st.z]} rotation={[st.tilt, st.a, 0]} scale={[st.s * 1.4, st.s * 0.8, st.s]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#9d968a" roughness={0.9} />
        </mesh>
      ))}
    </>
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
    position: [-6.8, 0, -2.6],
    rotation: 0.5,
    labelY: 4.0,
    doorstep: [0, 0, 3.8],
    entry: [0, 0, 2.0],
    approach: [
      [2.9, 0, 1.4],
      [2.9, 0, -0.5],
      [1.7, 0, -0.45],
    ],
    seat: { position: [1.7, 0.34, -0.45], yaw: 0 },
    focus: [1.75, 1.0, 0.3],
    camera: { position: [-0.85, 1.9, 2.45], look: [1.0, 1.0, -0.55] },
    arrival: { position: [-1.6, 1.9, 8.6], look: [0, 1.2, 2.2] },
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
    position: [5.2, 0, -5.0],
    rotation: -0.4,
    labelY: 4.1,
    doorstep: [0, 0, CAFE_R + 1.2],
    entry: [0, 0, CAFE_R - 1.1],
    approach: [
      [0.9, 0, 1.6],
      [1.45, 0, 0.45],
    ],
    seat: { position: [1.45, 0.3, 0.35], yaw: -0.75 },
    focus: [0.6, 0.65, 0.8],
    camera: { position: [-0.9, 1.75, 2.55], look: [0.55, 0.95, -0.2] },
    arrival: { position: [-1.6, 1.9, 9.2], look: [0, 1.2, CAFE_R - 0.4] },
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
    position: [6.8, 0, 2.6],
    rotation: -1.2,
    labelY: 3.6,
    doorstep: [0, 0, DEV_FACE_Z + 1.4],
    entry: [0, 0, DEV_FACE_Z - 0.9],
    approach: [
      [0.4, 0, 0.3],
      [0.9, 0, -0.75],
    ],
    seat: { position: [0.9, 0, -0.75], yaw: Math.PI + 0.25 },
    focus: [0.9, 1.6, -3.0],
    camera: { position: [-1.3, 1.65, 1.6], look: [0.3, 1.15, -1.4] },
    arrival: { position: [-1.4, 1.8, 8.4], look: [0, 1.1, DEV_FACE_Z] },
    Scene: DevScene,
  },
];
