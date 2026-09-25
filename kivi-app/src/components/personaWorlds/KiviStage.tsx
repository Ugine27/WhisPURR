import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { WorldId } from './worlds';

/*
 * Kivi, drawn over the flat worlds in its own transparent canvas. The camera
 * is orthographic with one unit per CSS pixel, so the page places Kivi in
 * pixels. The GLB has no skeleton: legs and head are posed in the vertex
 * shader, the eyelids are painted in the fragment shader, and each world's
 * accessories are small primitives that follow the head.
 *
 * Mesh anatomy (model space; faces +z): feet y -0.81..-0.61, hips y -0.53,
 * head centre (0, 0.6, 0.22) r 0.22, eyes (+-0.125, 0.617, 0.352).
 */

const KIVI_URL = '/models/kivi.glb';
useGLTF.preload(KIVI_URL);

const MODEL_H = 1.61;
const HIP_Y = -0.53;
const HIP_Z = -0.42;
const NECK = new THREE.Vector3(0, 0.3, 0.02);
const HEAD = new THREE.Vector3(0, 0.6, 0.2);
const v3 = (v: THREE.Vector3) => `vec3(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;

const RIG_GLSL = `
uniform float uLegL; uniform float uLegR; uniform float uLiftL; uniform float uLiftR;
uniform float uHeadYaw; uniform float uHeadPitch; uniform float uTime; uniform float uBreath;
varying vec3 vRest;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
void kiviRig(inout vec3 p, inout vec3 n) {
  vec3 p0 = p;
  vRest = p0;
  // Breathing and a slow ripple through the feathers, body only.
  float body = smoothstep(-0.55, -0.35, p0.y) * (1.0 - smoothstep(0.3, 0.45, p0.y));
  p += n * body * (uBreath * 0.012 + sin(uTime * 2.3 + p0.y * 17.0 + p0.z * 9.0) * 0.0025);
  float legW = 1.0 - smoothstep(${(HIP_Y - 0.09).toFixed(3)}, ${(HIP_Y + 0.03).toFixed(3)}, p0.y);
  float left = smoothstep(-0.03, 0.05, p0.x);
  float right = 1.0 - smoothstep(-0.05, 0.03, p0.x);
  float foot = 1.0 - smoothstep(-0.72, -0.6, p0.y);
  vec3 hip = vec3(p0.x, ${HIP_Y.toFixed(3)}, ${HIP_Z.toFixed(3)});
  if (legW > 0.0) {
    mat3 r = rotX((uLegL * left + uLegR * right) * legW);
    p = hip + r * (p - hip);
    n = normalize(mix(n, r * n, legW));
    p.y += (uLiftL * left + uLiftR * right) * foot;
  }
  float headW = smoothstep(0.16, 0.4, p0.y) * smoothstep(-0.4, -0.05, p0.z);
  if (headW > 0.0) {
    mat3 r = rotY(uHeadYaw * headW) * rotX(-uHeadPitch * headW);
    p = ${v3(NECK)} + r * (p - ${v3(NECK)});
    n = normalize(mix(n, r * n, headW));
  }
}
`;

// Eyelids: paint over the eye from the top down as uBlink goes 0 -> 1.
const LID_GLSL = `
{
  vec3 e = vec3(abs(vRest.x), vRest.y, vRest.z);
  float d = distance(e, vec3(0.125, 0.617, 0.352));
  if (d < 0.048 && vRest.y > 0.617 + 0.048 - 0.096 * uBlink) diffuseColor.rgb = vec3(0.11, 0.15, 0.05);
}
`;

interface Uniforms {
  [k: string]: THREE.IUniform<number>;
}

function rig(material: THREE.Material, u: Uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${RIG_GLSL}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 kP = position; kiviRig(kP, objectNormal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = kP;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform float uBlink;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${LID_GLSL}`);
  };
  material.needsUpdate = true;
}

const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/* ------------------------------- accessories ------------------------------- */

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => <meshStandardMaterial color={color} roughness={0.6} {...extra} />;

