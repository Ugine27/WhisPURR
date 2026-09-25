import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOMS } from './hubs';
import { Model, usePBR } from './assets';
import { canvasTexture } from './kit';
import { distToSeg, Flat, Grass, makeHeight, Rocks, Scatter, Terrain, Trees, TreeSpec } from './nature';
import { seeded, V3 } from './util';

/*
 * Kivi's forest: a clearing among tall trees with glass domes beyond. Kivi
 * starts on a mossy branch (BRANCH_PERCH), dives through a stand of trees and
 * lands on the glowing stone (STONE) where the winding paths meet.
 */

export const STONE = new THREE.Vector3(0, 0, 4.2);
export const STONE_TOP = 0.36;
export const BRANCH_PERCH = new THREE.Vector3(-1.4, 6.34, 24);

export const FLIGHT = new THREE.CatmullRomCurve3([
  BRANCH_PERCH.clone(),
  new THREE.Vector3(-1.1, 7.4, 21.8),
  new THREE.Vector3(-0.4, 5.4, 18.2),
  new THREE.Vector3(0.3, 3.4, 14.6),
  new THREE.Vector3(0.2, 1.7, 9.6),
  new THREE.Vector3(0, STONE_TOP + 0.6, 5.4),
  new THREE.Vector3(STONE.x, STONE_TOP, STONE.z),
]);

export function roomToWorld(room: (typeof ROOMS)[number], p: V3) {
  return new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation).add(new THREE.Vector3(...room.position));
}

// Winding path from the stone to each hub's door.
export const HUB_PATHS = ROOMS.map((room, i) => {
  const to = roomToWorld(room, room.doorstep);
  const from = STONE.clone().setY(0);
  const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize();
  const bend = [0.9, -0.8, 0.7][i] ?? 0.6;
  return new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.25).addScaledVector(side, -bend * 0.5), from.clone().lerp(to, 0.5).addScaledVector(side, bend), to]);
});

const PATH_POINTS = HUB_PATHS.map((c) => c.getSpacedPoints(24).map((p) => new THREE.Vector2(p.x, p.z)));
const FLATS: Flat[] = [
  { x: STONE.x, z: STONE.z, r: 1.6, soft: 1.5 },
  ...ROOMS.map((r) => ({ x: r.position[0], z: r.position[2], r: r.footprint, soft: 2 })),
];
const BARE: Flat[] = ROOMS.map((r) => {
  const d = roomToWorld(r, r.doorstep);
  return { x: d.x, z: d.z, r: 2.2, soft: 0 };
});

/** Ground height anywhere in the forest. */
export const groundHeight = makeHeight(FLATS, PATH_POINTS);

// Glass geodesic domes in the distance, as in Kivi's storyboard.
function GeoDome({ p, r }: { p: V3; r: number }) {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(r, 3), [r]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  return (
    <group position={p}>
      <mesh geometry={geo}>
        <meshPhysicalMaterial color="#e6f0ea" transparent opacity={0.1} roughness={0.05} envMapIntensity={2} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#dfe8e0" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

// The landing stone, carved with a ring of softly glowing marks.
function GlowStone({ bright }: { bright: React.MutableRefObject<number> }) {
  const rock = usePBR('mossy_rock', [1.5, 1.5]);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const marks = useMemo(() => {
    const t = canvasTexture(256, 256, (ctx) => {
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
    });
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }, []);
  useFrame(({ clock }) => {
    const pulse = 0.6 + Math.sin(clock.elapsedTime * 1.6) * 0.25 + bright.current * 1.2;
    if (glow.current) glow.current.emissiveIntensity = pulse * 2.2;
    if (light.current) light.current.intensity = pulse * 3;
  });
  return (
    <group position={[STONE.x, groundHeight(STONE.x, STONE.z), STONE.z]}>
      <mesh position={[0, 0.12, 0]} scale={[1.25, 0.26, 1.05]} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial {...rock} />
      </mesh>
      <mesh position={[0, STONE_TOP - 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 48]} />
        <meshStandardMaterial ref={glow} color="#000" transparent alphaMap={marks} emissive="#9ff3d0" emissiveIntensity={1.5} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.8, 0]} color="#a8f5d6" intensity={2} distance={5} decay={1.8} />
    </group>
  );
}

// Kivi's starting perch: a tall tree with a long, mossy branch.
function BranchTree() {
  const bark = usePBR('bark_brown_02', [1, 1]);
  const moss = usePBR('forrest_ground_01', [3, 1]);
  const branch = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-7.2, 5.4, 24.2), new THREE.Vector3(-4.6, 6.05, 24.1), new THREE.Vector3(-2.2, 6.1, 24), new THREE.Vector3(-0.2, 6.25, 23.9)]);
    const shape = (radius: (t: number) => number, flattenBelow: boolean) => {
      const g = new THREE.TubeGeometry(c, 40, 1, 14, false);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i <= 40; i++) {
        const centre = c.getPointAt(i / 40);
        const r = radius(i / 40);
        for (let j = 0; j <= 14; j++) {
          const k = i * 15 + j;
          v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(r);
          // The moss cushion only covers the top of the branch.
          if (flattenBelow) v.y = Math.max(v.y, -0.02) * 1.05;
          pos.setXYZ(k, centre.x + v.x, centre.y + v.y, centre.z + v.z);
        }
      }
      g.computeVertexNormals();
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i));
      return g;
    };
    return { g: shape((t) => 0.26 * (1 - t * 0.55), false), top: shape((t) => 0.29 * (1 - t * 0.55), true) };
  }, []);
  const specs = useMemo<TreeSpec[]>(() => [{ p: new THREE.Vector3(-7.5, 0, 24.3), h: 14, r: 0.8, seed: 404 }], []);
  return (
    <group>
      <Trees specs={specs} />
      <mesh geometry={branch.g} castShadow receiveShadow>
        <meshStandardMaterial {...bark} />
      </mesh>
      <mesh geometry={branch.top} castShadow receiveShadow>
        <meshStandardMaterial {...moss} />
      </mesh>
      <Model name="moss_01" position={[-2.0, 6.36, 24.0]} scale={3} />
      <Model name="moss_01" position={[-3.4, 6.3, 24.05]} rotation={[0, 2, 0]} scale={3.5} />
    </group>
  );
}

