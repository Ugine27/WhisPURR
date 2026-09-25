import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { wind } from './nature';
import { canvasTexture } from './kit';
import { seeded, smooth, V3 } from './util';

/*
 * Kivi, a green kiwi. The model is built on a simple skeleton:
 *
 *   rig (spin) → jump (squash, stretch, arc) → body (breath, weight shift)
 *                                             → neck → head (look)
 *              → legs: hip → knee → foot → toes
 *
 * Feathers are shell layers that sag with gravity, sway in the shared wind and
 * trail behind when Kivi moves. Outfits are fabric worn over the feathers.
 */

const FEATHER = '#5a7c3c';
const SHEEN = '#cfe3a6';
const SKIN = '#c7b595';
export const BODY = { c: new THREE.Vector3(0, 0.92, -0.05), r: 0.62, s: new THREE.Vector3(1, 0.98, 1.3), tilt: -0.14 };
export const NECK = { c: new THREE.Vector3(0, 1.2, 0.5), r: 0.4 };
export const HEAD = { c: new THREE.Vector3(0, 1.44, 0.78), r: 0.34 };
const NECK_PIVOT = new THREE.Vector3(0, 1.18, 0.45);

export type Outfit = 'none' | 'suit' | 'casual' | 'dev';
export type Pose = 'stand' | 'sit';
export type Activity = 'none' | 'type' | 'sip' | 'watch' | 'beckon' | 'fly';

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

/* ------------------------------ surface helpers ----------------------------- */

const bodyMatrix = new THREE.Matrix4().compose(BODY.c, new THREE.Quaternion().setFromEuler(new THREE.Euler(BODY.tilt, 0, 0)), BODY.s);

// Place children on the body surface: theta from the top (0..1 of π), phi
// offset from straight ahead; +z points out of the surface.
function OnBody({ t, p = 0, lift = 0, tilt = 0, children }: { t: number; p?: number; lift?: number; tilt?: number; children: React.ReactNode }) {
  const { pos, quat } = useMemo(() => {
    const th = t * Math.PI;
    const ph = Math.PI / 2 + p;
    const local = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(BODY.r + 0.1 + lift);
    const pos = local.clone().applyMatrix4(bodyMatrix);
    // Normal of a scaled sphere: divide by the scale, then rotate.
    const n = local.clone().divide(BODY.s).normalize().applyEuler(new THREE.Euler(BODY.tilt, 0, 0)).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)));
    return { pos, quat };
  }, [t, p, lift, tilt]);
  return (
    <group position={pos} quaternion={quat}>
      {children}
    </group>
  );
}

function OnHead({ t, p = 0, lift = 0, children }: { t: number; p?: number; lift?: number; children: React.ReactNode }) {
  const { pos, quat } = useMemo(() => {
    const th = t * Math.PI;
    const ph = Math.PI / 2 + p;
    const n = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    const pos = HEAD.c.clone().addScaledVector(n, HEAD.r + lift);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return { pos, quat };
  }, [t, p, lift]);
  return (
    <group position={pos} quaternion={quat}>
      {children}
    </group>
  );
}

/* --------------------------------- feathers -------------------------------- */

