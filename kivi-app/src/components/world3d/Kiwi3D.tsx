import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { seeded, smooth, V3 } from './util';

// Kivi is a round, fluffy chick: a big head resting on a slightly larger body.
const FUR = '#a87a55';
const SHEEN = '#f3d2ae';
const HEAD = { c: new THREE.Vector3(0, 1.45, 0.08), r: 0.5 };
const BODY = { c: new THREE.Vector3(0, 0.85, 0), r: 0.62, s: new THREE.Vector3(1, 1.02, 0.95) };
// The head turns around this point, roughly where a neck would be.
const NECK = new THREE.Vector3(0, 1.12, 0.02);

export type Outfit = 'none' | 'suit' | 'casual' | 'dev';
export type Pose = 'stand' | 'sit';
export type Activity = 'none' | 'type' | 'sip' | 'watch';

const BODY_COLOR: Record<Outfit, string> = {
  none: FUR,
  suit: '#2f3b52',
  casual: '#e7d6bf',
  dev: '#3a4254',
};

interface Kiwi3DProps {
  outfit: Outfit;
  walking: boolean;
  pose?: Pose;
  activity?: Activity;
  lookAt?: THREE.Vector3 | null;
  hopKey?: number;
}

function Mat({ color, emissive, intensity = 0, rough = 0.7 }: { color: string; emissive?: string; intensity?: number; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} emissive={emissive ?? '#000000'} emissiveIntensity={intensity} />;
}

// A few fine wisps standing up on the crown, like a chick's fuzz.
function CrownFuzz() {
  const tufts = useMemo(() => {
    const rand = seeded(11);
    const out: { pos: THREE.Vector3; normal: THREE.Vector3; len: number }[] = [];
    const n = 520;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      if (y < 0.82) continue;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      out.push({ pos: HEAD.c.clone().addScaledVector(dir, HEAD.r), normal: dir, len: 0.045 + rand() * 0.035 });
    }
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    tufts.forEach((t, i) => {
      q.setFromUnitVectors(up, t.normal);
      m.compose(t.pos.clone().addScaledVector(t.normal, t.len * 0.3), q, new THREE.Vector3(0.35, t.len / 0.05, 0.35));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [tufts]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, tufts.length]}>
      <sphereGeometry args={[0.05, 8, 6]} />
      <meshPhysicalMaterial color="#c49a70" roughness={1} sheen={1} sheenColor={SHEEN} sheenRoughness={0.6} />
    </instancedMesh>
  );
}

// Shell fur: stacked, slightly larger copies of a shape. Each layer keeps only
// the strands tall enough to reach it, so the surface reads as soft fuzz.
const FUR_LAYERS = 14;
let strandTexture: THREE.DataTexture | null = null;
function getStrandTexture() {
  if (strandTexture) return strandTexture;
  const w = 256;
  const h = 128;
  const data = new Uint8Array(w * h * 4);
  const rand = seeded(99);
  for (let i = 0; i < w * h; i++) {
    const v = Math.floor(Math.pow(rand(), 0.7) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  strandTexture = new THREE.DataTexture(data, w, h);
  strandTexture.wrapS = strandTexture.wrapT = THREE.RepeatWrapping;
  strandTexture.repeat.set(3, 3);
  strandTexture.magFilter = THREE.NearestFilter;
  strandTexture.needsUpdate = true;
  return strandTexture;
}

function FurShells({
  radius,
  position,
  scale = [1, 1, 1],
  color,
  length = 0.07,
  ease = 10,
}: {
  radius: number;
  position: THREE.Vector3 | V3;
  scale?: THREE.Vector3 | V3;
  color: string;
  length?: number;
  ease?: number;
}) {
  const mats = useMemo(
    () =>
      Array.from({ length: FUR_LAYERS }, (_, i) => {
        const h = (i + 1) / FUR_LAYERS;
        return new THREE.MeshPhysicalMaterial({
          color,
          alphaMap: getStrandTexture(),
          alphaTest: 0.08 + h * 0.85,
          roughness: 1,
          sheen: 1,
          sheenColor: new THREE.Color(SHEEN),
          sheenRoughness: 0.5,
        });
      }),
    // Colour changes are eased in useFrame; the materials are built once.
    [],
  );
  const target = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-ease * dt);
    mats.forEach((m, i) => {
      // Roots sit in shadow, tips catch the light.
      const shade = 0.72 + ((i + 1) / FUR_LAYERS) * 0.4;
      target.set(color).multiplyScalar(shade);
      m.color.lerp(target, k);
    });
  });
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group position={position} scale={scale}>
      {mats.map((m, i) => (
        <mesh key={i} material={m} scale={1 + (((i + 1) / FUR_LAYERS) * length) / radius} castShadow={i === 0}>
          <sphereGeometry args={[radius, 48, 36]} />
        </mesh>
      ))}
    </group>
  );
}

