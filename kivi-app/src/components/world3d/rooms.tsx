import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Activity, Outfit } from './Kiwi3D';
import { seeded, V3 } from './util';

/*
 * Each world Kivi can visit is a small, open-fronted room. To add one, write a
 * component for it below and append an entry to ROOMS: everything else (the
 * map, labels, camera, Kivi's route and outfit) is driven by this data.
 */
export interface RoomDef {
  id: string;
  persona: string; // mode id stored by the app (see useKiviInput MODES)
  label: string; // tiny hover label
  chip: string; // persona name revealed inside
  outfit: Outfit;
  activity: Activity;
  line: string; // something Kivi says, in this persona's voice
  icon: 'office' | 'cafe' | 'dev';
  position: V3;
  rotation: number;
  // The rest are in the room's own coordinates (front opening faces +z).
  entry: V3;
  approach: V3[];
  seat: { position: V3; yaw: number };
  focus: V3; // what Kivi looks at while busy
  camera: { position: V3; look: V3 };
  Scene: (props: { lit: React.MutableRefObject<number> }) => JSX.Element;
}

type Lit = { lit: React.MutableRefObject<number> };

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

function woodTexture(base: string, seed: number) {
  const rand = seeded(seed);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 64) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,245,230' : '80,50,30'},${0.04 + rand() * 0.06})`;
        ctx.fillRect(x, 0, 64, 512);
        ctx.fillStyle = 'rgba(60,40,25,0.25)';
        ctx.fillRect(x, 0, 2, 512);
        const joint = rand() * 512;
        ctx.fillRect(x, joint, 64, 2);
        for (let g = 0; g < 7; g++) {
          ctx.strokeStyle = `rgba(90,60,35,${0.05 + rand() * 0.06})`;
          ctx.beginPath();
          const gx = x + 6 + rand() * 52;
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 6, 170, gx - 6, 340, gx + 3, 512);
          ctx.stroke();
        }
      }
    },
    [2, 2],
  );
}

// Rounded box shorthand: every hard edge in these rooms is softened.
function B({
  s,
  p,
  r = 0.03,
  c,
  rough = 0.75,
  metal = 0,
  rot,
  map,
  emissive,
  ei = 0,
  shadow = true,
}: {
  s: V3;
  p: V3;
  r?: number;
  c: string;
  rough?: number;
  metal?: number;
  rot?: V3;
  map?: THREE.Texture;
  emissive?: string;
  ei?: number;
  shadow?: boolean;
}) {
  return (
    <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2 - 0.001)} smoothness={4} position={p} rotation={rot} castShadow={shadow} receiveShadow>
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} map={map} emissive={emissive ?? '#000'} emissiveIntensity={ei} />
    </RoundedBox>
  );
}

function Cyl({ r, h, p, c, rough = 0.6, metal = 0, rot, top }: { r: number; h: number; p: V3; c: string; rough?: number; metal?: number; rot?: V3; top?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, 32]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}

function Shell({ wall, side, floor, floorMap }: { wall: string; side: string; floor: string; floorMap?: THREE.Texture }) {
  return (
    <group>
      <B s={[6.2, 0.3, 5.2]} p={[0, -0.15, 0]} r={0.12} c={floor} map={floorMap} rough={0.6} />
      <B s={[6.2, 3.2, 0.24]} p={[0, 1.6, -2.48]} r={0.1} c={wall} rough={0.95} />
      <B s={[0.24, 3.2, 5.2]} p={[-2.98, 1.6, 0]} r={0.1} c={side} rough={0.95} />
      <B s={[5.9, 0.12, 0.05]} p={[0.05, 0.06, -2.34]} r={0.02} c={side} />
    </group>
  );
}

