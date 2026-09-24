import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOMS } from './rooms';
import { seeded } from './util';

export const PLAZA = new THREE.Vector3(0, 0, 4.6);
const PLAZA_RADIUS = 2.1;

// Convert a point in a room's own coordinates into world coordinates.
export function roomToWorld(room: (typeof ROOMS)[number], p: [number, number, number]) {
  return new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation).add(new THREE.Vector3(...room.position));
}

function distToSegment(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

// Dreamy dome: warm peach overhead, cream in the middle, a pale mint horizon.
export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#f1d3bd') },
          mid: { value: new THREE.Color('#f8ecd8') },
          low: { value: new THREE.Color('#dcead8') },
        },
        vertexShader: 'varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vPos;
          void main() {
            float h = vPos.y;
            vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.12, h));
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
    const g = new THREE.PlaneGeometry(160, 160, 160, 160);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const a = new THREE.Color('#bccb9f');
    const b = new THREE.Color('#d3d9aa');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z + 1);
      // Flat where the rooms stand, gently rolling further out.
      const rise = THREE.MathUtils.smoothstep(d, 15, 45);
      const hills = Math.sin(x * 0.12) * Math.cos(z * 0.1) * 1.6 + Math.sin(x * 0.05 + z * 0.07) * 2.4;
      pos.setY(i, rise * (hills + rise * 3) - 0.02);
      const n = 0.5 + 0.5 * Math.sin(x * 0.35 + Math.cos(z * 0.3) * 2);
      c.copy(a).lerp(b, n * 0.6);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

