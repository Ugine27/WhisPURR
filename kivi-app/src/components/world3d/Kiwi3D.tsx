import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { seeded, smooth, V3 } from './util';

// Kivi is a round, green kiwi: a big head resting on a slightly larger body,
// covered in soft, hair-like feathers.
const FUR = '#58793f';
const SHEEN = '#cfe3a6';
const WING = '#4f6d2e';
const HEAD = { c: new THREE.Vector3(0, 1.45, 0.08), r: 0.5 };
const BODY = { c: new THREE.Vector3(0, 0.85, 0), r: 0.62, s: new THREE.Vector3(1, 1.02, 0.95) };
// The head turns around this point, roughly where a neck would be.
const NECK = new THREE.Vector3(0, 1.12, 0.02);

export type Outfit = 'none' | 'suit' | 'casual' | 'dev';
export type Pose = 'stand' | 'sit';
export type Activity = 'none' | 'type' | 'sip' | 'watch' | 'beckon';

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

// Feathers are drawn as shells: stacked, slightly larger copies of a shape.
// Each layer keeps only the parts of a feather long enough to reach it, and
// layers sag a little, so the plumage reads as soft kiwi feathers combed down.
const FUR_LAYERS = 16;
let featherTextures: { alpha: THREE.DataTexture; tint: THREE.DataTexture } | null = null;
function getFeatherTextures() {
  if (featherTextures) return featherTextures;
  const w = 512;
  const h = 256;
  const alpha = new Uint8Array(w * h * 4);
  const tint = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) tint.set([235, 240, 225, 255], i * 4);
  const rand = seeded(99);
  for (let f = 0; f < 5200; f++) {
    const x0 = Math.floor(rand() * w);
    const y0 = Math.floor(rand() * h);
    const len = 10 + rand() * 26;
    const width = 2 + rand() * 3;
    const strength = 0.35 + rand() * 0.65;
    // Each feather gets its own tint: some lighter and warmer, some deeper.
    const lum = 0.82 + rand() * 0.3;
    const warm = (rand() - 0.5) * 0.14;
    for (let dy = 0; dy < len; dy++) {
      const t = dy / len;
      const hw = width * Math.sin(Math.PI * Math.min(1, 0.15 + t)) * (1 - t * 0.6);
      const y = (y0 + dy) % h;
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const edge = 1 - Math.abs(dx) / (hw + 0.5);
        if (edge <= 0) continue;
        const x = (x0 + dx + w) % w;
        const v = Math.floor(255 * strength * (1 - t * 0.55) * Math.sqrt(edge));
        const k = (y * w + x) * 4;
        if (v > alpha[k]) {
          alpha.set([v, v, v, 255], k);
          tint.set([Math.min(255, 255 * lum * (1 + warm)), Math.min(255, 255 * lum), Math.min(255, 255 * lum * (1 - warm)), 255], k);
        }
      }
    }
  }
  const make = (data: Uint8Array<ArrayBuffer>, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, w, h);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.magFilter = THREE.LinearFilter;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  featherTextures = { alpha: make(alpha, false), tint: make(tint, true) };
  return featherTextures;
}