function Glasses() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.155, 0.625, 0.36]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.062, 0.018, 8, 24]} />
          {std('#d8b56a', { metalness: 0.8, roughness: 0.3 })}
        </mesh>
      ))}
      <mesh position={[0, 0.672, 0.39]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.3, 6]} />
        {std('#d8b56a', { metalness: 0.8, roughness: 0.3 })}
      </mesh>
    </group>
  );
}

function BowTie() {
  return (
    <group position={[0, 0.27, 0.33]} rotation={[-0.35, 0, 0]} scale={1.5}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.048, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
          <coneGeometry args={[0.045, 0.09, 4]} />
          {std('#4a6fb0')}
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.022, 10, 8]} />
        {std('#2f4a7a')}
      </mesh>
    </group>
  );
}

function Beanie() {
  return (
    <group position={HEAD.toArray()} rotation={[-0.35, 0, 0]}>
      <mesh scale={[1.03, 1.1, 1.05]}>
        <sphereGeometry args={[0.236, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {std('#c8693e', { roughness: 0.95 })}
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.236, 0.036, 8, 32]} />
        {std('#a9532f', { roughness: 0.95 })}
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <icosahedronGeometry args={[0.06, 1]} />
        {std('#efe4d0', { roughness: 1 })}
      </mesh>
    </group>
  );
}

