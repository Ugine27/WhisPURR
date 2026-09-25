import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Station } from './stations';
import { ISLAND_PERSONAS, RING, STEP, TOP } from './personas';

/*
 * Kivi's dial island: a floating turntable in a dusk sky with one station per
 * persona around its rim. Selecting a persona spins the island like the
 * Alt+scroll dial until that station faces the camera, and Kivi hops in
 * place at the front while the ground turns under it.
 */

const KIVI_URL = '/models/kivi.glb';

// Shortest signed angle from a to b.
const angleTo = (a: number, b: number) => ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// Deterministic pseudo-random so the island looks the same every visit.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

interface SceneProps {
  selected: number;
  active: number;
  reduced: boolean;
  onSelect: (i: number) => void;
}

/* --------------------------------- island --------------------------------- */

function Rock() {
  // An inverted, lumpy cone under the grass: the floating part of the island.
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(5.05, 3.8, 14, 5, true);
    g.rotateX(Math.PI);
    g.translate(0, -1.9 - 0.25, 0);
    const pos = g.attributes.position;
    const rnd = seeded(7);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > -0.3) continue; // keep the rim flush with the grass
      const k = 1 + (rnd() - 0.5) * 0.28;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
      pos.setY(i, y + (rnd() - 0.5) * 0.35);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#b0856a" emissive="#5a3a2c" emissiveIntensity={0.35} flatShading roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Island({ selected, active, onSelect, focus }: Omit<SceneProps, 'reduced'> & { focus: React.MutableRefObject<number>[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const beacon = useRef<THREE.Group>(null);
  const rings = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const scenery = useMemo(() => {
    const rnd = seeded(42);
    const trees: { x: number; z: number; s: number }[] = [];
    const pebbles: { x: number; z: number; s: number; r: number }[] = [];
    for (let i = 0; i < 26; i++) {
      // Between stations, near the rim, so nothing blocks a building.
      const a = (Math.floor(rnd() * ISLAND_PERSONAS.length) + 0.5 + (rnd() - 0.5) * 0.35) * STEP;
      const r = 3.3 + rnd() * 1.4;
      if (i < 12) trees.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s: 0.6 + rnd() * 0.5 });
      else pebbles.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s: 0.06 + rnd() * 0.08, r: rnd() * 6 });
    }
    return { trees, pebbles };
  }, []);

  useFrame(({ clock }, dt) => {
    ISLAND_PERSONAS.forEach((_, i) => {
      focus[i].current = damp(focus[i].current, i === selected || i === hovered ? 1 : 0, 5, dt);
      const m = rings.current[i];
      if (m) m.emissiveIntensity = 0.15 + focus[i].current * 1.1;
    });
    if (beacon.current) {
      const a = active * STEP;
      beacon.current.position.set(Math.sin(a) * RING, 3.35 + Math.sin(clock.elapsedTime * 1.6) * 0.1, Math.cos(a) * RING);
      beacon.current.rotation.y += dt * 1.2;
    }
  });

  return (
    <group>
      {/* grass top and dirt edge */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[5.2, 5.05, 0.5, 56]} />
        <meshStandardMaterial color="#a9b86f" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[5.07, 5.05, 0.1, 56]} />
        <meshStandardMaterial color="#b98663" flatShading />
      </mesh>
      <Rock />

      {/* the dial track stations sit on */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TOP + 0.005, 0]} receiveShadow>
        <ringGeometry args={[RING - 0.35, RING + 0.35, 72]} />
        <meshStandardMaterial color="#e6cfa6" roughness={1} />
      </mesh>

      {/* Kivi's home tree in the middle */}
      <group position={[0, TOP, 0]}>
        <mesh castShadow position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.14, 0.22, 1.4, 7]} />
          <meshStandardMaterial color="#7a5439" flatShading />
        </mesh>
        {[
          [0, 1.75, 0, 1.0],
          [0.45, 1.45, 0.2, 0.7],
          [-0.4, 1.5, -0.15, 0.72],
          [0.05, 2.35, -0.05, 0.62],
        ].map(([x, y, z, s], i) => (
          <mesh key={i} castShadow position={[x, y, z]} scale={s}>
            <icosahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color={i % 2 ? '#8ea85a' : '#7f9b4e'} flatShading />
          </mesh>
        ))}
      </group>

      {scenery.trees.map((t, i) => (
        <group key={i} position={[t.x, TOP, t.z]} scale={t.s}>
          <mesh castShadow position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.5, 5]} />
            <meshStandardMaterial color="#7a5439" flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.8, 0]}>
            <coneGeometry args={[0.38, 0.95, 6]} />
            <meshStandardMaterial color={i % 3 ? '#6f8f4a' : '#86a257'} flatShading />
          </mesh>
        </group>
      ))}
      {scenery.pebbles.map((p, i) => (
        <mesh key={i} castShadow position={[p.x, TOP + p.s * 0.4, p.z]} rotation={[p.r, p.r * 2, 0]} scale={p.s}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#b7aa9c" flatShading />
        </mesh>
      ))}

      {ISLAND_PERSONAS.map((p, i) => {
        const a = i * STEP;
        return (
          <group
            key={p.id}
            position={[Math.sin(a) * RING, TOP, Math.cos(a) * RING]}
            rotation={[0, a, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(i);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHovered(null);
              document.body.style.cursor = '';
            }}
          >
            {/* a glowing ring marks each stop on the dial */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[1.05, 1.18, 40]} />
              <meshStandardMaterial ref={(m) => (rings.current[i] = m)} color={p.accent} emissive={p.accent} emissiveIntensity={0.2} />
            </mesh>
            <Station kind={p.kind} accent={p.accent} focus={focus[i]} />
          </group>
        );
      })}

      {/* beacon over the persona that is currently active */}
      <group ref={beacon}>
        <mesh>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color="#fff4d6" emissive="#ffd68a" emissiveIntensity={2.2} flatShading />
        </mesh>
        <pointLight color="#ffd68a" intensity={1.2} distance={3} />
      </group>
    </group>
  );
}