// Long, hair-like kiwi feathers drawn as tapered strands in an alpha texture.
const LAYERS = 18;
let featherTex: { alpha: THREE.DataTexture; tint: THREE.DataTexture } | null = null;
function featherTextures() {
  if (featherTex) return featherTex;
  const w = 512;
  const h = 256;
  const alpha = new Uint8Array(w * h * 4);
  const tint = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) tint.set([232, 238, 222, 255], i * 4);
  const rand = seeded(99);
  for (let f = 0; f < 6500; f++) {
    const x0 = Math.floor(rand() * w);
    const y0 = Math.floor(rand() * h);
    const len = 14 + rand() * 30;
    const width = 1.2 + rand() * 2.2;
    const strength = 0.35 + rand() * 0.65;
    const lum = 0.78 + rand() * 0.36;
    const warm = (rand() - 0.5) * 0.16;
    for (let dy = 0; dy < len; dy++) {
      const t = dy / len;
      const hw = width * (1 - t * 0.85);
      const y = (y0 + dy) % h;
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const edge = 1 - Math.abs(dx) / (hw + 0.5);
        if (edge <= 0) continue;
        const x = (x0 + dx + w) % w;
        const v = Math.floor(255 * strength * (1 - t * 0.5) * Math.sqrt(edge));
        const k = (y * w + x) * 4;
        if (v > alpha[k]) {
          alpha.set([v, v, v, 255], k);
          tint.set([Math.min(255, 255 * lum * (1 + warm)), Math.min(255, 255 * lum), Math.min(255, 255 * lum * (1 - warm)), 255], k);
        }
      }
    }
  }
  const make = (data: Uint8Array<ArrayBuffer>, srgb: boolean) => {
    const t = new THREE.DataTexture(data, w, h);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 2);
    t.magFilter = THREE.LinearFilter;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  featherTex = { alpha: make(alpha, false), tint: make(tint, true) };
  return featherTex;
}

// Shared motion: a lagging velocity the feathers trail against.
const trail = { value: new THREE.Vector3() };