function Stones({ spots }: { spots: { p: THREE.Vector3; r: number; s: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((st, i) => {
      q.setFromEuler(new THREE.Euler(0, st.r, 0));
      m.compose(st.p, q, new THREE.Vector3(0.36 * st.s, 0.06, 0.28 * st.s));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} receiveShadow castShadow>
      <sphereGeometry args={[1, 24, 12]} />
      <meshStandardMaterial color="#e6dac6" roughness={0.9} />
    </instancedMesh>
  );
}

function Flowers({ spots }: { spots: { p: THREE.Vector3; c: THREE.Color }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((f, i) => {
      m.makeTranslation(f.p.x, f.p.y, f.p.z);
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, f.c);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]}>
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}

function Tree({ p, s, tone }: { p: THREE.Vector3; s: number; tone: string }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.8, 16]} />
        <meshStandardMaterial color="#8a6a4f" roughness={0.9} />
      </mesh>
      {[
        [0, 2.3, 0, 1.0],
        [0.55, 1.95, 0.2, 0.7],
        [-0.5, 2.0, -0.15, 0.75],
        [0.1, 2.8, -0.1, 0.65],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[r, 32, 24]} />
          <meshStandardMaterial color={tone} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Bush({ p, s, tone }: { p: THREE.Vector3; s: number; tone: string }) {
  return (
    <group position={p} scale={s}>
      {[
        [0, 0.28, 0, 0.42],
        [0.38, 0.22, 0.1, 0.32],
        [-0.34, 0.2, -0.05, 0.3],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[r, 24, 16]} />
          <meshStandardMaterial color={tone} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function World() {
  const layout = useMemo(() => {
    const rand = seeded(21);
    const segs = ROOMS.map((r) => {
      const e = roomToWorld(r, r.entry);
      return [new THREE.Vector2(PLAZA.x, PLAZA.z), new THREE.Vector2(e.x, e.z)] as const;
    });
    const roomSpots = ROOMS.map((r) => new THREE.Vector2(r.position[0], r.position[2]));
    const clear = (x: number, z: number, roomGap: number, pathGap: number) => {
      const p = new THREE.Vector2(x, z);
      if (p.distanceTo(new THREE.Vector2(PLAZA.x, PLAZA.z)) < PLAZA_RADIUS + 1.2) return false;
      if (roomSpots.some((r) => p.distanceTo(r) < roomGap)) return false;
      // Keep the view from the intro and overview cameras open.
      if (z > 5 && Math.abs(x) < 7) return false;
      return segs.every(([a, b]) => distToSegment(p, a, b) > pathGap);
    };

    const stones: { p: THREE.Vector3; r: number; s: number }[] = [];
    segs.forEach(([a, b]) => {
      const len = a.distanceTo(b);
      const n = Math.floor(len / 0.75);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const q = a.clone().lerp(b, t);
        if (q.distanceTo(new THREE.Vector2(PLAZA.x, PLAZA.z)) < PLAZA_RADIUS + 0.2) continue;
        const side = (rand() - 0.5) * 0.35;
        const dir = b.clone().sub(a).normalize();
        stones.push({ p: new THREE.Vector3(q.x - dir.y * side, 0.02, q.y + dir.x * side), r: rand() * Math.PI, s: 0.8 + rand() * 0.4 });
      }
    });

    const tones = ['#9fb88a', '#8fae7c', '#a9c293', '#7f9f70'];
    const trees: { p: THREE.Vector3; s: number; tone: string }[] = [];
    for (let tries = 0; trees.length < 22 && tries < 1500; tries++) {
      const a = rand() * Math.PI * 2;
      const r = 7 + rand() * 20;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 2;
      if (!clear(x, z, 5.2, 1.6)) continue;
      if (trees.some((t) => Math.hypot(t.p.x - x, t.p.z - z) < 2.4)) continue;
      trees.push({ p: new THREE.Vector3(x, 0, z), s: 0.8 + rand() * 0.6, tone: tones[Math.floor(rand() * tones.length)] });
    }
    const bushes: { p: THREE.Vector3; s: number; tone: string }[] = [];
    for (let tries = 0; bushes.length < 34 && tries < 2000; tries++) {
      const x = (rand() - 0.5) * 36;
      const z = (rand() - 0.5) * 22 - 1;
      if (!clear(x, z, 4.4, 1.1)) continue;
      bushes.push({ p: new THREE.Vector3(x, 0, z), s: 0.6 + rand() * 0.7, tone: tones[Math.floor(rand() * tones.length)] });
    }
    const palette = ['#fbf6ee', '#d9c7e8', '#f4c7b0', '#f0dc9a'].map((c) => new THREE.Color(c));
    const flowers: { p: THREE.Vector3; c: THREE.Color }[] = [];
    for (let patch = 0; patch < 18; patch++) {
      const cx = (rand() - 0.5) * 34;
      const cz = (rand() - 0.5) * 20 - 1;
      if (!clear(cx, cz, 4.2, 1)) continue;
      const col = palette[Math.floor(rand() * palette.length)];
      for (let i = 0; i < 14; i++) {
        const x = cx + (rand() - 0.5) * 1.6;
        const z = cz + (rand() - 0.5) * 1.6;
        if (clear(x, z, 4, 0.8)) flowers.push({ p: new THREE.Vector3(x, 0.14 + rand() * 0.1, z), c: col });
      }
    }
    const hills = Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (1.05 + (i / 8) * 0.9);
      const r = 62 + rand() * 20;
      return { p: new THREE.Vector3(Math.cos(a) * r, -8, Math.sin(a) * r), s: 18 + rand() * 12, tone: i % 2 ? '#c6d3b0' : '#b8c9a4' };
    });
    return { stones, trees, bushes, flowers, hills };
  }, []);

  return (
    <group>
      <SkyDome />
      <Ground />
      {layout.hills.map((h, i) => (
        <mesh key={i} position={h.p} scale={[h.s * 1.6, h.s * 0.6, h.s]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial color={h.tone} roughness={1} />
        </mesh>
      ))}
      {/* Plaza: a soft round stone where Kivi waits */}
      <mesh position={[PLAZA.x, 0.05, PLAZA.z]} receiveShadow>
        <cylinderGeometry args={[PLAZA_RADIUS, PLAZA_RADIUS + 0.08, 0.1, 64]} />
        <meshStandardMaterial color="#ebe0cd" roughness={0.85} />
      </mesh>
      <mesh position={[PLAZA.x, 0.1, PLAZA.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[PLAZA_RADIUS - 0.35, PLAZA_RADIUS - 0.3, 64]} />
        <meshStandardMaterial color="#d9cbb3" roughness={0.9} />
      </mesh>
      <Stones spots={layout.stones} />
      {layout.trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {layout.bushes.map((b, i) => (
        <Bush key={i} {...b} />
      ))}
      <Flowers spots={layout.flowers} />
    </group>
  );
}
