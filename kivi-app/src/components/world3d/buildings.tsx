import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { B, canvasTexture, Cyl, Plant } from './rooms';
import { seeded, V3 } from './util';

/*
 * The outside of each room: a real little building around the interior.
 * Its front wall (with the door and windows) dissolves when Kivi takes you
 * inside, so the camera can follow into the room.
 */

export type ExteriorStyle = 'office' | 'cafe' | 'dev';

const W = 6.2; // footprint matches the interior floor
const D = 5.2;
const H = 3.2;
const T = 0.24;
export const DOOR = { x: 0.6, w: 1.0, h: 2.15 };

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
  arch?: boolean;
}

// A wall slab with real openings cut through it (door, windows).
function wallGeometry(width: number, height: number, depth: number, holes: Hole[]) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.lineTo(-width / 2, 0);
  for (const h of holes) {
    const p = new THREE.Path();
    const l = h.x - h.w / 2;
    const r = h.x + h.w / 2;
    if (h.arch) {
      const rad = h.w / 2;
      p.moveTo(l, h.y);
      p.lineTo(r, h.y);
      p.lineTo(r, h.y + h.h - rad);
      p.absarc(h.x, h.y + h.h - rad, rad, 0, Math.PI, false);
      p.lineTo(l, h.y);
    } else {
      p.moveTo(l, h.y);
      p.lineTo(l, h.y + h.h);
      p.lineTo(r, h.y + h.h);
      p.lineTo(r, h.y);
      p.lineTo(l, h.y);
    }
    shape.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function brickTexture() {
  const rand = seeded(8);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#d9c8b4';
      ctx.fillRect(0, 0, 512, 512);
      const bh = 32;
      const bw = 96;
      for (let row = 0; row < 512 / bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < 512 + bw; x += bw) {
          const tone = 0.85 + rand() * 0.25;
          ctx.fillStyle = `rgb(${Math.floor(178 * tone)},${Math.floor(98 * tone)},${Math.floor(74 * tone)})`;
          ctx.fillRect(x + off + 3, row * bh + 3, bw - 6, bh - 6);
        }
      }
    },
    [1, 1],
  );
}

function claddingTexture() {
  const rand = seeded(12);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#2f3440';
      ctx.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 32) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.04})`;
        ctx.fillRect(x, 0, 30, 512);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x + 30, 0, 2, 512);
        for (let g = 0; g < 3; g++) {
          ctx.strokeStyle = `rgba(255,255,255,${0.03 + rand() * 0.03})`;
          ctx.beginPath();
          const gx = x + 4 + rand() * 22;
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 3, 170, gx - 3, 340, gx + 2, 512);
          ctx.stroke();
        }
      }
    },
    [1, 1],
  );
}

function plasterTexture() {
  const rand = seeded(4);
  return canvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#ece5d9';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '120,100,80'},${0.03 + rand() * 0.04})`;
        ctx.fillRect(rand() * 256, rand() * 256, 2 + rand() * 3, 2 + rand() * 3);
      }
    },
    [1, 1],
  );
}

interface StyleSpec {
  wall: THREE.Texture;
  wallColor: string;
  repeat: number; // texture repeats per metre
  windows: Hole[];
  frame: string;
  doorColor: string;
  doorGlass: boolean;
  roof: 'flat' | 'gable' | 'overhang';
  roofColor: string;
  interiorGlow: string;
}

function useStyle(style: ExteriorStyle): StyleSpec {
  return useMemo(() => {
    if (style === 'office')
      return {
        wall: plasterTexture(),
        wallColor: '#ffffff',
        repeat: 0.5,
        windows: [
          { x: -1.55, y: 0.75, w: 2.1, h: 1.9 },
          { x: 2.25, y: 0.75, w: 0.95, h: 1.9 },
        ],
        frame: '#23262b',
        doorColor: '#23262b',
        doorGlass: true,
        roof: 'flat',
        roofColor: '#d9d3c8',
        interiorGlow: '#ffe7c2',
      };
    if (style === 'cafe')
      return {
        wall: brickTexture(),
        wallColor: '#ffffff',
        repeat: 0.9,
        windows: [
          { x: -1.35, y: 0.7, w: 2.3, h: 1.8, arch: true },
          { x: 2.2, y: 0.9, w: 0.9, h: 1.5, arch: true },
        ],
        frame: '#2f4a3a',
        doorColor: '#2f4a3a',
        doorGlass: true,
        roof: 'gable',
        roofColor: '#a8583f',
        interiorGlow: '#ffc27a',
      };
    return {
      wall: claddingTexture(),
      wallColor: '#ffffff',
      repeat: 0.8,
      windows: [
        { x: -1.45, y: 1.0, w: 2.3, h: 1.3 },
        { x: 2.2, y: 1.0, w: 0.9, h: 1.3 },
      ],
      frame: '#15171b',
      doorColor: '#15171b',
      doorGlass: false,
      roof: 'overhang',
      roofColor: '#23262e',
      interiorGlow: '#9db4ff',
    };
  }, [style]);
}