function Beak() {
  const geo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.02, 1.4, 0.5), new THREE.Vector3(0.05, 1.33, 1.02), new THREE.Vector3(-0.12, 0.92, 1.12));
    const segs = 28;
    const radial = 12;
    const g = new THREE.TubeGeometry(curve, segs, 0.085, radial, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const centre = curve.getPointAt(i / segs);
      const taper = 1 - 0.82 * Math.pow(i / segs, 0.8);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial color="#d99a62" roughness={0.45} clearcoat={0.4} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.92, 1.12]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshPhysicalMaterial color="#c98850" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Eye({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 0.2, 1.52, 0.53]} rotation={[0, side * 0.38, 0]}>
      <mesh scale={[1, 1.05, 0.55]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial color="#e9d2b4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.03]} scale={[1, 1.05, 0.6]}>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshPhysicalMaterial color="#1c120c" roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} />
      </mesh>
      <mesh position={[0, -0.02, 0.085]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[0.08, 20, 20]} />
        <meshStandardMaterial color="#4a2c1c" roughness={0.3} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.035, 0.045, 0.11]}>
        <sphereGeometry args={[0.033, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.045, -0.05, 0.105]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// Costume pieces worn on the body. Each piece carries a `beat` so an outfit
// assembles itself piece by piece rather than appearing all at once.
function BodyPieces({ outfit }: { outfit: Outfit }) {
  switch (outfit) {
    case 'suit':
      return (
        <>
          <mesh position={[0, 1.0, 0.53]} scale={[0.42, 0.34, 0.16]} name="beat:0">
            <sphereGeometry args={[1, 24, 18]} />
            <Mat color="#fbf8f2" />
          </mesh>
          <mesh position={[0, 1.07, 0.7]} rotation={[0.2, 0, 0]} castShadow name="beat:1">
            <boxGeometry args={[0.13, 0.1, 0.07]} />
            <Mat color="#8e2a22" />
          </mesh>
          <mesh position={[0, 0.86, 0.71]} rotation={[-0.22, 0, 0]} castShadow name="beat:1">
            <boxGeometry args={[0.12, 0.34, 0.04]} />
            <Mat color="#a8352b" />
          </mesh>
          <mesh position={[0.4, 0.98, 0.49]} rotation={[0, 0.75, 0]} name="beat:2">
            <boxGeometry args={[0.12, 0.08, 0.02]} />
            <Mat color="#fbf8f2" />
          </mesh>
        </>
      );
    case 'casual':
      return (
        <>
          <mesh position={[0, 1.1, 0.02]} rotation={[Math.PI / 2 - 0.1, 0, 0]} castShadow name="beat:0">
            <torusGeometry args={[0.52, 0.08, 12, 40]} />
            <Mat color="#d6c1a3" rough={1} />
          </mesh>
          {[-0.18, 0, 0.18].map((x, i) => (
            <mesh key={x} position={[x, 0.78, 0.66 - Math.abs(x) * 0.25]} rotation={[0.15, x * 1.4, 0]} name={`beat:${1 + i * 0.3}`}>
              <torusGeometry args={[0.06, 0.018, 6, 16]} />
              <Mat color="#d6c1a3" rough={1} />
            </mesh>
          ))}
        </>
      );
    case 'dev':
      return (
        <>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.98, 0.68]} name="beat:1">
              <cylinderGeometry args={[0.014, 0.014, 0.26, 6]} />
              <Mat color="#e8e4dc" />
            </mesh>
          ))}
          <mesh position={[0, 0.66, 0.64]} rotation={[0.35, 0, 0]} name="beat:2">
            <boxGeometry args={[0.55, 0.22, 0.05]} />
            <Mat color="#323a4a" rough={0.95} />
          </mesh>
        </>
      );
    default:
      return null;
  }
}