function Feathers({ radius, position, scale = [1, 1, 1], rotation = [0, 0, 0], length, countershade = false }: { radius: number; position: THREE.Vector3 | V3; scale?: THREE.Vector3 | V3; rotation?: V3; length: number; countershade?: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 56, 40);
    if (!countershade) return g;
    const n = g.attributes.normal as THREE.BufferAttribute;
    const cols = new Float32Array(n.count * 3);
    const light = new THREE.Color(1.18, 1.16, 1.02);
    const dark = new THREE.Color(0.78, 0.82, 0.8);
    const c = new THREE.Color();
    for (let i = 0; i < n.count; i++) {
      const belly = THREE.MathUtils.clamp(Math.max(0, n.getZ(i)) * 0.5 + Math.max(0, -n.getY(i) + 0.1) * 0.6, 0, 1);
      const back = THREE.MathUtils.clamp(-n.getZ(i) * 0.5 + n.getY(i) * 0.35, 0, 1);
      c.setRGB(1, 1, 1).lerp(light, belly * 0.7).lerp(dark, back * 0.7);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  }, [radius, countershade]);

  const mats = useMemo(
    () =>
      Array.from({ length: LAYERS }, (_, i) => {
        const h = (i + 1) / LAYERS;
        const { alpha, tint } = featherTextures();
        const m = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(FEATHER).multiplyScalar(0.6 + h * 0.55),
          map: tint,
          alphaMap: alpha,
          alphaTest: 0.05 + h * 0.8,
          roughness: 1,
          sheen: 1,
          sheenColor: new THREE.Color(SHEEN),
          sheenRoughness: 0.5,
          vertexColors: countershade,
        });
        // Strands sag, sway in the wind and trail against Kivi's motion; the
        // effect grows towards the tips (outer layers).
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uWind = wind;
          shader.uniforms.uTrail = trail;
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform vec3 uTrail;').replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
              float hh = ${(h * h).toFixed(4)};
              vec3 sway = vec3(sin(uWind * 2.2 + position.y * 9.0 + position.x * 5.0), 0.0, cos(uWind * 1.7 + position.z * 7.0)) * 0.012;
              transformed += (sway - uTrail * 0.05 + vec3(0.0, -${(length * 0.5).toFixed(3)}, 0.0)) * hh;
            }`,
          );
        };
        return m;
      }),
    [countershade, length],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial color="#3d5626" roughness={1} sheen={1} sheenColor={SHEEN} vertexColors={countershade} />
      </mesh>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} scale={1 + (((i + 1) / LAYERS) * length) / radius} />
      ))}
    </group>
  );
}

/* ------------------------------- head details ------------------------------ */

function Beak() {
  const geo = useMemo(() => {
    // Long, slender and gently down-curved, as a kiwi's is.
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 1.4, 1.04), new THREE.Vector3(0, 1.36, 1.4), new THREE.Vector3(0, 1.1, 1.72), new THREE.Vector3(0, 0.74, 1.86));
    const segs = 40;
    const radial = 14;
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = curve.getPointAt(t);
      const r = 0.085 * (1 - t * 0.78) + (t > 0.94 ? (t - 0.94) * 0.4 : 0);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c);
        v.x *= 0.85;
        v.multiplyScalar(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const ridges = useMemo(() => {
    const t = canvasTexture(
      64,
      256,
      (ctx) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 64, 256);
        for (let y = 0; y < 256; y += 5) {
          const v = y % 10 ? 150 : 110;
          ctx.fillStyle = `rgba(${v},${v},${v},0.6)`;
          ctx.fillRect(0, y, 64, 2);
        }
      },
      [1, 1],
    );
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial color="#d8c3a2" roughness={0.42} clearcoat={0.3} clearcoatRoughness={0.5} bumpMap={ridges} bumpScale={0.6} />
      </mesh>
      {/* Nostrils sit at the very tip, as only a kiwi's do */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.018, 0.78, 1.86]} rotation={[0.6, 0, 0]}>
          <sphereGeometry args={[0.009, 8, 8]} />
          <meshStandardMaterial color="#6b5a45" />
        </mesh>
      ))}
    </group>
  );
}

function Eye({ side }: { side: 1 | -1 }) {
  return (
    <OnHead t={0.42} p={side * 0.7} lift={0.045}>
      <mesh scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshStandardMaterial color="#39472a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.02]} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.07, 32, 32]} />
        <meshPhysicalMaterial color="#120c08" roughness={0.04} clearcoat={1} clearcoatRoughness={0.02} />
      </mesh>
      <mesh position={[0.018, 0.022, 0.058]}>
        <sphereGeometry args={[0.014, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </OnHead>
  );
}

// Rictal bristles: fine whiskers fanning out from the base of the beak.
function Whiskers() {
  const geos = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const rand = seeded(3);
    for (let s = -1; s <= 1; s += 2)
      for (let i = 0; i < 7; i++) {
        const base = new THREE.Vector3(s * (0.07 + rand() * 0.05), 1.34 + rand() * 0.1, 1.0 + rand() * 0.04);
        const tip = base.clone().add(new THREE.Vector3(s * (0.18 + rand() * 0.14), (rand() - 0.6) * 0.14, 0.1 + rand() * 0.12));
        const mid = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.03, 0));
        parts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, mid, tip), 6, 0.0035, 3, false));
      }
    return parts;
  }, []);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#26301c" roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/* ----------------------------------- legs ---------------------------------- */

function scaleTexture() {
  const t = canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 12)
        for (let x = (y / 12) % 2 ? 6 : 0; x < 128; x += 12) {
          const g = ctx.createRadialGradient(x + 6, y + 6, 1, x + 6, y + 6, 7);
          g.addColorStop(0, '#b0b0b0');
          g.addColorStop(1, '#505050');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + 6, y + 6, 6, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    [1, 3],
  );
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

interface LegRig {
  hip: React.RefObject<THREE.Group>;
  knee: React.RefObject<THREE.Group>;
  foot: React.RefObject<THREE.Group>;
}

function Leg({ side, rig, scales }: { side: 1 | -1; rig: LegRig; scales: THREE.Texture }) {
  const skin = <meshStandardMaterial color={SKIN} roughness={0.7} bumpMap={scales} bumpScale={1.2} />;
  return (
    <group ref={rig.hip} position={[side * 0.24, 0.58, 0.05]}>
      {/* A short feathered thigh hides in the body; the scaled shin shows. */}
      <mesh position={[0, -0.08, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.1, 6, 12]} />
        <meshPhysicalMaterial color={FEATHER} roughness={1} sheen={1} sheenColor={SHEEN} />
      </mesh>
      <group ref={rig.knee} position={[0, -0.2, 0.02]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <cylinderGeometry args={[0.052, 0.062, 0.36, 14]} />
          {skin}
        </mesh>
        <group ref={rig.foot} position={[0, -0.36, 0]}>
          {[-0.45, 0, 0.45].map((a) => (
            <group key={a} rotation={[0, a, 0]}>
              <mesh position={[0, -0.005, 0.13]} rotation={[Math.PI / 2 - 0.08, 0, 0]} castShadow>
                <capsuleGeometry args={[0.028, 0.22, 4, 10]} />
                {skin}
              </mesh>
              <mesh position={[0, -0.02, 0.28]} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
                <coneGeometry args={[0.018, 0.07, 8]} />
                <meshStandardMaterial color="#3a3128" roughness={0.4} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.0, -0.07]} rotation={[-Math.PI / 2 + 0.3, 0, 0]} castShadow>
            <capsuleGeometry args={[0.024, 0.08, 4, 8]} />
            {skin}
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------- outfits -------------------------------- */

const G_R = BODY.r + 0.13; // just over the feathers, so fabric hugs the body
const FRONT = Math.PI / 2;

function Garment({ color, sheen, theta, phi, r = G_R, bump }: { color: string; sheen: string; theta: [number, number]; phi?: [number, number]; r?: number; bump?: THREE.Texture }) {
  const [phiStart, phiLength] = phi ?? [0, Math.PI * 2];
  return (
    <mesh position={BODY.c} scale={BODY.s} rotation={[BODY.tilt, 0, 0]} castShadow receiveShadow>
      <sphereGeometry args={[r, 64, 40, phiStart, phiLength, theta[0] * Math.PI, (theta[1] - theta[0]) * Math.PI]} />
      <meshPhysicalMaterial color={color} roughness={0.9} sheen={1} sheenColor={sheen} sheenRoughness={0.4} bumpMap={bump ?? knitTexture()} bumpScale={bump ? 2.5 : 0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Garments unroll downward from the neckline during the outfit change.
const DRAPE_TOP: V3 = [0, 1.34, 0.1];
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
  knit = canvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 8)
        for (let x = 0; x < 256; x += 8) {
          ctx.strokeStyle = Math.floor(x / 8) % 6 === 0 ? '#e0e0e0' : '#b8b8b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 1, y + 1);
          ctx.lineTo(x + 4, y + 7);
          ctx.lineTo(x + 7, y + 1);
          ctx.stroke();
        }
    },
    [8, 4],
  );
  knit.colorSpace = THREE.NoColorSpace;
  return knit;
}

function BodyPieces({ outfit }: { outfit: Outfit }) {
  switch (outfit) {
    case 'suit': {
      const gap = 0.8;
      return (
        <>
          <Drape beat={0}>
            <Garment color="#f5f3ee" sheen="#ffffff" theta={[0.24, 0.55]} phi={[FRONT - 0.36, 0.72]} r={G_R - 0.016} />
            <Garment color="#6f7479" sheen="#b4b9bf" theta={[0.34, 0.68]} phi={[FRONT - 0.52, 1.04]} r={G_R - 0.008} />
            <Garment color="#8e9398" sheen="#cfd4da" theta={[0.26, 0.72]} phi={[FRONT + gap / 2, Math.PI * 2 - gap]} />
          </Drape>
          {[-1, 1].map((s) => (
            <OnBody key={s} t={0.36} p={s * 0.34} lift={0.08}>
              <mesh name="beat:1.5" rotation={[0, 0, s * 0.45]} castShadow>
                <boxGeometry args={[0.1, 0.36, 0.025]} />
                <meshPhysicalMaterial color="#7e8388" roughness={0.7} sheen={1} sheenColor="#cfd4da" />
              </mesh>
            </OnBody>
          ))}
          <OnBody t={0.27} lift={0.09}>
            <mesh name="beat:2" castShadow>
              <boxGeometry args={[0.12, 0.09, 0.06]} />
              <Mat color="#3f6630" rough={0.5} />
            </mesh>
          </OnBody>
          <OnBody t={0.38} lift={0.08}>
            <mesh name="beat:2.3" castShadow>
              <boxGeometry args={[0.11, 0.3, 0.025]} />
              <meshPhysicalMaterial color="#4f7a3a" roughness={0.45} sheen={0.6} sheenColor="#9cc07a" />
            </mesh>
          </OnBody>
          {[0.5, 0.58].map((t) => (
            <OnBody key={t} t={t} lift={0.075}>
              <mesh name="beat:2.6">
                <sphereGeometry args={[0.018, 10, 10]} />
                <Mat color="#3b3e42" rough={0.4} />
              </mesh>
            </OnBody>
          ))}
          <OnBody t={0.4} p={0.75} lift={0.07}>
            <mesh name="beat:2.8">
              <boxGeometry args={[0.12, 0.07, 0.02]} />
              <Mat color="#f5f3ee" />
            </mesh>
          </OnBody>
        </>
      );
    }
    case 'casual':
      return (
        <>
          <Drape beat={0}>
            <Garment color="#9ea3a8" sheen="#dfe3e7" theta={[0.22, 0.74]} bump={knitTexture()} />
          </Drape>
          {[-0.12, 0.12].map((p) => (
            <OnBody key={p} t={0.34} p={p} lift={0.08}>
              <mesh name="beat:1.8" position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
                <Mat color="#f1efe9" />
              </mesh>
            </OnBody>
          ))}
        </>
      );
    case 'dev':
      return (
        <>
          <Drape beat={0}>
            <Garment color="#2f343c" sheen="#6d7785" theta={[0.28, 0.66]} phi={[FRONT + 0.1, Math.PI * 2 - 0.2]} />
            <Garment color="#7dd3c0" sheen="#d2fff4" theta={[0.55, 0.58]} phi={[FRONT + 0.1, Math.PI * 2 - 0.2]} r={G_R + 0.004} />
          </Drape>
          <OnBody t={0.5} lift={0.075}>
            <mesh name="beat:1.2">
              <boxGeometry args={[0.022, 0.5, 0.02]} />
              <Mat color="#9aa3ad" rough={0.3} />
            </mesh>
          </OnBody>
          {[-1, 1].map((s) => (
            <OnBody key={s} t={0.4} p={s * 0.4} lift={0.085}>
              <mesh name="beat:1.8" castShadow>
                <boxGeometry args={[0.18, 0.16, 0.05]} />
                <Mat color="#262a31" rough={0.8} />
              </mesh>
            </OnBody>
          ))}
          <OnBody t={0.33} p={-0.4} lift={0.11}>
            <mesh name="beat:2.4">
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshStandardMaterial color="#7dd3c0" emissive="#7dd3c0" emissiveIntensity={2.5} toneMapped={false} />
            </mesh>
          </OnBody>
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
        <>
          {/* the hood, resting on the back of the neck */}
          <mesh name="beat:0.8" position={[0, 1.26, 0.28]} rotation={[0.9, 0, 0]} castShadow>
            <torusGeometry args={[0.36, 0.11, 14, 36, Math.PI * 1.25]} />
            <meshPhysicalMaterial color="#8f949a" roughness={0.9} sheen={1} sheenColor="#d3d7db" />
          </mesh>
          {/* a small knit beanie */}
          <group position={HEAD.c} rotation={[-0.3, 0, 0.08]}>
            <mesh name="beat:1.2" position={[0, 0.06, -0.06]} castShadow>
              <sphereGeometry args={[HEAD.r + 0.06, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.33]} />
              <meshPhysicalMaterial color="#a8987c" roughness={1} sheen={1} sheenColor="#e8dcc4" bumpMap={knitTexture()} bumpScale={3} side={THREE.DoubleSide} />
            </mesh>
            <mesh name="beat:1.5" position={[0, 0.06 + (HEAD.r + 0.06) * Math.cos(Math.PI * 0.33), -0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[(HEAD.r + 0.06) * Math.sin(Math.PI * 0.33), 0.035, 12, 40]} />
              <meshPhysicalMaterial color="#978869" roughness={1} sheen={1} sheenColor="#e8dcc4" bumpMap={knitTexture()} bumpScale={3} />
            </mesh>
          </group>
        </>
      );
    case 'dev':
      // A focused brow: feathered ridges angled over the eyes.
      return (
        <>
          {[-1, 1].map((s) => (
            <OnHead key={s} t={0.3} p={s * 0.7} lift={0.05}>
              <mesh name="beat:1" rotation={[0, 0, s * -0.4]} castShadow>
                <capsuleGeometry args={[0.022, 0.12, 4, 10]} />
                <meshPhysicalMaterial color="#344b22" roughness={1} sheen={1} sheenColor={SHEEN} />
              </mesh>
            </OnHead>
          ))}
        </>
      );
    default:
      return null;
  }
}

/* ------------------------------ transformation ----------------------------- */

function Swirl({ progress }: { progress: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const count = 28;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = progress.current;
    g.visible = p > 0 && p < 1;
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      const f = i / count;
      const a = p * Math.PI * 5 + f * Math.PI * 2;
      const r = 1.05 - p * 0.35;
      c.position.set(Math.cos(a) * r, 0.1 + ((p * 1.6 + f * 0.9) % 1) * 2.3, Math.sin(a) * r);
      c.scale.setScalar(Math.sin(p * Math.PI) * (0.6 + (i % 3) * 0.3));
    });
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#fff6dc" emissive={i % 2 ? '#ffe3a3' : '#f1ffe0'} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const TRANSFORM_SECONDS = 1.1;
const baseScales = new WeakMap<THREE.Object3D, THREE.Vector3>();

/* ---------------------------------- Kivi ----------------------------------- */

export default function Kiwi3D({ outfit, walking, pose = 'stand', activity = 'none', lookAt = null, hopKey = 0 }: Kiwi3DProps) {
  const rig = useRef<THREE.Group>(null);
  const jump = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const lids = useRef<THREE.Group>(null);
  const bodyPieces = useRef<THREE.Group>(null);
  const headPieces = useRef<THREE.Group>(null);
  const legL = { hip: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), foot: useRef<THREE.Group>(null) };
  const legR = { hip: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), foot: useRef<THREE.Group>(null) };
  const scales = useMemo(scaleTexture, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const lastWorld = useRef<THREE.Vector3 | null>(null);

  const prevOutfit = useRef(outfit);
  const transformAt = useRef<number | 'pending' | null>(null);
  const transformP = useRef(0);
  const hopAt = useRef<number | 'pending' | null>(null);
  const lastHop = useRef(hopKey);
  const wasFlying = useRef(false);

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
    if (!rig.current || !jump.current || !body.current || !head.current) return;

    // Feathers trail against motion: a softened world-space velocity.
    const wp = rig.current.getWorldPosition(tmp).clone();
    if (lastWorld.current && frameDt > 0) {
      const v = wp.clone().sub(lastWorld.current).divideScalar(Math.max(frameDt, 1e-3));
      trail.value.lerp(v.clampLength(0, 4), 1 - Math.exp(-6 * dt));
    }
    lastWorld.current = wp;

    // Outfit transformation: a twirl, a spiral of glints, pieces arriving.
    if (transformAt.current === 'pending') transformAt.current = t;
    const tp = typeof transformAt.current === 'number' ? Math.min((t - transformAt.current) / TRANSFORM_SECONDS, 1) : 1;
    transformP.current = tp >= 1 ? 0 : tp;
    rig.current.rotation.y = tp < 1 ? smooth(tp) * Math.PI * 2 : 0;
    for (const g of [bodyPieces.current, headPieces.current]) {
      g?.traverse((o) => {
        if (o.name.startsWith('drape:')) {
          const p = THREE.MathUtils.clamp((tp - 0.25 - parseFloat(o.name.slice(6)) * 0.1) / 0.45, 0, 1);
          const e = 1 - Math.pow(1 - p, 3);
          o.scale.set(0.9 + 0.1 * e, Math.max(e, 0.001), 0.9 + 0.1 * e);
          o.visible = p > 0;
          return;
        }
        const beat = o.name.startsWith('beat:') ? parseFloat(o.name.slice(5)) : NaN;
        if (Number.isNaN(beat)) return;
        let base = baseScales.get(o);
        if (!base) baseScales.set(o, (base = o.scale.clone()));
        const p = THREE.MathUtils.clamp((tp - 0.3 - beat * 0.1) / 0.35, 0, 1);
        const s = p >= 1 ? 1 : p <= 0 ? 0.001 : 1 - Math.cos(p * Math.PI * 2.5) * Math.exp(-p * 5);
        o.scale.copy(base).multiplyScalar(Math.max(s, 0.001));
      });
    }

    // Jump: anticipation crouch → stretch at take-off → parabolic arc →
    // squash on landing → a damped wobble (follow-through).
    const flying = activity === 'fly';
    if (wasFlying.current && !flying) hopAt.current = t - 0.56; // land straight into the squash
    wasFlying.current = flying;
    if (hopAt.current === 'pending') hopAt.current = t;
    const since = typeof hopAt.current === 'number' ? t - hopAt.current : Infinity;
    const ANTIC = 0.14;
    const AIR = 0.42;
    let sy = 1;
    let lift = 0;
    let tuck = 0;
    if (since < ANTIC) {
      const a = Math.sin((since / ANTIC) * Math.PI * 0.5);
      sy = 1 - 0.16 * a;
      tuck = a * 0.5;
    } else if (since < ANTIC + AIR) {
      const u = (since - ANTIC) / AIR;
      lift = 0.42 * 4 * u * (1 - u);
      sy = 1 + 0.14 * (1 - u) - 0.04 * u;
      tuck = 0.6 * Math.sin(u * Math.PI);
    } else if (since < ANTIC + AIR + 1.2) {
      const w = since - ANTIC - AIR;
      sy = 1 - 0.2 * Math.exp(-7 * w) * Math.cos(w * 18);
      tuck = Math.max(0, 0.4 - w * 2);
    }
    const breathe = walking || flying ? 0 : Math.sin(t * 1.9) * 0.012;
    const syy = sy + breathe;
    jump.current.scale.set(1 / Math.sqrt(syy), syy, 1 / Math.sqrt(syy));
    jump.current.position.y = lift;

    // Body: waddle when walking, slow weight shift when idle.
    const stride = walking ? Math.sin(t * 11) : 0;
    const sitting = pose === 'sit';
    const idle = !walking && !flying && !sitting;
    const shift = idle ? Math.sin(t * 0.55) : 0;
    body.current.position.x = THREE.MathUtils.damp(body.current.position.x, shift * 0.035, 3, dt);
    body.current.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.05 : 0;
    body.current.rotation.z = THREE.MathUtils.damp(body.current.rotation.z, stride * 0.08 - shift * 0.035, 10, dt);
    body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, sitting ? -0.1 : flying ? 0.35 : 0, 6, dt);

    // Legs: a stepping cycle with knee bend; folded when seated or flying;
    // one knee softens as the weight shifts.
    for (const [side, leg] of [
      [1, legL],
      [-1, legR],
    ] as const) {
      const hip = leg.hip.current;
      const knee = leg.knee.current;
      const foot = leg.foot.current;
      if (!hip || !knee || !foot) continue;
      const off = side > 0 ? 0 : Math.PI;
      const phase = walking ? Math.sin(t * 11 + off) : 0;
      const lifted = walking ? Math.max(0, Math.cos(t * 11 + off)) : 0;
      let hipX = phase * 0.55;
      let kneeX = -lifted * 0.7;
      if (sitting) {
        hipX = -1.25;
        kneeX = 0.35;
      } else if (flying) {
        hipX = 0.9;
        kneeX = -1.1;
      } else if (idle) {
        kneeX = -Math.max(0, shift * side) * 0.18;
      }
      hipX -= tuck * 0.4;
      kneeX -= tuck * 0.8;
      hip.rotation.x = THREE.MathUtils.damp(hip.rotation.x, hipX, 14, dt);
      knee.rotation.x = THREE.MathUtils.damp(knee.rotation.x, kneeX, 14, dt);
      foot.rotation.x = THREE.MathUtils.damp(foot.rotation.x, -(hipX + kneeX) * 0.9, 14, dt);
    }

    // Tiny wings: tapping while typing, a wave to beckon, a blur in flight.
    const tap = activity === 'type' ? Math.sin(t * 16) * 0.2 : 0;
    const flap = flying ? 0.3 + 1.2 * Math.abs(Math.sin(t * 18)) : 0.3;
    wingL.current!.rotation.z = THREE.MathUtils.damp(wingL.current!.rotation.z, flap + tap, 20, dt);
    const wave = activity === 'beckon' ? -1.1 + Math.sin(t * 7) * 0.4 : -flap + tap;
    wingR.current!.rotation.z = THREE.MathUtils.damp(wingR.current!.rotation.z, wave, 14, dt);

    // Head: look at what matters, otherwise small curious movements.
    let yaw = Math.sin(t * 0.47) * 0.2 + Math.sin(t * 1.3) * 0.04;
    let pitch = Math.sin(t * 0.33) * 0.06;
    let roll = Math.sin(t * 0.7) * 0.08;
    if (lookAt) {
      tmp.copy(lookAt);
      body.current.worldToLocal(tmp).sub(NECK_PIVOT);
      yaw = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(-Math.atan2(tmp.y - 0.3, Math.hypot(tmp.x, tmp.z)), -0.5, 0.55);
      roll *= 0.4;
    }
    if (activity === 'type') pitch += 0.12 + (Math.sin(t * 0.6) > 0.85 ? -0.3 : 0);
    if (activity === 'sip') pitch += Math.max(0, Math.sin(t * 0.8)) * 0.35;
    if (activity === 'watch') yaw += Math.sin(t * 2.2) * 0.04;
    if (activity === 'beckon') roll = Math.sin(t * 3.5) * 0.16;
    if (flying) pitch -= 0.25;
    head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 5, dt);
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, pitch, 5, dt);
    head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, roll, 3, dt);

    // Blinks, sometimes a double blink; focused eyes narrow slightly.
    if (lids.current) {
      const cycle = t % 4.1;
      const shut = cycle > 3.95 || (Math.floor(t / 4.1) % 3 === 1 && cycle > 3.7 && cycle < 3.8);
      const open = outfit === 'dev' ? 0.8 : 1;
      lids.current.scale.y = THREE.MathUtils.damp(lids.current.scale.y, shut ? 0.08 : open, 40, dt);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.1]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#1c2414" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <group ref={rig}>
        <group ref={jump}>
          <Leg side={1} rig={legL} scales={scales} />
          <Leg side={-1} rig={legR} scales={scales} />
          <group ref={body}>
            <Feathers radius={BODY.r} position={BODY.c} scale={BODY.s} rotation={[BODY.tilt, 0, 0]} length={0.14} countershade />
            <Feathers radius={NECK.r} position={NECK.c} length={0.12} countershade />
            {[
              { ref: wingL, s: 1 },
              { ref: wingR, s: -1 },
            ].map(({ ref, s }) => (
              <mesh key={s} ref={ref} position={[s * 0.62, 1.0, 0.15]} rotation={[0.3, 0, s * 0.3]} scale={[0.25, 0.6, 0.5]} castShadow>
                <sphereGeometry args={[0.3, 20, 16]} />
                <meshPhysicalMaterial color="#4b6a2f" roughness={1} sheen={1} sheenColor={SHEEN} />
              </mesh>
            ))}
            <group ref={bodyPieces}>
              <group key={outfit}>
                <BodyPieces outfit={outfit} />
              </group>
            </group>

            <group ref={head} position={NECK_PIVOT}>
              <group position={[-NECK_PIVOT.x, -NECK_PIVOT.y, -NECK_PIVOT.z]}>
                <Feathers radius={HEAD.r} position={HEAD.c} length={0.07} countershade />
                <group ref={lids} position={[0, HEAD.c.y + 0.08, 0]}>
                  <group position={[0, -(HEAD.c.y + 0.08), 0]}>
                    <Eye side={-1} />
                    <Eye side={1} />
                  </group>
                </group>
                <Beak />
                <Whiskers />
                <group ref={headPieces}>
                  <group key={outfit}>
                    <HeadPieces outfit={outfit} />
                  </group>
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