// Fades a group's materials together; hides it entirely once invisible.
function useFade(group: React.RefObject<THREE.Group>, amount: React.MutableRefObject<number>) {
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const a = 1 - amount.current;
    g.visible = a > 0.01;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || Array.isArray(m)) return;
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
      const fading = a < 0.999;
      if (m.transparent !== (fading || m.userData.baseOpacity < 1)) {
        m.transparent = fading || m.userData.baseOpacity < 1;
        m.needsUpdate = true;
      }
      m.opacity = m.userData.baseOpacity * a;
      m.depthWrite = !fading && m.userData.baseOpacity >= 1;
    });
  });
}

function Glass({ hole, frame, glow, lit }: { hole: Hole; frame: string; glow: string; lit: React.MutableRefObject<number> }) {
  const pane = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (pane.current) pane.current.emissiveIntensity = 0.08 + lit.current * 0.35;
  });
  const cy = hole.y + hole.h / 2;
  const g = useMemo(() => wallGeometry(hole.w + 0.12, hole.h + 0.12, 0.06, [{ ...hole, x: 0, y: 0.06 }]), [hole]);
  return (
    <group>
      <mesh geometry={g} position={[hole.x, hole.y - 0.06, T / 2 + 0.01]} castShadow>
        <meshStandardMaterial color={frame} roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[hole.x, cy, 0]}>
        <planeGeometry args={[hole.w, hole.h]} />
        <meshStandardMaterial ref={pane} color="#dfe8ec" emissive={glow} emissiveIntensity={0.1} roughness={0.04} metalness={0.2} transparent opacity={0.28} envMapIntensity={2} depthWrite={false} />
      </mesh>
      {!hole.arch && <B s={[0.035, hole.h, 0.05]} p={[hole.x, cy, 0.03]} r={0.01} c={frame} metal={0.4} />}
      <B s={[hole.w + 0.2, 0.06, 0.2]} p={[hole.x, hole.y - 0.06, T / 2 + 0.06]} r={0.02} c="#e6ded2" />
    </group>
  );
}