function Plant({ p, s = 1, pot = '#c47a5a' }: { p: V3; s?: number; pot?: string }) {
  const leaves = useMemo(() => {
    const rand = seeded(Math.round(p[0] * 100 + p[2] * 7));
    return Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + rand() * 0.4, tilt: 0.4 + rand() * 0.5, len: 0.35 + rand() * 0.25 }));
  }, [p]);
  return (
    <group position={p} scale={s}>
      <Cyl r={0.2} top={0.24} h={0.42} p={[0, 0.21, 0]} c={pot} rough={0.9} />
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.02, 24]} />
        <meshStandardMaterial color="#5a4332" roughness={1} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.42, 0]} rotation={[0, l.a, l.tilt]}>
          <mesh position={[0, l.len / 2, 0]} scale={[0.09, l.len / 2, 0.035]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={i % 2 ? '#6f8f5e' : '#80a06a'} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

let wisp: THREE.Texture | null = null;
function wispTexture() {
  wisp ??= canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  return wisp;
}

// Soft, rising wisps of steam; they thicken when the room has your attention.
function Steam({ p, strength }: { p: V3; strength: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const map = useMemo(wispTexture, []);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.35 + i / 6) % 1;
      c.position.set(Math.sin(t * 4 + i * 1.7) * 0.035, t * 0.5, Math.cos(t * 3 + i) * 0.02);
      c.scale.setScalar(0.07 + t * 0.16);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (0.18 + strength.current * 0.3) * Math.sin(t * Math.PI);
    });
  });
  return (
    <group ref={g} position={p}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <sprite key={i}>
          <spriteMaterial map={map} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

function Mug({ p, c = '#ece6db', steam }: { p: V3; c?: string; steam?: React.MutableRefObject<number> }) {
  return (
    <group position={p}>
      <Cyl r={0.07} top={0.075} h={0.14} p={[0, 0.07, 0]} c={c} rough={0.35} />
      <mesh position={[0, 0.138, 0]}>
        <cylinderGeometry args={[0.064, 0.064, 0.005, 20]} />
        <meshStandardMaterial color="#5b3a26" roughness={0.3} />
      </mesh>
      <mesh position={[0.085, 0.075, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.035, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color={c} roughness={0.35} />
      </mesh>
      {steam && <Steam p={[0, 0.17, 0]} strength={steam} />}
    </group>
  );
}

// Eases the room's "attention" level toward 1 while hovered or occupied.
function useGlow(lit: React.MutableRefObject<number>, base: number, boost: number) {
  const v = useRef(base);
  useFrame((_, dt) => {
    v.current = THREE.MathUtils.damp(v.current, base + lit.current * boost, 4, dt);
  });
  return v;
}

/* ---------------------------------- Office --------------------------------- */

function OfficeScene({ lit }: Lit) {
  const floor = useMemo(() => woodTexture('#d8bf9c', 3), []);
  const screen = useMemo(
    () =>
      canvasTexture(512, 340, (ctx) => {
        ctx.fillStyle = '#f7f5f0';
        ctx.fillRect(0, 0, 512, 340);
        ctx.fillStyle = '#e8e3da';
        ctx.fillRect(0, 0, 130, 340);
        ctx.fillStyle = '#c9c2b5';
        for (let i = 0; i < 7; i++) ctx.fillRect(18, 30 + i * 36, 90 - (i % 3) * 14, 10);
        ctx.fillStyle = '#3e4a5c';
        ctx.fillRect(160, 34, 220, 14);
        ctx.fillStyle = '#b9b3a8';
        for (let i = 0; i < 8; i++) ctx.fillRect(160, 76 + i * 26, 300 - ((i * 47) % 120), 8);
        ctx.fillStyle = '#2f3b52';
        ctx.fillRect(160, 292, 90, 26);
      }),
    [],
  );
  const lamp = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useGlow(lit, 0.35, 1);
  useFrame(() => {
    if (lamp.current) lamp.current.intensity = 1.2 + glow.current * 2.5;
    if (bulb.current) bulb.current.emissiveIntensity = 1 + glow.current * 3;
    if (glass.current) glass.current.emissiveIntensity = 0.5 + glow.current * 0.7;
  });
  const books = ['#8c6d5a', '#b5a48c', '#56685e', '#c9b79a', '#7b8794', '#a4776a', '#d4c6ae'];
  return (
    <group>
      <Shell wall="#efe5d8" side="#e6d9c7" floor="#d8bf9c" floorMap={floor} />
      <B s={[3.4, 0.025, 2.4]} p={[0.1, 0.013, -0.9]} r={0.012} c="#c3cabb" rough={1} shadow={false} />

      {/* Window with soft daylight */}
      <group position={[1.6, 1.85, -2.33]}>
        <B s={[1.7, 1.3, 0.08]} p={[0, 0, 0]} r={0.04} c="#f7f2ea" />
        <RoundedBox args={[1.5, 1.1, 0.02]} radius={0.009} position={[0, 0, 0.04]}>
          <meshStandardMaterial ref={glass} color="#f6efe1" emissive="#fff1d6" emissiveIntensity={0.6} roughness={0.2} />
        </RoundedBox>
        <B s={[0.04, 1.1, 0.05]} p={[0, 0, 0.06]} r={0.01} c="#f7f2ea" />
        <B s={[1.5, 0.04, 0.05]} p={[0, 0, 0.06]} r={0.01} c="#f7f2ea" />
      </group>

      {/* Framed print */}
      <group position={[-1.1, 2.05, -2.34]}>
        <B s={[0.9, 0.7, 0.05]} p={[0, 0, 0]} r={0.02} c="#3b3531" />
        <B s={[0.78, 0.58, 0.02]} p={[0, 0, 0.03]} r={0.008} c="#f3eee6" shadow={false} />
        <mesh position={[-0.1, 0.02, 0.045]}>
          <circleGeometry args={[0.16, 32]} />
          <meshStandardMaterial color="#d49a6a" />
        </mesh>
        <mesh position={[0.14, -0.08, 0.046]}>
          <planeGeometry args={[0.26, 0.2]} />
          <meshStandardMaterial color="#8fa38a" />
        </mesh>
      </group>

      {/* Desk */}
      <B s={[2.3, 0.08, 1.0]} p={[0, 0.74, -0.9]} r={0.035} c="#7a5436" rough={0.45} />
      <B s={[2.1, 0.42, 0.04]} p={[0, 0.48, -0.46]} r={0.015} c="#6c4a30" rough={0.5} />
      {[
        [-1.05, -1.3],
        [1.05, -1.3],
        [-1.05, -0.5],
        [1.05, -0.5],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={0.025} h={0.7} p={[x, 0.35, z]} c="#2b2b2b" metal={0.6} rough={0.35} />
      ))}

      {/* Laptop, open towards Kivi */}
      <group position={[-0.4, 0, -0.82]} rotation={[0, 0.35, 0]}>
      <group position={[0, 0, 0.82]}>
      <B s={[0.7, 0.025, 0.48]} p={[0, 0.795, -0.82]} r={0.01} c="#d5d7db" metal={0.5} rough={0.3} />
      <group position={[0, 0.81, -0.59]} rotation={[0.28, 0, 0]}>
        <B s={[0.7, 0.46, 0.018]} p={[0, 0.23, 0]} r={0.008} c="#d5d7db" metal={0.5} rough={0.3} />
        <mesh position={[0, 0.23, -0.011]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.64, 0.4]} />
          <meshStandardMaterial map={screen} emissiveMap={screen} emissive="#ffffff" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.25, 0.011]}>
          <circleGeometry args={[0.03, 24]} />
          <meshStandardMaterial color="#eef0f2" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      </group>
      </group>
      <pointLight position={[-0.3, 1.05, -1.2]} color="#dfe8ff" intensity={0.8} distance={1.6} />

      {/* Papers, pen, mug */}
      {[0, 1, 2].map((i) => (
        <B key={i} s={[0.32, 0.006, 0.42]} p={[0.72 + i * 0.02, 0.785 + i * 0.007, -0.85]} rot={[0, 0.12 * i - 0.1, 0]} r={0.002} c="#fbfaf6" rough={0.9} />
      ))}
      <Cyl r={0.01} h={0.28} p={[0.62, 0.81, -0.62]} rot={[Math.PI / 2, 0, 0.9]} c="#2f3b52" rough={0.3} />
      <Mug p={[0.4, 0.78, -0.6]} c="#e9e2d6" />

      {/* Desk lamp */}
      <group position={[-0.98, 0.78, -1.22]}>
        <Cyl r={0.1} h={0.03} p={[0, 0.015, 0]} c="#2b2b2b" metal={0.5} rough={0.4} />
        <Cyl r={0.012} h={0.55} p={[0.08, 0.28, 0.02]} rot={[0.1, 0, -0.3]} c="#2b2b2b" metal={0.5} rough={0.4} />
        <mesh position={[0.22, 0.52, 0.08]} rotation={[0.3, 0, -0.9]} castShadow>
          <coneGeometry args={[0.13, 0.2, 32, 1, true]} />
          <meshStandardMaterial color="#c8a36a" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.25, 0.47, 0.1]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial ref={bulb} color="#fff4dc" emissive="#ffd99a" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <pointLight ref={lamp} position={[0.3, 0.35, 0.15]} color="#ffcf8a" intensity={2} distance={3} />
      </group>

      {/* Chair behind the desk */}
      <group position={[0, 0, -1.75]}>
        <B s={[0.72, 0.1, 0.66]} p={[0, 0.44, 0]} r={0.045} c="#5f6f66" rough={0.95} />
        <B s={[0.72, 0.8, 0.09]} p={[0, 0.92, -0.33]} r={0.045} c="#5f6f66" rough={0.95} />
        <Cyl r={0.035} h={0.36} p={[0, 0.22, 0]} c="#2b2b2b" metal={0.6} rough={0.35} />
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} s={[0.04, 0.03, 0.34]} p={[Math.sin((i / 5) * Math.PI * 2) * 0.15, 0.04, Math.cos((i / 5) * Math.PI * 2) * 0.15]} rot={[0, (i / 5) * Math.PI * 2, 0]} r={0.012} c="#2b2b2b" metal={0.5} />
        ))}
      </group>

      {/* Bookshelf */}
      <group position={[-2.62, 0, 0.7]}>
        <B s={[0.42, 1.9, 1.5]} p={[0, 0.95, 0]} r={0.03} c="#caa982" rough={0.6} />
        {[0.5, 1.05, 1.6].map((y, row) => (
          <group key={y}>
            <B s={[0.36, 0.03, 1.4]} p={[0.04, y - 0.28, 0]} r={0.01} c="#b8946c" />
            {Array.from({ length: 7 }, (_, i) => {
              const h = 0.34 + ((i * 7 + row * 3) % 5) * 0.03;
              return <B key={i} s={[0.24, h, 0.1]} p={[0.06, y - 0.265 + h / 2, -0.55 + i * 0.13 + (row % 2) * 0.05]} r={0.012} c={books[(i + row * 2) % books.length]} rough={0.85} />;
            })}
          </group>
        ))}
      </group>

      <Plant p={[2.45, 0, -1.9]} s={1.3} />
    </group>
  );
}

