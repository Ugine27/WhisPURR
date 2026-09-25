import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { B, canvasTexture, Cyl, Plant, woodTexture } from './rooms';
import { seeded, V3 } from './util';

/*
 * Kivi's foyer: a warm, dim room on the near side of an arched wooden door.
 * The whole world waits on the other side. Everything here is in world
 * coordinates; the door sits in the wall at z = FOYER_DOOR_Z.
 */

export const FOYER_DOOR_Z = 17;
export const FOYER_KIWI: V3 = [0, 0, 20.4];
const W = 6.4;
const H = 3.5;
const DEPTH = 6.4;
const ARCH_W = 1.9;
const ARCH_H = 2.8;

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

function panelTexture() {
  const rand = seeded(31);
  return canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#6a4a33';
      ctx.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 128) {
        ctx.fillStyle = `rgba(255,230,200,${0.03 + rand() * 0.04})`;
        ctx.fillRect(x + 10, 20, 108, 472);
        ctx.strokeStyle = 'rgba(30,18,10,0.45)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 10, 20, 108, 472);
        for (let g = 0; g < 9; g++) {
          ctx.strokeStyle = `rgba(40,25,15,${0.08 + rand() * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const gx = x + 14 + rand() * 100;
          ctx.moveTo(gx, 22);
          ctx.bezierCurveTo(gx + 8, 160, gx - 8, 330, gx + 4, 490);
          ctx.stroke();
        }
      }
    },
    [3, 1],
  );
}

function plankTexture() {
  const rand = seeded(44);
  return canvasTexture(
    256,
    512,
    (ctx) => {
      ctx.fillStyle = '#7a5234';
      ctx.fillRect(0, 0, 256, 512);
      for (let x = 0; x < 256; x += 42) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,220,180' : '40,20,10'},${0.05 + rand() * 0.07})`;
        ctx.fillRect(x, 0, 42, 512);
        ctx.fillStyle = 'rgba(30,15,5,0.5)';
        ctx.fillRect(x, 0, 3, 512);
        for (let g = 0; g < 6; g++) {
          ctx.strokeStyle = `rgba(50,28,12,${0.12 + rand() * 0.1})`;
          ctx.beginPath();
          const gx = x + 6 + rand() * 32;
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 5, 170, gx - 5, 340, gx + 3, 512);
          ctx.stroke();
        }
      }
    },
    [1, 1],
  );
}