function Headphones() {
  return (
    <group position={[HEAD.x, HEAD.y, HEAD.z - 0.03]}>
      <mesh>
        <torusGeometry args={[0.265, 0.04, 10, 32, Math.PI]} />
        {std('#1c1f1d', { roughness: 0.4 })}
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.255, -0.02, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.09, 20]} />
            {std('#1c1f1d', { roughness: 0.4 })}
          </mesh>
          <mesh position={[s * 0.047, 0.035, 0.02]}>
            <sphereGeometry args={[0.017, 8, 6]} />
            <meshStandardMaterial color="#a4e35a" emissive="#a4e35a" emissiveIntensity={1.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------- kivi ----------------------------------- */

export interface KiviTarget {
  x: number; // px from the stage centre
  y: number; // px from the stage centre, up is positive; Kivi's feet
  size: number; // px tall
}

interface KiviProps {
  target: KiviTarget;
  world: WorldId | null;
  tint: string;
  reduced: boolean;
}

function Kivi({ target, world, tint, reduced }: KiviProps) {
  const { scene } = useGLTF(KIVI_URL);
  const root = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const acc = useRef(new Map<THREE.Group, WorldId>());
  const outfit = (id: WorldId) => (g: THREE.Group | null) => {
    if (g) acc.current.set(g, id);
  };
  const rim = useRef<THREE.DirectionalLight>(null);
  const state = useRef({ x: target.x, y: target.y, size: target.size, phase: 0, facing: 1, blinkAt: 2, blinkT: -1, yaw: 0.6 });
  const tintColor = useMemo(() => new THREE.Color(), []);
  const u = useMemo<Uniforms>(
    () => ({
      uLegL: { value: 0 },
      uLegR: { value: 0 },
      uLiftL: { value: 0 },
      uLiftR: { value: 0 },
      uHeadYaw: { value: 0 },
      uHeadPitch: { value: 0 },
      uTime: { value: 0 },
      uBreath: { value: 0 },
      uBlink: { value: 0 },
    }),
    [],
  );

  const { model, offset } = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const centre = box.getCenter(new THREE.Vector3());
    const off = new THREE.Vector3(-centre.x, -box.min.y, -centre.z);
    return { model: c, offset: off };
  }, [scene]);

  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      rig(mat, u);
      mesh.material = mat;
      mesh.frustumCulled = false;
    });
  }, [model, u]);

  useFrame(({ clock, pointer }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const s = state.current;
    if (!root.current || !turn.current) return;

    // Walk toward the target at a steady pace, easing in over the last stretch.
    const dx = target.x - s.x;
    const speed = Math.max(180, target.size * 3.2);
    const step = reduced ? dx : Math.sign(dx) * Math.min(Math.abs(dx), speed * dt * Math.min(1, Math.abs(dx) / 40 + 0.35));
    s.x += step;
    s.y = reduced ? target.y : damp(s.y, target.y, 5, dt);
    s.size = reduced ? target.size : damp(s.size, target.size, 4, dt);
    const walking = Math.abs(dx) > 1.5 && !reduced;
    const scale = s.size / MODEL_H;
    if (walking) {
      s.facing = Math.sign(dx);
      s.phase += (Math.abs(step) / scale / 0.3) * Math.PI;
    }
    const stride = walking ? Math.min(1, Math.abs(dx) / 20) : 0;
    const sw = Math.sin(s.phase);
    u.uLegL.value = damp(u.uLegL.value, sw * 0.55 * stride, 14, dt);
    u.uLegR.value = damp(u.uLegR.value, -sw * 0.55 * stride, 14, dt);
    u.uLiftL.value = Math.max(0, -Math.cos(s.phase)) * 0.07 * stride;
    u.uLiftR.value = Math.max(0, Math.cos(s.phase)) * 0.07 * stride;

    // Face the way it walks; at rest, a three-quarter turn toward the viewer.
    const restYaw = s.facing * 0.62;
    s.yaw = damp(s.yaw, walking ? s.facing * 1.45 : restYaw, 7, dt);
    turn.current.rotation.set(0.14, s.yaw, 0);

    const bob = walking ? Math.abs(Math.sin(s.phase)) * 0.03 * s.size : 0;
    root.current.position.set(s.x, s.y + bob, 0);
    root.current.scale.setScalar(scale);

    // Idle life: breathing, glances, a look toward the pointer, and blinks.
    u.uTime.value = t;
    u.uBreath.value = reduced ? 0 : Math.sin(t * 2.1);
    const yaw = walking ? 0 : Math.sin(t * 0.55) * 0.2 + Math.sin(t * 1.7) * 0.05 + pointer.x * 0.3 * -s.facing;
    const pitch = walking ? Math.sin(s.phase * 2) * 0.05 : Math.sin(t * 0.8) * 0.05 + pointer.y * 0.12;
    u.uHeadYaw.value = damp(u.uHeadYaw.value, reduced ? 0 : yaw, 4, dt);
    u.uHeadPitch.value = damp(u.uHeadPitch.value, reduced ? 0 : pitch, 4, dt);
    head.current?.rotation.set(-u.uHeadPitch.value, u.uHeadYaw.value, 0, 'YXZ');

    if (t > s.blinkAt) {
      s.blinkT = t;
      s.blinkAt = t + 2.2 + Math.random() * 3.5;
    }
    const bp = (t - s.blinkT) / 0.16;
    u.uBlink.value = bp >= 0 && bp < 1 ? Math.sin(bp * Math.PI) : 0;

    // Change outfits with a quick pop.
    acc.current.forEach((id, g) => {
      const want = id === world ? 1 : 0;
      const v = damp(g.scale.x, want, 9, dt);
      g.scale.setScalar(v < 0.01 && !want ? 0.0001 : v);
      g.visible = v > 0.01;
    });

    if (rim.current) rim.current.color.lerp(tintColor.set(tint), 1 - Math.exp(-3 * dt));
  });

  return (
    <>
      <hemisphereLight args={['#fff4dc', '#1a2414', 1.1]} />
      <directionalLight position={[-300, 400, 600]} intensity={2.2} color="#fff1dc" />
      <directionalLight ref={rim} position={[400, 300, -500]} intensity={3.2} color={tint} />
      <group ref={root}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[1, 0.35, 1]}>
          <circleGeometry args={[0.5, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <group ref={turn}>
          <group position={offset.toArray()}>
            <primitive object={model} />
            <group ref={outfit('office')} scale={0.0001}>
              <BowTie />
            </group>
            {/* head accessories turn about the same neck pivot as the shader */}
            <group position={NECK.toArray()}>
              <group ref={head}>
                <group position={NECK.clone().negate().toArray()}>
                  <group ref={outfit('office')} scale={0.0001}>
                    <Glasses />
                  </group>
                  <group ref={outfit('cafe')} scale={0.0001}>
                    <Beanie />
                  </group>
                  <group ref={outfit('developer')} scale={0.0001}>
                    <Headphones />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

export default function KiviStage(props: KiviProps) {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      camera={{ zoom: 1, position: [0, 0, 1000], near: 1, far: 4000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Suspense fallback={null}>
        <Kivi {...props} />
      </Suspense>
    </Canvas>
  );
}