function Door({ spec, swing }: { spec: StyleSpec; swing: React.MutableRefObject<number> }) {
  const hinge = useRef<THREE.Group>(null);
  useFrame(() => {
    // Swings inward, away from the viewer.
    if (hinge.current) hinge.current.rotation.y = swing.current * 1.75;
  });
  const leafW = DOOR.w - 0.04;
  return (
    <group ref={hinge} position={[DOOR.x - DOOR.w / 2 + 0.02, 0, 0]}>
      <B s={[leafW, DOOR.h - 0.04, 0.06]} p={[leafW / 2, DOOR.h / 2, 0]} r={0.02} c={spec.doorColor} rough={0.5} metal={0.2} />
      {spec.doorGlass && (
        <mesh position={[leafW / 2, DOOR.h * 0.62, 0.035]}>
          <planeGeometry args={[leafW - 0.28, DOOR.h * 0.5]} />
          <meshStandardMaterial color="#dfe8ec" emissive={spec.interiorGlow} emissiveIntensity={0.12} roughness={0.05} transparent opacity={0.45} />
        </mesh>
      )}
      <mesh position={[leafW - 0.12, 1.02, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.08, 16]} />
        <meshStandardMaterial color="#c8a36a" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Awning() {
  const tex = useMemo(
    () =>
      canvasTexture(
        256,
        64,
        (ctx) => {
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 ? '#f4ede0' : '#c9674b';
            ctx.fillRect(i * 32, 0, 32, 64);
          }
        },
        [3, 1],
      ),
    [],
  );
  return (
    <group position={[-0.4, 2.75, 2.6]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 4.6, 32, 1, true, 0, Math.PI / 2]} />
        <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function HangingSign() {
  const face = useMemo(
    () =>
      canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = '#2f4a3a';
        ctx.beginPath();
        ctx.arc(64, 64, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e9dcc3';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, 52);
        ctx.lineTo(80, 52);
        ctx.lineTo(76, 88);
        ctx.lineTo(44, 88);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(86, 66, 9, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }),
    [],
  );
  return (
    <group position={[2.95, 2.55, 2.9]}>
      <B s={[0.05, 0.05, 0.6]} p={[0, 0.25, -0.2]} r={0.015} c="#1c1c1c" metal={0.6} />
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 40]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.021, -0.05, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <circleGeometry args={[0.27, 40]} />
          <meshStandardMaterial map={face} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Roof({ spec }: { spec: StyleSpec }) {
  const gable = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2 - 0.35, 0);
    sh.lineTo(W / 2 + 0.35, 0);
    sh.lineTo(0, 1.35);
    sh.lineTo(-W / 2 - 0.35, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: D + 0.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    g.translate(0, 0, -(D + 0.5) / 2);
    return g;
  }, []);
  if (spec.roof === 'gable')
    return (
      <group position={[0, H, 0]}>
        <mesh geometry={gable} castShadow receiveShadow>
          <meshStandardMaterial color={spec.roofColor} roughness={0.8} />
        </mesh>
        <B s={[W + 0.3, 0.12, D + 0.3]} p={[0, 0.02, 0]} r={0.04} c="#e8ddd0" />
      </group>
    );
  if (spec.roof === 'overhang')
    return (
      <group position={[0, H, 0]}>
        <B s={[W + 0.9, 0.16, D + 0.9]} p={[0, 0.08, 0.2]} r={0.05} c={spec.roofColor} rough={0.6} />
        <RoundedStrip />
      </group>
    );
  return (
    <group position={[0, H, 0]}>
      <B s={[W + 0.2, 0.2, D + 0.2]} p={[0, 0.1, 0]} r={0.05} c={spec.roofColor} rough={0.85} />
      <B s={[W + 0.2, 0.3, 0.12]} p={[0, 0.35, D / 2 + 0.04]} r={0.04} c="#e9e3d8" />
      <B s={[W + 0.2, 0.3, 0.12]} p={[0, 0.35, -D / 2 - 0.04]} r={0.04} c="#e9e3d8" />
      <B s={[0.12, 0.3, D + 0.2]} p={[W / 2 + 0.04, 0.35, 0]} r={0.04} c="#e9e3d8" />
      <B s={[0.12, 0.3, D + 0.2]} p={[-W / 2 - 0.04, 0.35, 0]} r={0.04} c="#e9e3d8" />
    </group>
  );
}

// A soft light strip under the studio's roof overhang.
function RoundedStrip() {
  return (
    <mesh position={[0, -0.01, D / 2 + 0.6]}>
      <boxGeometry args={[W + 0.6, 0.02, 0.04]} />
      <meshStandardMaterial color="#111" emissive="#7dd3c0" emissiveIntensity={2} toneMapped={false} />
    </mesh>
  );
}

function OutdoorDressing({ style }: { style: ExteriorStyle }) {
  if (style === 'cafe')
    return (
      <group>
        <Awning />
        <HangingSign />
        <group position={[-1.9, 0, 3.7]}>
          <Cyl r={0.34} h={0.04} p={[0, 0.72, 0]} c="#efe9e1" rough={0.3} />
          <Cyl r={0.025} h={0.7} p={[0, 0.36, 0]} c="#2b2b2b" metal={0.5} rough={0.4} />
          {[-0.55, 0.55].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <Cyl r={0.2} h={0.05} p={[0, 0.45, 0]} c="#b98a5e" rough={0.8} />
              <Cyl r={0.015} h={0.45} p={[0, 0.22, 0]} c="#2b2b2b" metal={0.5} />
            </group>
          ))}
        </group>
        {[-2.6, 2.7].map((x) => (
          <Plant key={x} p={[x, 0, 3.0]} s={0.9} pot="#8a5a3c" />
        ))}
      </group>
    );
  if (style === 'office')
    return (
      <group>
        <B s={[0.5, 0.26, 0.03]} p={[1.45, 1.75, 2.63]} r={0.01} c="#b08d57" metal={0.8} rough={0.3} />
        {[-2.7, 2.75].map((x) => (
          <group key={x} position={[x, 0, 3.0]}>
            <B s={[0.5, 0.55, 0.5]} p={[0, 0.275, 0]} r={0.05} c="#d8d2c6" />
            <mesh position={[0, 0.85, 0]} castShadow>
              <sphereGeometry args={[0.36, 24, 18]} />
              <meshStandardMaterial color="#6f8f5e" roughness={0.9} />
            </mesh>
          </group>
        ))}
        <B s={[1.6, 0.08, 0.9]} p={[DOOR.x, 0.04, 3.05]} r={0.03} c="#cfc7ba" />
      </group>
    );
  return (
    <group>
      <group position={[2.6, 0, 3.2]}>
        <Cyl r={0.03} h={0.95} p={[0, 0.47, 0]} c="#15171b" metal={0.6} rough={0.3} />
        <mesh position={[0, 0.98, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#7dd3c0" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
      <Plant p={[-2.6, 0, 3.0]} s={1.0} pot="#23262e" />
      <B s={[1.4, 0.08, 0.9]} p={[DOOR.x, 0.04, 3.05]} r={0.03} c="#3a3f4a" />
    </group>
  );
}

interface BuildingProps {
  style: ExteriorStyle;
  lit: React.MutableRefObject<number>;
  open: React.MutableRefObject<number>; // 0 = closed building, 1 = front removed
  door: React.MutableRefObject<number>; // 0 = shut, 1 = wide open
  sideColor: string;
}

export function BuildingShell({ style, lit, open, door, sideColor }: BuildingProps) {
  const spec = useStyle(style);
  const front = useRef<THREE.Group>(null);
  useFade(front, open);

  const facade = useMemo(() => wallGeometry(W, H, T, [{ x: DOOR.x, y: 0, w: DOOR.w, h: DOOR.h, arch: style === 'cafe' }, ...spec.windows]), [spec, style]);
  const side = useMemo(() => wallGeometry(D + 0.32, H, 0.05, []), []);
  const back = useMemo(() => new THREE.BoxGeometry(W + 0.52, H, 0.05), []);

  // Scale the wall texture to metres on every surface that uses it.
  useLayoutEffect(() => {
    spec.wall.repeat.set(spec.repeat, spec.repeat);
    spec.wall.wrapS = spec.wall.wrapT = THREE.RepeatWrapping;
  }, [spec]);
  const wallMat = <meshStandardMaterial map={spec.wall} color={spec.wallColor} roughness={0.9} />;

  return (
    <group>
      {/* Exterior skins on the three closed sides */}
      <mesh geometry={side} position={[-W / 2 - 0.13, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        {wallMat}
      </mesh>
      <mesh geometry={side} position={[W / 2 + 0.03, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        {wallMat}
      </mesh>
      <B s={[0.24, H, D]} p={[W / 2 - 0.12, H / 2, 0]} r={0.08} c={sideColor} rough={0.95} />
      <mesh geometry={back} position={[0, H / 2, -D / 2 - 0.13]} castShadow receiveShadow>
        {wallMat}
      </mesh>
      <Roof spec={spec} />
      <OutdoorDressing style={style} />

      {/* The front: dissolves as the camera follows Kivi in */}
      <group ref={front} position={[0, 0, D / 2 - T / 2]}>
        <mesh geometry={facade} castShadow receiveShadow>
          {wallMat}
        </mesh>
        {spec.windows.map((h, i) => (
          <Glass key={i} hole={h} frame={spec.frame} glow={spec.interiorGlow} lit={lit} />
        ))}
        <Door spec={spec} swing={door} />
      </group>
    </group>
  );
}

// Door and walk points in the room's own coordinates.
export const DOORSTEP: V3 = [DOOR.x, 0, D / 2 + 1.0];
export const THRESHOLD: V3 = [DOOR.x, 0, D / 2 - 0.9];