export default function Foyer({ visible, open, pull }: { visible: boolean; open: React.MutableRefObject<number>; pull: React.MutableRefObject<number> }) {
  const floor = useMemo(() => woodTexture('#8a6446', 61), []);
  const panels = useMemo(panelTexture, []);
  const planks = useMemo(plankTexture, []);
  const hinge = useRef<THREE.Group>(null);
  const spill = useRef<THREE.SpotLight>(null);
  const leak = useRef<THREE.MeshBasicMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const spillTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, FOYER_DOOR_Z + 5);
    return o;
  }, []);

  const wall = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, H);
    s.lineTo(-W / 2, H);
    s.lineTo(-W / 2, 0);
    const hole = archShape(ARCH_W, ARCH_H);
    s.holes.push(new THREE.Path(hole.getPoints(48)));
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48 });
    g.translate(0, 0, -0.15);
    return g;
  }, []);
  const frame = useMemo(() => {
    const outer = archShape(ARCH_W + 0.26, ARCH_H + 0.13);
    outer.holes.push(new THREE.Path(archShape(ARCH_W, ARCH_H).getPoints(48)));
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48 });
    return g;
  }, []);
  const leaf = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(archShape(ARCH_W - 0.06, ARCH_H - 0.03), { depth: 0.09, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 48 });
    // Hinge on the left edge.
    g.translate((ARCH_W - 0.06) / 2, 0, -0.045);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 3);
    return g;
  }, []);
  const glow = useMemo(() => {
    const ring = archShape(ARCH_W + 0.02, ARCH_H + 0.01);
    ring.holes.push(new THREE.Path(archShape(ARCH_W - 0.08, ARCH_H - 0.05).getPoints(48)));
    return new THREE.ShapeGeometry(ring, 48);
  }, []);

  useFrame(({ clock }) => {
    const o = open.current;
    // The door swings into the foyer, towards Kivi and the viewer.
    if (hinge.current) hinge.current.rotation.y = -o * 1.9;
    if (spill.current) spill.current.intensity = o * 60;
    // Light leaking around the closed door, breathing gently.
    if (leak.current) leak.current.opacity = (1 - o) * (0.55 + Math.sin(clock.elapsedTime * 1.6) * 0.15) + pull.current * 0.3;
    if (lamp.current) lamp.current.intensity = 5 + Math.sin(clock.elapsedTime * 7) * 0.08;
  });

  const zc = FOYER_DOOR_Z + DEPTH / 2;
  return (
    <group visible={visible}>
      {/* Floor, ceiling, walls */}
      <B s={[W, 0.2, DEPTH]} p={[0, -0.1, zc]} r={0.05} c="#8a6446" map={floor} rough={0.55} />
      <B s={[W, 0.2, DEPTH]} p={[0, H + 0.1, zc]} r={0.05} c="#5b3f2c" rough={0.8} />
      {[-1.6, 0, 1.6].map((x) => (
        <B key={x} s={[0.22, 0.2, DEPTH]} p={[x, H - 0.1, zc]} r={0.04} c="#4a3222" rough={0.7} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <B s={[0.24, H, DEPTH]} p={[s * (W / 2 + 0.12), H / 2, zc]} r={0.06} c="#e9dcc8" rough={0.95} />
          <B s={[0.06, 1.2, DEPTH - 0.1]} p={[s * (W / 2 - 0.03), 0.6, zc]} r={0.02} c="#ffffff" map={panels} rough={0.6} />
        </group>
      ))}
      <B s={[W + 0.5, H, 0.24]} p={[0, H / 2, FOYER_DOOR_Z + DEPTH]} r={0.06} c="#e9dcc8" rough={0.95} />
      <mesh geometry={wall} position={[0, 0, FOYER_DOOR_Z]} castShadow receiveShadow>
        <meshStandardMaterial color="#e9dcc8" roughness={0.95} />
      </mesh>
      <mesh geometry={frame} position={[0, 0, FOYER_DOOR_Z + 0.12]} castShadow>
        <meshStandardMaterial color="#4a3222" roughness={0.55} />
      </mesh>

      {/* The door */}
      <mesh geometry={glow} position={[0, 0, FOYER_DOOR_Z + 0.02]}>
        <meshBasicMaterial ref={leak} color="#fff4dc" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={hinge} position={[-(ARCH_W - 0.06) / 2, 0.015, FOYER_DOOR_Z + 0.06]}>
        <mesh geometry={leaf} castShadow>
          <meshStandardMaterial map={planks} color="#ffffff" roughness={0.6} />
        </mesh>
        {[0.55, 2.0].map((y) => (
          <B key={y} s={[ARCH_W - 0.3, 0.07, 0.02]} p={[(ARCH_W - 0.06) / 2, y, 0.06]} r={0.01} c="#2a2320" metal={0.7} rough={0.4} />
        ))}
        <mesh position={[ARCH_W - 0.3, 1.1, 0.1]} castShadow>
          <torusGeometry args={[0.07, 0.014, 12, 28]} />
          <meshStandardMaterial color="#c8a36a" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[ARCH_W - 0.3, 1.18, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
          <meshStandardMaterial color="#c8a36a" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
      <primitive object={spillTarget} />
      <spotLight ref={spill} position={[0, 2.2, FOYER_DOOR_Z - 1.2]} target={spillTarget} angle={0.7} penumbra={0.9} color="#fff3dc" intensity={0} distance={14} decay={1.5} />
      <Sparkles count={40} scale={[1.6, 2.4, 2.4]} position={[0, 1.4, FOYER_DOOR_Z + 0.8]} size={3} speed={0.35} opacity={0.8} color="#fff1cf" />

      {/* A few things that hint at Kivi's many worlds */}
      <B s={[3.2, 0.02, 2.4]} p={[0, 0.011, zc + 0.4]} r={0.01} c="#b8745a" rough={1} shadow={false} />
      <group position={[-2.5, 0, zc + 1.4]}>
        <Cyl r={0.2} h={0.03} p={[0, 0.015, 0]} c="#2a2320" metal={0.6} rough={0.4} />
        <Cyl r={0.02} h={1.5} p={[0, 0.75, 0]} c="#2a2320" metal={0.6} rough={0.4} />
        <mesh position={[0, 1.55, 0]} castShadow>
          <coneGeometry args={[0.24, 0.28, 32, 1, true]} />
          <meshStandardMaterial color="#efe0c4" roughness={0.8} side={THREE.DoubleSide} emissive="#ffcf8a" emissiveIntensity={0.4} />
        </mesh>
        <pointLight ref={lamp} position={[0, 1.4, 0]} color="#ffbe76" intensity={5} distance={7} decay={1.6} />
      </group>
      <group position={[2.5, 0, zc + 0.6]}>
        <Cyl r={0.025} h={1.75} p={[0, 0.875, 0]} c="#4a3222" rough={0.5} />
        {[0, 2.1, 4.2].map((a) => (
          <Cyl key={a} r={0.012} h={0.3} p={[Math.sin(a) * 0.12, 1.62, Math.cos(a) * 0.12]} rot={[Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7]} c="#4a3222" rough={0.5} />
        ))}
        {/* hints of the outfits waiting inside */}
        <mesh position={[0.16, 1.52, 0.05]} scale={[0.6, 1, 0.35]} castShadow>
          <sphereGeometry args={[0.2, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
          <meshPhysicalMaterial color="#2c3a50" roughness={0.8} sheen={1} sheenColor="#6d7fa3" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.12, 1.78, 0.08]} castShadow>
          <sphereGeometry args={[0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d6a443" roughness={1} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.02, 1.45, -0.15]} rotation={[0, 0, 0.2]}>
          <torusGeometry args={[0.11, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#1f1f22" roughness={0.4} />
        </mesh>
      </group>
      <group position={[2.55, 0, FOYER_DOOR_Z + 1.2]}>
        <B s={[0.5, 0.8, 1.2]} p={[0, 0.4, 0]} r={0.04} c="#5b3f2c" rough={0.5} />
        <Plant p={[0, 0.8, 0.25]} s={0.7} pot="#e8dfd2" />
      </group>
      <Plant p={[-2.5, 0, FOYER_DOOR_Z + 0.9]} s={1.3} pot="#b8745a" />
    </group>
  );
}