/* ----------------------------------- Café ---------------------------------- */

function CafeScene({ lit }: Lit) {
  const tiles = useMemo(
    () =>
      canvasTexture(
        256,
        256,
        (ctx) => {
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
              ctx.fillStyle = (x + y) % 2 ? '#e4cdb4' : '#f3ebdf';
              ctx.fillRect(x * 32, y * 32, 32, 32);
              ctx.strokeStyle = 'rgba(120,90,60,0.18)';
              ctx.strokeRect(x * 32 + 0.5, y * 32 + 0.5, 31, 31);
            }
        },
        [3, 2.5],
      ),
    [],
  );
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const bulbs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const glow = useGlow(lit, 0.4, 1);
  useFrame(({ clock }) => {
    lights.current.forEach((l, i) => l && (l.intensity = 1.6 + glow.current * 2.2 + Math.sin(clock.elapsedTime * 2 + i) * 0.05));
    bulbs.current.forEach((b) => b && (b.emissiveIntensity = 1.5 + glow.current * 2.5));
  });
  const chair = (p: V3, yaw: number) => (
    <group position={p} rotation={[0, yaw, 0]}>
      <Cyl r={0.26} h={0.06} p={[0, 0.45, 0]} c="#c89b6d" rough={0.9} />
      {[0.4, 1.2, 2, 2.8].map((a) => (
        <Cyl key={a} r={0.018} h={0.45} p={[Math.sin(a) * 0.19, 0.22, Math.cos(a) * 0.19]} rot={[Math.cos(a) * 0.08, 0, -Math.sin(a) * 0.08]} c="#3b2f2a" metal={0.4} rough={0.4} />
      ))}
      <mesh position={[0, 0.78, -0.2]} rotation={[0.15, 0, 0]} castShadow>
        <torusGeometry args={[0.22, 0.025, 10, 32, Math.PI]} />
        <meshStandardMaterial color="#3b2f2a" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
  return (
    <group>
      <Shell wall="#f2e3cf" side="#ead6bd" floor="#efe4d4" floorMap={tiles} />
      <B s={[6.0, 1.0, 0.05]} p={[0, 0.55, -2.34]} r={0.02} c="#c9856a" rough={0.9} />

      {/* Counter and espresso machine */}
      <B s={[3.2, 0.95, 0.7]} p={[1.0, 0.475, -1.95]} r={0.05} c="#8b5e3c" rough={0.55} />
      <B s={[3.35, 0.05, 0.8]} p={[1.0, 0.975, -1.95]} r={0.02} c="#efe9e1" rough={0.25} />
      <group position={[1.75, 1.0, -2.0]}>
        <B s={[0.72, 0.5, 0.45]} p={[0, 0.25, 0]} r={0.06} c="#bfc3c8" metal={0.7} rough={0.25} />
        <B s={[0.72, 0.06, 0.45]} p={[0, 0.53, 0]} r={0.02} c="#2e2e30" metal={0.5} rough={0.3} />
        {[-0.16, 0.16].map((x) => (
          <group key={x}>
            <Cyl r={0.045} h={0.1} p={[x, 0.18, 0.26]} c="#2e2e30" metal={0.6} rough={0.3} />
            <Cyl r={0.05} h={0.07} p={[x, 0.04, 0.27]} c="#f4efe7" rough={0.4} />
          </group>
        ))}
      </group>
      <group position={[0.5, 1.0, -1.95]}>
        <Cyl r={0.26} h={0.03} p={[0, 0.015, 0]} c="#efe9e1" rough={0.3} />
        <Cyl r={0.18} h={0.12} p={[0, 0.09, 0]} c="#e8b98a" rough={0.8} />
        <mesh position={[0, 0.03, 0]}>
          <sphereGeometry args={[0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#ffffff" transmission={0.9} roughness={0.05} thickness={0.05} transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Chalk menu */}
      <group position={[-1.2, 2.15, -2.34]}>
        <B s={[1.2, 0.8, 0.05]} p={[0, 0, 0]} r={0.02} c="#8b5e3c" />
        <B s={[1.08, 0.68, 0.02]} p={[0, 0, 0.03]} r={0.008} c="#2e2e2c" rough={1} shadow={false} />
        {[0.2, 0.05, -0.1, -0.22].map((y, i) => (
          <mesh key={y} position={[-0.12 + (i % 2) * 0.05, y, 0.045]}>
            <planeGeometry args={[0.6 - i * 0.08, 0.03]} />
            <meshBasicMaterial color="#e9e4da" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>

      {/* Pendant lights */}
      {[-1.0, 0.6, 2.1].map((x, i) => (
        <group key={x} position={[x, 0, x < 0 ? 0.1 : -1.3]}>
          <Cyl r={0.006} h={0.9} p={[0, 2.75, 0]} c="#3b2f2a" />
          <mesh position={[0, 2.3, 0]} castShadow>
            <sphereGeometry args={[0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={i === 1 ? '#f1e6d2' : '#d6a443'} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 2.26, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial ref={(m) => (bulbs.current[i] = m)} color="#fff4dc" emissive="#ffcf8a" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <pointLight ref={(l) => (lights.current[i] = l)} position={[0, 2.1, 0]} color="#ffc27a" intensity={2} distance={3.4} decay={1.6} />
        </group>
      ))}

      {/* Bistro table, two chairs, coffee and a croissant */}
      <group position={[0.3, 0, 0.2]}>
        <Cyl r={0.5} h={0.04} p={[0, 0.72, 0]} c="#efe9e1" rough={0.25} />
        <Cyl r={0.03} h={0.7} p={[0, 0.36, 0]} c="#3b2f2a" metal={0.5} rough={0.4} />
        <Cyl r={0.22} h={0.03} p={[0, 0.015, 0]} c="#3b2f2a" metal={0.5} rough={0.4} />
        <Mug p={[-0.22, 0.74, -0.12]} c="#f4efe7" steam={glow} />
        <Mug p={[0.2, 0.74, 0.18]} c="#c9856a" steam={glow} />
        <mesh position={[0.18, 0.77, -0.18]} rotation={[Math.PI / 2, 0, 0.5]} castShadow>
          <torusGeometry args={[0.09, 0.04, 12, 24, Math.PI * 1.2]} />
          <meshStandardMaterial color="#d59a55" roughness={0.6} />
        </mesh>
      </group>
      {chair([-0.55, 0, -0.25], 1.0)}
      {chair([1.15, 0, 0.7], -2.2)}

      <Plant p={[-2.45, 0, -1.9]} s={1.5} pot="#e8dfd2" />
      <Plant p={[2.5, 0, 1.4]} s={1.1} />
    </group>
  );
}

/* ------------------------------ Developer room ------------------------------ */

function DevScene({ lit }: Lit) {
  const floor = useMemo(() => woodTexture('#5a4a40', 17), []);
  const code = useMemo(
    () =>
      canvasTexture(640, 380, (ctx) => {
        ctx.fillStyle = '#12161f';
        ctx.fillRect(0, 0, 640, 380);
        ctx.fillStyle = '#1a1f2b';
        ctx.fillRect(0, 0, 150, 380);
        const cols = ['#7dd3c0', '#9db4ff', '#f0a8a0', '#e8c77a', '#c7b6f2'];
        const rand = seeded(5);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(12, 18 + i * 22, 18, 8);
          let x = 170 + (i % 4 === 0 ? 0 : 24 * (1 + (i % 3)));
          for (let w = 0; w < 3; w++) {
            const len = 30 + rand() * 90;
            ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
            ctx.fillRect(x, 18 + i * 22, len, 8);
            x += len + 10;
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let i = 0; i < 12; i++) ctx.fillRect(16, 18 + i * 28, 100 - (i % 3) * 20, 7);
      }),
    [],
  );
  const screens = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const strip = useRef<THREE.MeshStandardMaterial>(null);
  const under = useRef<THREE.MeshStandardMaterial>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  const glow = useGlow(lit, 0.35, 1);
  const hue = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    screens.current.forEach((m) => m && (m.emissiveIntensity = 0.8 + glow.current * 0.7 + Math.sin(t * 8) * 0.02));
    hue.setHSL((t * (0.03 + glow.current * 0.08)) % 1, 0.55, 0.6);
    strip.current?.emissive.copy(hue);
    under.current?.emissive.copy(hue);
    if (strip.current) strip.current.emissiveIntensity = 1.2 + glow.current * 1.5;
    if (glowLight.current) glowLight.current.intensity = 1.5 + glow.current * 2;
  });
  const brace = (flip: 1 | -1) => {
    const pts = [
      [0.12, 0.35],
      [0.02, 0.3],
      [0.03, 0.08],
      [-0.07, 0],
      [0.03, -0.08],
      [0.02, -0.3],
      [0.12, -0.35],
    ].map(([x, y]) => new THREE.Vector3(x * flip, y, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.018, 8, false);
  };
  const braces = useMemo(() => [brace(1), brace(-1)], []);
  return (
    <group>
      <Shell wall="#2d3342" side="#262b38" floor="#5a4a40" floorMap={floor} />
      <B s={[3.2, 0.025, 2.4]} p={[-0.6, 0.013, -0.3]} r={0.012} c="#4a5263" rough={1} shadow={false} />

      {/* Glowing braces on the wall */}
      <group position={[0.7, 2.1, -2.33]}>
        {braces.map((g, i) => (
          <mesh key={i} geometry={g} position={[i ? 0.25 : -0.25, 0, 0]}>
            <meshStandardMaterial color="#7dd3c0" emissive="#7dd3c0" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Window at dusk */}
      <group position={[2.0, 1.9, -2.33]}>
        <B s={[1.3, 1.0, 0.08]} p={[0, 0, 0]} r={0.04} c="#1f2430" />
        <RoundedBox args={[1.15, 0.85, 0.02]} radius={0.009} position={[0, 0, 0.04]}>
          <meshStandardMaterial color="#5d6ea3" emissive="#8a8fd0" emissiveIntensity={0.35} roughness={0.2} />
        </RoundedBox>
        <mesh position={[0.3, 0.2, 0.06]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color="#fff3cf" emissive="#fff3cf" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>

      {/* Desk along the left wall */}
      <B s={[1.0, 0.07, 2.7]} p={[-2.32, 0.74, -0.45]} r={0.03} c="#3b2f2a" rough={0.5} />
      {[-1.7, 0.8].map((z) => (
        <B key={z} s={[0.9, 0.7, 0.05]} p={[-2.32, 0.35, z]} r={0.02} c="#23262e" metal={0.3} />
      ))}
      <RoundedBox args={[0.05, 0.03, 2.5]} radius={0.01} position={[-1.83, 0.69, -0.45]}>
        <meshStandardMaterial ref={under} color="#111" emissive="#7dd3c0" emissiveIntensity={1.5} toneMapped={false} />
      </RoundedBox>

      {/* Two monitors facing Kivi */}
      {[
        { z: -1.05, yaw: Math.PI / 2 - 0.18 },
        { z: 0.15, yaw: Math.PI / 2 + 0.2 },
      ].map((m, i) => (
        <group key={i} position={[-2.5, 0.78, m.z]} rotation={[0, m.yaw, 0]}>
          <B s={[0.3, 0.02, 0.2]} p={[0, 0.01, 0]} r={0.008} c="#1b1b1f" metal={0.5} />
          <Cyl r={0.025} h={0.3} p={[0, 0.16, -0.02]} c="#1b1b1f" metal={0.5} rough={0.3} />
          <B s={[1.1, 0.64, 0.045]} p={[0, 0.58, 0]} r={0.02} c="#1b1b1f" metal={0.3} rough={0.4} />
          <mesh position={[0, 0.59, 0.025]}>
            <planeGeometry args={[1.04, 0.58]} />
            <meshStandardMaterial ref={(mm) => (screens.current[i] = mm)} map={code} emissiveMap={code} emissive="#ffffff" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
      <pointLight ref={glowLight} position={[-1.9, 1.3, -0.45]} color="#9db4ff" intensity={1.8} distance={2.6} />

      {/* Keyboard, mouse, mug, duck */}
      <B s={[0.26, 0.03, 0.78]} p={[-2.05, 0.79, -0.45]} r={0.012} c="#2a2d34" rough={0.5} />
      <B s={[0.2, 0.012, 0.7]} p={[-2.05, 0.81, -0.45]} r={0.004} c="#3a3e48" rough={0.6} shadow={false} />
      <B s={[0.1, 0.035, 0.07]} p={[-2.05, 0.795, 0.12]} r={0.03} c="#2a2d34" rough={0.4} />
      <Mug p={[-2.2, 0.78, 0.55]} c="#7dd3c0" steam={glow} />
      <group position={[-2.55, 0.78, -1.75]}>
        <mesh position={[0, 0.07, 0]} scale={[1, 0.8, 1.2]} castShadow>
          <sphereGeometry args={[0.08, 20, 16]} />
          <meshStandardMaterial color="#f2c94c" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.16, 0.04]} castShadow>
          <sphereGeometry args={[0.05, 20, 16]} />
          <meshStandardMaterial color="#f2c94c" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.155, 0.095]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.02, 0.04, 12]} />
          <meshStandardMaterial color="#e8894a" />
        </mesh>
      </group>

      {/* Tower PC with a soft light strip */}
      <B s={[0.5, 0.9, 0.22]} p={[-2.3, 0.45, 1.25]} r={0.03} c="#1f222a" metal={0.4} rough={0.35} />
      <RoundedBox args={[0.02, 0.8, 0.02]} radius={0.008} position={[-2.04, 0.45, 1.25]}>
        <meshStandardMaterial ref={strip} color="#111" emissive="#7dd3c0" emissiveIntensity={1.5} toneMapped={false} />
      </RoundedBox>

      {/* Gaming chair facing the desk */}
      <group position={[-1.38, 0, -0.45]} rotation={[0, -Math.PI / 2, 0]}>
        <B s={[0.7, 0.12, 0.66]} p={[0, 0.44, 0]} r={0.05} c="#3a4254" rough={0.9} />
        <B s={[0.7, 0.95, 0.1]} p={[0, 0.98, -0.34]} r={0.05} c="#3a4254" rough={0.9} />
        <B s={[0.5, 0.22, 0.06]} p={[0, 1.3, -0.29]} r={0.03} c="#7dd3c0" rough={0.8} />
        <Cyl r={0.035} h={0.36} p={[0, 0.22, 0]} c="#1b1b1f" metal={0.6} rough={0.35} />
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} s={[0.04, 0.03, 0.34]} p={[Math.sin((i / 5) * Math.PI * 2) * 0.15, 0.04, Math.cos((i / 5) * Math.PI * 2) * 0.15]} rot={[0, (i / 5) * Math.PI * 2, 0]} r={0.012} c="#1b1b1f" metal={0.5} />
        ))}
      </group>

      {/* Shelf with a few favourite things */}
      <group position={[-0.6, 1.95, -2.26]}>
        <B s={[1.3, 0.04, 0.26]} p={[0, 0, 0]} r={0.012} c="#5a4a40" />
        {['#c7b6f2', '#9db4ff', '#e8c77a'].map((c, i) => (
          <B key={c} s={[0.08, 0.3 - i * 0.03, 0.2]} p={[-0.5 + i * 0.1, 0.17 - i * 0.015, 0]} r={0.01} c={c} />
        ))}
        <Plant p={[0.35, 0.02, 0]} s={0.5} pot="#e8dfd2" />
      </group>
      <Plant p={[2.4, 0, -1.8]} s={1.35} pot="#3a4254" />
    </group>
  );
}

export const ROOMS: RoomDef[] = [
  {
    id: 'office',
    persona: 'Formal',
    label: 'Office',
    chip: 'Professional',
    outfit: 'suit',
    activity: 'type',
    line: 'Could you share the final report by Friday?',
    icon: 'office',
    position: [-7.8, 0, -1.0],
    rotation: 0.5,
    entry: [0.8, 0, 3.1],
    approach: [
      [1.7, 0, 0.9],
      [1.55, 0, -1.72],
      [0, 0, -1.72],
    ],
    seat: { position: [0, 0.36, -1.72], yaw: 0 },
    focus: [-0.45, 1.0, -0.9],
    camera: { position: [1.5, 2.35, 4.1], look: [-0.1, 1.05, -1.3] },
    Scene: OfficeScene,
  },
  {
    id: 'cafe',
    persona: 'Casual',
    label: 'Café',
    chip: 'Casual',
    outfit: 'casual',
    activity: 'sip',
    line: 'hey! coffee later?',
    icon: 'cafe',
    position: [0, 0, -4.6],
    rotation: 0,
    entry: [0.4, 0, 3.1],
    approach: [
      [0.1, 0, 1.6],
      [-0.75, 0, 0.9],
      [-0.55, 0, -0.25],
    ],
    seat: { position: [-0.55, 0.34, -0.25], yaw: 1.0 },
    focus: [0.08, 0.85, 0.08],
    camera: { position: [2.4, 2.15, 4.2], look: [-0.1, 1.0, -0.35] },
    Scene: CafeScene,
  },
  {
    id: 'dev',
    persona: 'Developer',
    label: 'Developer',
    chip: 'Developer',
    outfit: 'dev',
    activity: 'watch',
    line: 'fix: refresh token before it expires',
    icon: 'dev',
    position: [7.8, 0, -1.0],
    rotation: -0.5,
    entry: [0.4, 0, 3.1],
    approach: [
      [0.2, 0, 1.6],
      [-0.9, 0, 0.5],
      [-1.38, 0, -0.45],
    ],
    seat: { position: [-1.38, 0.36, -0.45], yaw: -Math.PI / 2 },
    focus: [-2.5, 1.35, -0.5],
    camera: { position: [2.1, 2.0, 3.4], look: [-1.5, 1.05, -0.5] },
    Scene: DevScene,
  },
];