function HeadPieces({ outfit }: { outfit: Outfit }) {
  switch (outfit) {
    case 'casual':
      return (
        <group position={HEAD.c} rotation={[-0.18, 0, 0.06]}>
          <mesh name="beat:0" castShadow>
            <sphereGeometry args={[0.585, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
            <meshStandardMaterial color="#d6a443" roughness={1} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} name="beat:0.5">
            <torusGeometry args={[0.565, 0.075, 12, 48]} />
            <Mat color="#c79434" rough={1} />
          </mesh>
          <mesh position={[0, 0.64, 0]} name="beat:1.5" castShadow>
            <sphereGeometry args={[0.12, 20, 16]} />
            <Mat color="#f1e6d2" rough={1} />
          </mesh>
        </group>
      );
    case 'dev':
      return (
        <>
          <mesh position={[0, 1.45, 0.02]} rotation={[0, 0, -0.2 * Math.PI]} castShadow name="beat:0">
            <torusGeometry args={[0.6, 0.13, 12, 32, Math.PI * 1.4]} />
            <Mat color="#323a4a" rough={0.95} />
          </mesh>
          <mesh position={[0, 1.45, 0.05]} castShadow name="beat:1">
            <torusGeometry args={[0.66, 0.045, 8, 32, Math.PI]} />
            <Mat color="#1f1f22" rough={0.4} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.66, 1.42, 0.05]} rotation={[0, 0, Math.PI / 2]} name="beat:1.4">
              <mesh>
                <cylinderGeometry args={[0.15, 0.15, 0.12, 24]} />
                <Mat color="#1f1f22" rough={0.4} />
              </mesh>
              <mesh position={[0, -s * 0.065, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.01, 20]} />
                <Mat color="#7dd3c0" emissive="#7dd3c0" intensity={1.2} />
              </mesh>
            </group>
          ))}
        </>
      );
    default:
      return null;
  }
}

// A ribbon of glints that spirals up around Kivi while the outfit changes.
function Swirl({ progress }: { progress: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const count = 26;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = progress.current;
    g.visible = p > 0 && p < 1;
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      const f = i / count;
      const a = p * Math.PI * 5 + f * Math.PI * 2;
      const r = 0.95 - p * 0.35;
      c.position.set(Math.cos(a) * r, 0.1 + ((p * 1.6 + f * 0.9) % 1) * 2.3, Math.sin(a) * r);
      c.scale.setScalar(Math.sin(p * Math.PI) * (0.6 + (i % 3) * 0.3));
    });
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#fff6dc" emissive={i % 2 ? '#ffe3a3' : '#fff8ec'} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const TRANSFORM_SECONDS = 1.1;
const baseScales = new WeakMap<THREE.Object3D, THREE.Vector3>();

