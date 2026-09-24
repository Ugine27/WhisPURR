import * as THREE from 'three';

// Small deterministic PRNG so the scenery is identical on every visit.
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const ease = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const diff = ((((target - current + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return current + diff * ease(lambda, dt);
}

export const smooth = (t: number) => t * t * (3 - 2 * t);

export type V3 = [number, number, number];
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