/* ---------------------------------- kivi ---------------------------------- */

function Kivi({ selected, reduced }: { selected: number; reduced: boolean }) {
  const { scene } = useGLTF(KIVI_URL);
  const root = useRef<THREE.Group>(null);
  const hop = useRef({ start: -10, count: 0 });
  const last = useRef(selected);

  const model = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const centre = box.getCenter(new THREE.Vector3());
    c.position.set(-centre.x, -box.min.y, -centre.z);
    return c;
  }, [scene]);

  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
  }, [model]);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    if (last.current !== selected) {
      // One hop per stop the island turns past, so Kivi keeps its footing.
      const n = ISLAND_PERSONAS.length;
      const steps = Math.min(Math.abs(angleTo(last.current * STEP, selected * STEP)) / STEP, n);
      hop.current = { start: t, count: Math.max(1, Math.round(steps)) + 1 };
      last.current = selected;
    }
    const { start, count } = hop.current;
    const dur = count * 0.32;
    const p = (t - start) / dur;
    let y = 0;
    let squash = 1;
    if (!reduced && p >= 0 && p < 1) {
      const phase = (p * count) % 1;
      y = Math.sin(phase * Math.PI) * 0.28;
      squash = 1 - Math.max(0, 0.12 - phase * 0.6) - Math.max(0, (phase - 0.85) * 0.8);
    } else if (!reduced) {
      y = Math.abs(Math.sin(t * 2.2)) * 0.012; // idle breathing
    }
    g.position.set(-1.45, TOP + y, RING + 0.75);
    g.scale.set(0.55 / Math.sqrt(squash), 0.55 * squash, 0.55 / Math.sqrt(squash));
    // Faces the camera, turned toward the station, with a glance at the pointer.
    g.rotation.y = damp(g.rotation.y, 0.55 + pointer.x * 0.35, 3, dt);
  });

  return (
    <group ref={root}>
      <primitive object={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(KIVI_URL);

/* --------------------------------- clouds --------------------------------- */

function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rnd = seeded(11);
    return Array.from({ length: 11 }, () => ({
      x: (rnd() - 0.5) * 40,
      y: -7 + rnd() * 7,
      z: -30 + rnd() * 14,
      s: 0.7 + rnd() * 1.1,
      puffs: Array.from({ length: 4 }, (_, j) => [j * 0.7 - 1, rnd() * 0.35, (rnd() - 0.5) * 0.5, 0.55 + rnd() * 0.4]),
      speed: 0.15 + rnd() * 0.2,
    }));
  }, []);
  useFrame((_, dt) => {
    group.current?.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt;
      if (c.position.x > 20) c.position.x = -20;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={s}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color="#fff5ec" emissive="#f6dccb" emissiveIntensity={0.55} flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* --------------------------------- rig ------------------------------------ */

export default function IslandScene({ selected, active, reduced, onSelect }: SceneProps) {
  const spin = useRef<THREE.Group>(null);
  const angle = useRef(-selected * STEP);
  const focus = useMemo(() => ISLAND_PERSONAS.map(() => ({ current: 0 })), []);
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, pointer }, dt) => {
    const target = angle.current + angleTo(angle.current, -selected * STEP);
    angle.current = reduced ? target : damp(angle.current, target, 4.5, dt);
    if (spin.current) {
      spin.current.rotation.y = angle.current;
      spin.current.position.y = reduced ? 0 : Math.sin(clock.elapsedTime * 0.7) * 0.08;
    }
    // Keep the island clear of the info panel on wide screens.
    const wide = size.width > 900;
    const shift = wide ? -2.3 : 0;
    const back = wide ? 15.5 : 19;
    camera.position.x = damp(camera.position.x, shift + pointer.x * 0.6, 2, dt);
    camera.position.y = damp(camera.position.y, 5 + pointer.y * 0.35, 2, dt);
    camera.position.z = damp(camera.position.z, back, 2, dt);
    look.set(shift, 0.5, 0.6);
    camera.lookAt(look);
  });

  return (
    <>
      <hemisphereLight args={['#ffe9d6', '#7a5a4a', 0.9]} />
      <directionalLight
        castShadow
        position={[6, 10, 7]}
        intensity={2.1}
        color="#ffe1c2"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <fog attach="fog" args={['#f1cdb2', 24, 55]} />
      <Clouds />
      <group ref={spin}>
        <Island selected={selected} active={active} onSelect={onSelect} focus={focus} />
      </group>
      {/* the model is large; the island shows while it loads */}
      <Suspense fallback={null}>
        <Kivi selected={selected} reduced={reduced} />
      </Suspense>
    </>
  );
}
