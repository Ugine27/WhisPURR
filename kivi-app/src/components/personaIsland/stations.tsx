import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StationKind } from './personas';

/*
 * The five persona stations. Each is built from primitives in the island's
 * low-poly style and animates a little on its own (a flame, a gear, a
 * hovering cube); `focus` (0..1) brightens it while it is the selected one.
 */

interface StationProps {
  accent: string;
  focus: React.MutableRefObject<number>;
}

const flat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => ({ color, flatShading: true, roughness: 0.85, ...extra });

function Tower({ accent, focus }: StationProps) {
  const windows = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (windows.current) windows.current.emissiveIntensity = 0.35 + focus.current * 0.9;
  });
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[1.3, 0.3, 1.3]} />
        <meshStandardMaterial {...flat('#d8cbbb')} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <boxGeometry args={[0.95, 2.1, 0.95]} />
        <meshStandardMaterial ref={windows} color={accent} emissive={accent} emissiveIntensity={0.4} metalness={0.3} roughness={0.15} transparent opacity={0.85} />
      </mesh>
      {/* floor lines */}
      {[0.75, 1.25, 1.75].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.99, 0.04, 0.99]} />
          <meshStandardMaterial color="#f2ece4" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.46, 0]}>
        <boxGeometry args={[1.1, 0.12, 1.1]} />
        <meshStandardMaterial {...flat('#efe6da')} />
      </mesh>
      <mesh position={[0.3, 2.8, 0.3]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6]} />
        <meshStandardMaterial color="#8b7b6c" />
      </mesh>
    </group>
  );
}

function Cafe({ accent, focus }: StationProps) {
  const umbrella = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (umbrella.current) umbrella.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.04;
    if (lamp.current) lamp.current.emissiveIntensity = 0.6 + focus.current * 1.4;
  });
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.55, -0.15]}>
        <cylinderGeometry args={[0.62, 0.66, 1.1, 8]} />
        <meshStandardMaterial {...flat('#f3e3cf')} />
      </mesh>
      <mesh castShadow position={[0, 1.4, -0.15]}>
        <coneGeometry args={[0.88, 0.7, 8]} />
        <meshStandardMaterial {...flat(accent)} />
      </mesh>
      {/* door and window */}
      <mesh position={[0, 0.38, 0.47]}>
        <boxGeometry args={[0.3, 0.56, 0.05]} />
        <meshStandardMaterial {...flat('#8a5a44')} />
      </mesh>
      <mesh position={[0.36, 0.72, 0.36]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.22, 0.2, 0.05]} />
        <meshStandardMaterial ref={lamp} color="#ffe2a8" emissive="#ffc46b" emissiveIntensity={0.6} />
      </mesh>
      {/* table under an umbrella */}
      <group position={[0.85, 0, 0.6]}>
        <mesh castShadow position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 12]} />
          <meshStandardMaterial {...flat('#fff6ea')} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.3]} />
          <meshStandardMaterial color="#8b7b6c" />
        </mesh>
        <group ref={umbrella}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.55]} />
            <meshStandardMaterial color="#8b7b6c" />
          </mesh>
          <mesh castShadow position={[0, 0.85, 0]}>
            <coneGeometry args={[0.42, 0.2, 8]} />
            <meshStandardMaterial {...flat('#fff1f4')} />
          </mesh>
        </group>
        <mesh position={[0.02, 0.36, 0.05]}>
          <cylinderGeometry args={[0.04, 0.035, 0.08, 10]} />
          <meshStandardMaterial {...flat(accent)} />
        </mesh>
      </group>
    </group>
  );
}

