import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { seeded, V3 } from './util';

// Shared building blocks for the hubs: textures, soft-edged boxes, props.

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
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

export function woodTexture(base: string, seed: number) {
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
export function B({
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


export function Cyl({ r, h, p, c, rough = 0.6, metal = 0, rot, top }: { r: number; h: number; p: V3; c: string; rough?: number; metal?: number; rot?: V3; top?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, 32]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}


export function Plant({ p, s = 1, pot = '#c47a5a' }: { p: V3; s?: number; pot?: string }) {
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
export function Steam({ p, strength }: { p: V3; strength: React.MutableRefObject<number> }) {
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

export function Mug({ p, c = '#ece6db', steam }: { p: V3; c?: string; steam?: React.MutableRefObject<number> }) {
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
export function useGlow(lit: React.MutableRefObject<number>, base: number, boost: number) {
  const v = useRef(base);
  useFrame((_, dt) => {
    v.current = THREE.MathUtils.damp(v.current, base + lit.current * boost, 4, dt);
  });
  return v;
}

