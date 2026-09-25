import { useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/*
 * CC0 assets from Poly Haven (polyhaven.com), stored in public/kivi-world:
 * scanned models (meshopt + WebP GLB), PBR texture sets (colour, OpenGL
 * normal, packed AO/roughness/metal) and the mossy_forest HDRI.
 */

const ROOT = '/kivi-world';
export const HDRI = `${ROOT}/mossy_forest_2k.hdr`;

export const MODELS = [
  'fern_02',
  'moss_01',
  'shrub_02',
  'shrub_04',
  'rock_moss_set_01',
  'rock_moss_set_02',
  'rock_face_01',
  'tree_stump_01',
  'desk_lamp_arm_01',
  'classic_laptop',
  'dining_table',
  'dining_chair_02',
  'potted_plant_02',
  'potted_plant_04',
  'ArmChair_01',
  'Sofa_01',
  'coffee_table_round_01',
  'round_wooden_table_01',
  'CoffeeCart_01',
  'caged_hanging_light',
  'circuit_board',
  'tool_cart',
  'metal_stool_01',
  'retro_multimeter',
  'rubber_duck_toy',
  'hanging_industrial_lamp',
] as const;
export type ModelName = (typeof MODELS)[number];

export const modelUrl = (name: ModelName) => `${ROOT}/models/${name}.glb`;

export type PBRName =
  | 'forest_ground_04'
  | 'forrest_ground_01'
  | 'pebble_ground_01'
  | 'mossy_rock'
  | 'bark_brown_02'
  | 'dark_wood'
  | 'old_mosaic_floor'
  | 'metal_plate'
  | 'clay_plaster'
  | 'brown_mud_leaves_01';

const PBR_NAMES: PBRName[] = [
  'forest_ground_04',
  'forrest_ground_01',
  'pebble_ground_01',
  'mossy_rock',
  'bark_brown_02',
  'dark_wood',
  'old_mosaic_floor',
  'metal_plate',
  'clay_plaster',
  'brown_mud_leaves_01',
];

const pbrUrls = (name: PBRName) => [`${ROOT}/textures/${name}_diff.webp`, `${ROOT}/textures/${name}_nor.webp`, `${ROOT}/textures/${name}_arm.webp`];

// Start fetching everything as soon as the 3D module loads.
export function preloadWorld() {
  MODELS.forEach((m) => useGLTF.preload(modelUrl(m)));
  PBR_NAMES.forEach((n) => useTexture.preload(pbrUrls(n)));
}

export interface PBRSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  aoMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
}

/** A PBR texture set, tiled `repeat` times. Each call gets its own copies. */
export function usePBR(name: PBRName, repeat: [number, number] = [1, 1]): PBRSet {
  const [diff, nor, arm] = useTexture(pbrUrls(name));
  return useMemo(() => {
    const setup = (t: THREE.Texture, srgb: boolean) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(...repeat);
      c.anisotropy = 8;
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      c.needsUpdate = true;
      return c;
    };
    const a = setup(arm, false);
    return { map: setup(diff, true), normalMap: setup(nor, false), aoMap: a, roughnessMap: a, metalnessMap: a };
    // repeat is a literal tuple at every call site
  }, [diff, nor, arm, repeat[0], repeat[1]]);
}

/** A scanned model, cloned so it can be placed many times, with shadows on. */
export function Model({
  name,
  position,
  rotation,
  scale = 1,
  tint,
}: {
  name: ModelName;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  tint?: string;
}) {
  const { scene } = useGLTF(modelUrl(name));
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (tint) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color(tint);
        m.material = mat;
      }
    });
    return c;
  }, [scene, tint]);
  return <primitive object={obj} position={position} rotation={rotation} scale={scale} />;
}

/** The first mesh inside a model, for instancing (moss, ferns, shrubs). */
export function useModelMesh(name: ModelName) {
  const { scene } = useGLTF(modelUrl(name));
  return useMemo(() => {
    let found: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    const mesh = found as unknown as THREE.Mesh;
    mesh.updateWorldMatrix(true, false);
    // Bake the node transform so instances can use the raw geometry.
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    return { geometry, material: mesh.material as THREE.Material };
  }, [scene]);
}