function Monolith({ accent, focus }: StationProps) {
  const cube = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cube.current) {
      cube.current.rotation.set(t * 0.6, t * 0.8, 0);
      cube.current.position.y = 2.35 + Math.sin(t * 1.4) * 0.08;
    }
    if (mat.current) mat.current.emissiveIntensity = 0.3 + focus.current * 1.2;
  });
  return (
    <group>
      <mesh receiveShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.75, 0.8, 0.12, 6]} />
        <meshStandardMaterial {...flat('#d8cbbb')} />
      </mesh>
      <mesh castShadow position={[0, 1.02, 0]}>
        <boxGeometry args={[0.42, 1.8, 0.16]} />
        <meshStandardMaterial {...flat('#3b2c25', { roughness: 0.4 })} />
      </mesh>
      <mesh ref={cube} castShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial ref={mat} color={accent} emissive={accent} emissiveIntensity={0.4} flatShading />
      </mesh>
    </group>
  );
}

function Campfire({ accent, focus }: StationProps) {
  const flame = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const stones = useMemo(() => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flicker = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 17.3) * 0.05;
    if (flame.current) flame.current.scale.set(1, flicker * (1 + focus.current * 0.25), 1);
    if (light.current) light.current.intensity = (2.2 + focus.current * 2.5) * flicker;
  });
  return (
    <group>
      {stones.map((a) => (
        <mesh key={a} castShadow position={[Math.sin(a) * 0.42, 0.07, Math.cos(a) * 0.42]} rotation={[a, a * 2, 0]}>
          <dodecahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial {...flat('#9d8f84')} />
        </mesh>
      ))}
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} castShadow position={[0, 0.1, 0]} rotation={[0, r, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
          <meshStandardMaterial {...flat('#6e4a33')} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.12, 0]}>
        <mesh position={[0, 0.25, 0]}>
          <coneGeometry args={[0.2, 0.55, 7]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} flatShading />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.11, 0.35, 7]} />
          <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={2} flatShading />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 0.6, 0]} color="#ff9a55" distance={4.5} decay={1.6} />
      {/* log seats */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} castShadow position={[x, 0.12, 0.2]} rotation={[Math.PI / 2, 0, 0.3 * Math.sign(x)]}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 7]} />
          <meshStandardMaterial {...flat('#8a5c3e')} />
        </mesh>
      ))}
    </group>
  );
}

function Workshop({ accent, focus }: StationProps) {
  const gear = useRef<THREE.Group>(null);
  const blink = useRef<THREE.MeshStandardMaterial>(null);
  const teeth = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  useFrame(({ clock }, dt) => {
    if (gear.current) gear.current.rotation.z -= dt * (0.5 + focus.current * 1.5);
    if (blink.current) blink.current.emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0.3 ? 2.5 : 0.2;
  });
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.55, -0.1]}>
        <boxGeometry args={[1.25, 1.1, 0.95]} />
        <meshStandardMaterial {...flat('#e4d6c4')} />
      </mesh>
      {/* pitched roof */}
      <mesh castShadow position={[0, 1.3, -0.1]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.95, 0.95, 1.05]} />
        <meshStandardMaterial {...flat(accent)} />
      </mesh>
      <mesh position={[-0.28, 0.4, 0.38]}>
        <boxGeometry args={[0.4, 0.62, 0.04]} />
        <meshStandardMaterial {...flat('#5a4a3f')} />
      </mesh>
      <group ref={gear} position={[0.3, 0.62, 0.4]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.07, 14]} />
          <meshStandardMaterial color="#c9b38a" metalness={0.6} roughness={0.35} />
        </mesh>
        {teeth.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.08, 0.07, 0.07]} />
            <meshStandardMaterial color="#c9b38a" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {/* antenna */}
      <mesh position={[0.45, 1.9, -0.35]}>
        <cylinderGeometry args={[0.018, 0.018, 1.0]} />
        <meshStandardMaterial color="#6d6259" />
      </mesh>
      <mesh position={[0.45, 2.42, -0.35]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial ref={blink} color="#ff6b5a" emissive="#ff4a3a" />
      </mesh>
    </group>
  );
}

const BUILDINGS: Record<StationKind, (p: StationProps) => JSX.Element> = {
  tower: Tower,
  cafe: Cafe,
  monolith: Monolith,
  campfire: Campfire,
  workshop: Workshop,
};

export function Station({ kind, ...props }: StationProps & { kind: StationKind }) {
  const Building = BUILDINGS[kind];
  return <Building {...props} />;
}