export default function Kiwi3D({ outfit, walking, pose = 'stand', activity = 'none', lookAt = null, hopKey = 0 }: Kiwi3DProps) {
  const rig = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const bodyPieces = useRef<THREE.Group>(null);
  const headPieces = useRef<THREE.Group>(null);
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const target = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const prevOutfit = useRef(outfit);
  const transformAt = useRef<number | 'pending' | null>(null);
  const transformP = useRef(0);
  const hopAt = useRef<number | 'pending' | null>(null);
  const lastHop = useRef(hopKey);

  if (prevOutfit.current !== outfit) {
    prevOutfit.current = outfit;
    transformAt.current = 'pending';
  }
  if (lastHop.current !== hopKey) {
    lastHop.current = hopKey;
    hopAt.current = 'pending';
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!rig.current || !body.current || !head.current) return;

    // Outfit transformation: a twirl, a spiral of glints, pieces popping in.
    if (transformAt.current === 'pending') transformAt.current = t;
    const tp = typeof transformAt.current === 'number' ? Math.min((t - transformAt.current) / TRANSFORM_SECONDS, 1) : 1;
    transformP.current = tp >= 1 ? 0 : tp;
    rig.current.rotation.y = tp < 1 ? smooth(tp) * Math.PI * 2 : 0;
    for (const g of [bodyPieces.current, headPieces.current]) {
      g?.traverse((o) => {
        const beat = o.name.startsWith('beat:') ? parseFloat(o.name.slice(5)) : NaN;
        if (Number.isNaN(beat)) return;
        // Remember each piece's authored scale the first time it is seen.
        let base = baseScales.get(o);
        if (!base) baseScales.set(o, (base = o.scale.clone()));
        const p = THREE.MathUtils.clamp((tp - 0.3 - beat * 0.1) / 0.35, 0, 1);
        // Springy overshoot.
        const s = p >= 1 ? 1 : p <= 0 ? 0.001 : 1 - Math.cos(p * Math.PI * 2.5) * Math.exp(-p * 5);
        o.scale.copy(base).multiplyScalar(Math.max(s, 0.001));
      });
    }

    // Hop when something catches Kivi's eye.
    if (hopAt.current === 'pending') hopAt.current = t;
    const hp = typeof hopAt.current === 'number' ? (t - hopAt.current) / 0.42 : 1;
    rig.current.position.y = hp < 1 ? Math.sin(hp * Math.PI) * 0.32 : 0;

    const stride = walking ? Math.sin(t * 13) : 0;
    const sitting = pose === 'sit';
    body.current.position.y = walking ? Math.abs(Math.sin(t * 13)) * 0.07 : Math.sin(t * 2) * 0.02;
    const breathe = walking ? 1 : 1 + Math.sin(t * 2) * 0.012;
    body.current.scale.set(breathe, 2 - breathe, breathe);
    body.current.rotation.z = THREE.MathUtils.damp(body.current.rotation.z, stride * 0.09, 12, dt);
    body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, sitting ? -0.08 : 0, 6, dt);
    const legTarget = sitting ? -1.35 : 0;
    legL.current!.rotation.x = walking ? stride * 0.7 : THREE.MathUtils.damp(legL.current!.rotation.x, legTarget, 8, dt);
    legR.current!.rotation.x = walking ? -stride * 0.7 : THREE.MathUtils.damp(legR.current!.rotation.x, legTarget, 8, dt);

    // Wings: tapping while typing, a small flutter while walking, a lift to sip.
    const tap = activity === 'type' ? Math.sin(t * 16) * 0.18 : 0;
    const flutter = walking ? Math.sin(t * 13) * 0.12 : 0;
    const sipLift = activity === 'sip' ? Math.max(0, Math.sin(t * 0.8)) * 0.6 : 0;
    wingL.current!.rotation.x = 0.2 + tap + flutter;
    wingR.current!.rotation.x = 0.2 - tap + flutter - sipLift;

    // Head: look at what matters, otherwise tilt about curiously.
    let yaw = Math.sin(t * 0.5) * 0.22;
    let pitch = Math.sin(t * 0.37) * 0.06;
    let roll = Math.sin(t * 0.8) * 0.1;
    if (lookAt) {
      tmp.copy(lookAt);
      body.current.worldToLocal(tmp).sub(NECK);
      yaw = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(-Math.atan2(tmp.y - 0.4, Math.hypot(tmp.x, tmp.z)), -0.45, 0.5);
      roll *= 0.4;
    }
    if (activity === 'type') pitch += 0.12 + (Math.sin(t * 0.6) > 0.85 ? -0.3 : 0);
    if (activity === 'sip') pitch += Math.max(0, Math.sin(t * 0.8)) * 0.35;
    if (activity === 'watch') yaw += Math.sin(t * 2.2) * 0.04;
    head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 5, dt);
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, pitch, 5, dt);
    head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, roll, 3, dt);

    if (eyes.current) {
      const blink = t % 3.8 > 3.66 ? 0.1 : 1;
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 40, dt);
    }
    target.set(BODY_COLOR[outfit]);
    bodyMat.current?.color.lerp(target, 1 - Math.exp(-5 * dt));
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.05]}>
        <circleGeometry args={[0.62, 32]} />
        <meshBasicMaterial color="#3e2723" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <group ref={rig}>
        {[
          { ref: legL, x: -0.2 },
          { ref: legR, x: 0.2 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.3, 0.05]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <cylinderGeometry args={[0.055, 0.06, 0.26, 10]} />
              <Mat color="#d98f6a" rough={0.6} />
            </mesh>
            {[-0.55, 0, 0.55].map((a) => (
              <group key={a} position={[0, -0.265, 0]} rotation={[0, a, 0]}>
                <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <capsuleGeometry args={[0.035, 0.13, 4, 8]} />
                  <Mat color="#d98f6a" rough={0.6} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        <group ref={body}>
          <mesh position={BODY.c} scale={BODY.s} castShadow>
            <sphereGeometry args={[BODY.r, 40, 32]} />
            <meshPhysicalMaterial ref={bodyMat} color={FUR} roughness={1} sheen={1} sheenColor={SHEEN} sheenRoughness={0.6} />
          </mesh>
          <FurShells radius={BODY.r} position={BODY.c} scale={BODY.s} color={BODY_COLOR[outfit]} length={0.08} ease={5} />
          {[
            { ref: wingL, s: -1 },
            { ref: wingR, s: 1 },
          ].map(({ ref, s }) => (
            <mesh key={s} ref={ref} position={[s * 0.58, 0.92, 0.04]} rotation={[0.2, 0, s * -0.25]} scale={[0.35, 0.8, 0.6]} castShadow>
              <sphereGeometry args={[0.3, 20, 16]} />
              <meshPhysicalMaterial color="#9a6d4a" roughness={1} sheen={1} sheenColor={SHEEN} />
            </mesh>
          ))}
          <group ref={bodyPieces}>
            <group key={outfit}>
              <BodyPieces outfit={outfit} />
            </group>
          </group>

          <group ref={head} position={NECK}>
            <group position={[-NECK.x, -NECK.y, -NECK.z]}>
              <mesh position={HEAD.c} castShadow>
                <sphereGeometry args={[HEAD.r, 40, 32]} />
                <meshPhysicalMaterial color={FUR} roughness={1} sheen={1} sheenColor={SHEEN} sheenRoughness={0.6} />
              </mesh>
              <FurShells radius={HEAD.r} position={HEAD.c} color={FUR} length={0.06} />
              {outfit !== 'casual' && <CrownFuzz />}
              <group ref={eyes} position={[0, 1.52, 0]}>
                <group position={[0, -1.52, 0]}>
                  <Eye side={-1} />
                  <Eye side={1} />
                </group>
              </group>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.3, 1.34, 0.48]} rotation={[0, s * 0.55, 0]} scale={[1, 0.65, 0.3]}>
                  <sphereGeometry args={[0.09, 16, 16]} />
                  <meshStandardMaterial color="#f28d7e" transparent opacity={0.55} />
                </mesh>
              ))}
              <Beak />
              <group ref={headPieces}>
                <group key={outfit}>
                  <HeadPieces outfit={outfit} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      <Swirl progress={transformP} />
    </group>
  );
}