function FurShells({
  radius,
  position,
  scale = [1, 1, 1],
  color,
  length = 0.07,
  ease = 10,
  droop = 0.45,
  countershade = false,
}: {
  radius: number;
  position: THREE.Vector3 | V3;
  scale?: THREE.Vector3 | V3;
  color: string;
  length?: number;
  ease?: number;
  droop?: number;
  countershade?: boolean;
}) {
  const mats = useMemo(
    () =>
      Array.from({ length: FUR_LAYERS }, (_, i) => {
        const h = (i + 1) / FUR_LAYERS;
        const { alpha, tint } = getFeatherTextures();
        return new THREE.MeshPhysicalMaterial({
          color,
          map: tint,
          alphaMap: alpha,
          alphaTest: 0.06 + h * 0.8,
          roughness: 1,
          sheen: 1,
          sheenColor: new THREE.Color(SHEEN),
          sheenRoughness: 0.5,
          vertexColors: countershade,
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
      const shade = 0.62 + ((i + 1) / FUR_LAYERS) * 0.55;
      target.set(color).multiplyScalar(shade);
      m.color.lerp(target, k);
    });
  });
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 48, 36);
    if (!countershade) return g;
    const n = g.attributes.normal as THREE.BufferAttribute;
    const cols = new Float32Array(n.count * 3);
    const light = new THREE.Color(1.22, 1.2, 1.02);
    const dark = new THREE.Color(0.8, 0.84, 0.82);
    const c = new THREE.Color();
    for (let i = 0; i < n.count; i++) {
      const front = Math.max(0, n.getZ(i));
      const below = Math.max(0, -n.getY(i) + 0.2);
      const belly = THREE.MathUtils.clamp(front * 0.7 + below * 0.5, 0, 1);
      const back = THREE.MathUtils.clamp(-n.getZ(i) * 0.6 + n.getY(i) * 0.3, 0, 1);
      c.setRGB(1, 1, 1).lerp(light, belly * 0.8).lerp(dark, back * 0.7);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  }, [radius, countershade]);
  return (
    <group position={position} scale={scale}>
      {mats.map((m, i) => (
        <mesh
          key={i}
          material={m}
          // Outer layers sag slightly so the feathers lie downward.
          geometry={geo}
          position={[0, -((i + 1) / FUR_LAYERS) * length * droop, 0]}
          scale={1 + (((i + 1) / FUR_LAYERS) * length) / radius}
          castShadow={i === 0}
        />
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
        <meshPhysicalMaterial color="#d8bf92" roughness={0.45} clearcoat={0.4} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.92, 1.12]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshPhysicalMaterial color="#b89a6a" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Eye({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 0.2, 1.53, 0.57]} rotation={[0, side * 0.38, 0]}>
      <mesh scale={[1, 1.05, 0.55]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial color="#dfe5c6" roughness={0.9} />
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

// Garments are real fabric worn over the feathers. A piece named `drape:n`
// unrolls from the shoulders on beat n; `beat:n` pieces pop in with a spring.
const G_R = BODY.r + 0.1; // just outside the feather tips
const FRONT = Math.PI / 2; // SphereGeometry's phi for the +z (front) direction

function Garment({ color, sheen, theta, phi, r = G_R, bump }: { color: string; sheen: string; theta: [number, number]; phi?: [number, number]; r?: number; bump?: THREE.Texture }) {
  const [phiStart, phiLength] = phi ?? [0, Math.PI * 2];
  return (
    <mesh position={BODY.c} scale={BODY.s} castShadow receiveShadow>
      <sphereGeometry args={[r, 56, 36, phiStart, phiLength, theta[0] * Math.PI, (theta[1] - theta[0]) * Math.PI]} />
      <meshPhysicalMaterial color={color} roughness={0.85} sheen={1} sheenColor={sheen} sheenRoughness={0.5} bumpMap={bump} bumpScale={bump ? 2.5 : 0} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Drape pivot: garments unroll downward from the neckline.
const DRAPE_TOP: V3 = [0, 1.28, 0];
function Drape({ beat, children }: { beat: number; children: React.ReactNode }) {
  return (
    <group name={`drape:${beat}`} position={DRAPE_TOP}>
      <group position={[-DRAPE_TOP[0], -DRAPE_TOP[1], -DRAPE_TOP[2]]}>{children}</group>
    </group>
  );
}

let knit: THREE.CanvasTexture | null = null;
function knitTexture() {
  if (knit) return knit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  // Rows of little V stitches with a cable every few columns.
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      const cable = Math.floor(x / 8) % 6 === 0;
      ctx.strokeStyle = cable ? '#e0e0e0' : '#b8b8b8';
      ctx.lineWidth = cable ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 1);
      ctx.lineTo(x + 4, y + 7);
      ctx.lineTo(x + 7, y + 1);
      ctx.stroke();
    }
  }
  knit = new THREE.CanvasTexture(c);
  knit.wrapS = knit.wrapT = THREE.RepeatWrapping;
  knit.repeat.set(8, 4);
  return knit;
}

function BodyPieces({ outfit }: { outfit: Outfit }) {
  const gap = 0.62; // the jacket's open front
  switch (outfit) {
    case 'suit':
      return (
        <>
          <Drape beat={0}>
            <Garment color="#f6f3ec" sheen="#ffffff" theta={[0.27, 0.72]} phi={[FRONT - 0.42, 0.84]} r={G_R - 0.012} />
            <Garment color="#2c3a50" sheen="#6d7fa3" theta={[0.28, 0.84]} phi={[FRONT + gap / 2, Math.PI * 2 - gap]} />
          </Drape>
          {[-1, 1].map((s) => (
            <mesh key={s} name="beat:1.5" position={[s * 0.19, 1.0, 0.66]} rotation={[-0.3, s * 0.3, s * 0.42]} castShadow>
              <boxGeometry args={[0.1, 0.34, 0.025]} />
              <Mat color="#24314a" rough={0.6} />
            </mesh>
          ))}
          <mesh name="beat:2" position={[0, 1.06, 0.68]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[0.12, 0.09, 0.06]} />
            <Mat color="#7d2a24" rough={0.5} />
          </mesh>
          <mesh name="beat:2.3" position={[0, 0.86, 0.72]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.11, 0.33, 0.025]} />
            <meshPhysicalMaterial color="#9b3128" roughness={0.45} sheen={0.6} sheenColor="#d86a5a" />
          </mesh>
          <mesh name="beat:2.8" position={[0.46, 0.99, 0.47]} rotation={[0, 0.8, 0]}>
            <boxGeometry args={[0.12, 0.07, 0.02]} />
            <Mat color="#f6f3ec" />
          </mesh>
        </>
      );
    case 'casual':
      return (
        <>
          <Drape beat={0}>
            <Garment color="#e4d4ba" sheen="#fff8ea" theta={[0.26, 0.9]} bump={knitTexture()} />
          </Drape>
          <mesh name="beat:1.4" position={[0, 1.13, 0.02]} rotation={[Math.PI / 2 - 0.1, 0, 0]} castShadow>
            <torusGeometry args={[0.52, 0.075, 14, 48]} />
            <meshPhysicalMaterial color="#d7c5a7" roughness={0.95} sheen={1} sheenColor="#fff8ea" bumpMap={knitTexture()} bumpScale={2} />
          </mesh>
        </>
      );
    case 'dev':
      return (
        <>
          <Drape beat={0}>
            <Garment color="#3b4252" sheen="#7c879c" theta={[0.25, 0.92]} />
            <Garment color="#343a48" sheen="#6b7486" theta={[0.6, 0.78]} phi={[FRONT - 0.5, 1.0]} r={G_R + 0.012} />
          </Drape>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} name="beat:1.8" position={[x, 0.97, 0.73]}>
              <cylinderGeometry args={[0.013, 0.013, 0.26, 8]} />
              <Mat color="#e8e4dc" />
            </mesh>
          ))}
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

  useFrame(({ clock }, frameDt) => {
    const t = clock.elapsedTime;
    const dt = Math.min(frameDt, 1 / 20);
    if (!rig.current || !body.current || !head.current) return;

    // Outfit transformation: a twirl, a spiral of glints, pieces popping in.
    if (transformAt.current === 'pending') transformAt.current = t;
    const tp = typeof transformAt.current === 'number' ? Math.min((t - transformAt.current) / TRANSFORM_SECONDS, 1) : 1;
    transformP.current = tp >= 1 ? 0 : tp;
    rig.current.rotation.y = tp < 1 ? smooth(tp) * Math.PI * 2 : 0;
    for (const g of [bodyPieces.current, headPieces.current]) {
      g?.traverse((o) => {
        if (o.name.startsWith('drape:')) {
          // Unroll from the neckline: height grows first, then width settles.
          const p = THREE.MathUtils.clamp((tp - 0.25 - parseFloat(o.name.slice(6)) * 0.1) / 0.45, 0, 1);
          const e = 1 - Math.pow(1 - p, 3);
          o.scale.set(0.9 + 0.1 * e, Math.max(e, 0.001), 0.9 + 0.1 * e);
          o.visible = p > 0;
          return;
        }
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
    wingR.current!.rotation.x = THREE.MathUtils.damp(wingR.current!.rotation.x, 0.2 - tap + flutter - sipLift - (activity === 'beckon' ? 0.9 : 0), 12, dt);
    // Beckoning: the right wing lifts and waves "this way".
    const wave = activity === 'beckon' ? -1.05 + Math.sin(t * 7) * 0.35 : -0.25;
    wingR.current!.rotation.z = THREE.MathUtils.damp(wingR.current!.rotation.z, wave, 10, dt);

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
    if (activity === 'beckon') roll = Math.sin(t * 3.5) * 0.14;
    head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 5, dt);
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, pitch, 5, dt);
    head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, roll, 3, dt);

    if (eyes.current) {
      const blink = t % 3.8 > 3.66 ? 0.1 : 1;
      eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, blink, 40, dt);
    }
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
            <meshPhysicalMaterial color="#3f5a26" roughness={1} sheen={1} sheenColor={SHEEN} sheenRoughness={0.6} />
          </mesh>
          <FurShells radius={BODY.r} position={BODY.c} scale={BODY.s} color={FUR} length={0.08} countershade />
          {[
            { ref: wingL, s: -1 },
            { ref: wingR, s: 1 },
          ].map(({ ref, s }) => (
            <mesh key={s} ref={ref} position={[s * 0.58, 0.92, 0.04]} rotation={[0.2, 0, s * -0.25]} scale={[0.35, 0.8, 0.6]} castShadow>
              <sphereGeometry args={[0.3, 20, 16]} />
              <meshPhysicalMaterial color={WING} roughness={1} sheen={1} sheenColor={SHEEN} />
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
                <meshPhysicalMaterial color="#3f5a26" roughness={1} sheen={1} sheenColor={SHEEN} sheenRoughness={0.6} />
              </mesh>
              <FurShells radius={HEAD.r} position={HEAD.c} color={FUR} length={0.045} droop={0.15} countershade />
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