// A bright disc high behind the canopy: the source of the light shafts.
export const Sun = forwardRef<THREE.Mesh>(function Sun(_, ref) {
  return (
    <mesh ref={ref} position={[-30, 42, -70]}>
      <sphereGeometry args={[6, 24, 24]} />
      <meshBasicMaterial color="#fff4d6" toneMapped={false} fog={false} />
    </mesh>
  );
});

export default function Forest({ showBranch, stoneGlow }: { showBranch: boolean; stoneGlow: React.MutableRefObject<number> }) {
  const layout = useMemo(() => {
    const rand = seeded(29);
    const flightPts = FLIGHT.getSpacedPoints(16).map((p) => new THREE.Vector2(p.x, p.z));
    const minDist = (x: number, z: number, pts: THREE.Vector2[]) => {
      let best = Infinity;
      for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSeg(x, z, pts[i - 1], pts[i]));
      return best;
    };
    const clear = (x: number, z: number, hubGap: number, pathGap: number, flightGap: number) => {
      if (Math.hypot(x - STONE.x, z - STONE.z) < 2.4) return false;
      if (ROOMS.some((r) => Math.hypot(x - r.position[0], z - r.position[2]) < r.footprint + hubGap)) return false;
      if (PATH_POINTS.some((pts) => minDist(x, z, pts) < pathGap)) return false;
      return minDist(x, z, flightPts) > flightGap;
    };

    const trees: TreeSpec[] = [];
    for (let tries = 0; trees.length < 26 && tries < 4000; tries++) {
      const a = rand() * Math.PI * 2;
      const r = 15 + rand() * 24;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 1;
      if (!clear(x, z, 2.5, 2.5, 3.2)) continue;
      if (trees.some((t) => Math.hypot(t.p.x - x, t.p.z - z) < 4)) continue;
      trees.push({ p: new THREE.Vector3(x, groundHeight(x, z), z), h: 11 + rand() * 6, r: 0.38 + rand() * 0.22, seed: 100 + trees.length });
    }
    for (let tries = 0; trees.length < 40 && tries < 4000; tries++) {
      const x = (rand() - 0.5) * 16;
      const z = 12.5 + rand() * 7;
      if (!clear(x, z, 2, 1.6, 2.4)) continue;
      if (trees.some((t) => Math.hypot(t.p.x - x, t.p.z - z) < 3)) continue;
      trees.push({ p: new THREE.Vector3(x, groundHeight(x, z), z), h: 7 + rand() * 4, r: 0.26 + rand() * 0.12, seed: 300 + trees.length });
    }

    const grass: { x: number; y: number; z: number; r: number; s: number }[] = [];
    for (let tries = 0; grass.length < 42000 && tries < 140000; tries++) {
      const x = (rand() - 0.5) * 44;
      const z = (rand() - 0.5) * 40 + 4;
      if (!clear(x, z, 0.1, 0.75, 0)) continue;
      grass.push({ x, y: groundHeight(x, z), z, r: rand() * Math.PI * 2, s: 0.6 + rand() * 0.8 });
    }
    const scatter = (count: number, s0: number, s1: number, hubGap: number, pathGap: number) => {
      const out: { p: V3; r: number; s: number }[] = [];
      for (let tries = 0; out.length < count && tries < count * 40; tries++) {
        const x = (rand() - 0.5) * 42;
        const z = (rand() - 0.5) * 38 + 4;
        if (!clear(x, z, hubGap, pathGap, 1)) continue;
        out.push({ p: [x, groundHeight(x, z), z], r: rand() * Math.PI * 2, s: s0 + rand() * (s1 - s0) });
      }
      return out;
    };
    const rocks = scatter(7, 0.18, 0.35, 1, 1.4).map((r, i) => ({ ...r, set: (i % 2 ? 1 : 2) as 1 | 2 }));
    return {
      trees,
      grass,
      ferns: scatter(70, 0.7, 1.3, 0.6, 1.0),
      shrubs: scatter(90, 1.5, 3, 0.4, 1.0),
      rocks,
      stumps: scatter(3, 0.9, 1.2, 1.5, 1.6),
    };
  }, []);

  return (
    <group>
      <Terrain height={groundHeight} paths={PATH_POINTS} bare={BARE} />
      <Grass spots={layout.grass} />
      <Trees specs={layout.trees} />
      <Scatter name="fern_02" spots={layout.ferns} windStrength={0.05} />
      <Scatter name="shrub_04" spots={layout.shrubs} windStrength={0.03} />
      <Rocks spots={layout.rocks} />
      {layout.stumps.map((s, i) => (
        <Model key={i} name="tree_stump_01" position={s.p} rotation={[0, s.r, 0]} scale={s.s} />
      ))}
      <GlowStone bright={stoneGlow} />
      <GeoDome p={[-17, -3, -34]} r={11} />
      <GeoDome p={[3, -4, -44]} r={15} />
      <GeoDome p={[21, -3, -32]} r={10} />
      <group visible={showBranch}>
        <BranchTree />
      </group>
    </group>
  );
}
