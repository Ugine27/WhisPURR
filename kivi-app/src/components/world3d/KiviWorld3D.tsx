import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, Sparkles } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, Code2, Coffee } from 'lucide-react';
import * as THREE from 'three';
import Kiwi3D, { Activity, Outfit, Pose } from './Kiwi3D';
import Forest, { BRANCH_PERCH, FLIGHT, STONE, STONE_TOP, roomToWorld } from './forest';
import { ROOMS } from './hubs';
import HubPanel from './HubPanel';
import { dampAngle, ease } from './util';
import { AdaptToggle, useTypewriter } from '../styles/KiviWorld';

/*
 * The journey: Kivi perches on a mossy branch and invites you in, dives down
 * through the trees, lands on the glowing stone, guides you towards the hubs,
 * and walks in first.
 *
 *   intro (branch) → fly → world → enter (to a hub's door) → room
 */
type Stage = 'intro' | 'fly' | 'world' | 'enter' | 'room';
type Phase = 'transform' | 'toSeat' | 'seated';

const INTRO_LINE = 'Come, let us build our world together.';
const KIWI_SCALE = 0.62;
const ICONS = { office: Briefcase, cafe: Coffee, dev: Code2 };

interface KiviWorld3DProps {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
}

// A winding walk from the stone to each hub's door, and the hub's key points.
const PLACES = ROOMS.map((room, i) => {
  const doorstep = roomToWorld(room, room.doorstep);
  const from = STONE.clone().setY(0);
  const side = new THREE.Vector3(-(doorstep.z - from.z), 0, doorstep.x - from.x).normalize();
  const bend = [0.9, -0.8, 0.7][i] ?? 0.6;
  const path = new THREE.CatmullRomCurve3([
    from,
    from.clone().lerp(doorstep, 0.25).addScaledVector(side, -bend * 0.5),
    from.clone().lerp(doorstep, 0.5).addScaledVector(side, bend),
    doorstep,
  ]);
  return {
    room,
    doorstep,
    walk: path.getSpacedPoints(14).slice(1),
    guide: path.getPointAt(0.35),
    entry: roomToWorld(room, room.entry),
    door: roomToWorld(room, [room.entry[0], 0, (room.doorstep[2] + room.entry[2]) / 2]),
    approach: room.approach.map((p) => roomToWorld(room, p)),
    seat: roomToWorld(room, room.seat.position),
    seatYaw: room.rotation + room.seat.yaw,
    focus: roomToWorld(room, room.focus),
    cam: roomToWorld(room, room.camera.position),
    look: roomToWorld(room, room.camera.look),
    arrivalCam: roomToWorld(room, room.arrival.position),
    arrivalLook: roomToWorld(room, room.arrival.look),
    label: roomToWorld(room, [0, room.labelY, 0]),
    side: new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation),
  };
});
type Place = (typeof PLACES)[number];

const FLIGHT_POINTS = FLIGHT.getSpacedPoints(80).slice(1);

function Bubble({ text }: { text: string }) {
  return (
    <Html position={[0, 2.35, 0.2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="relative w-[15rem] text-center rounded-[28px] bg-[#f3f1e4]/95 text-[#2c3a24] border border-[#dfe4cf] shadow-[0_12px_40px_rgba(20,30,15,0.25)] px-6 py-4 text-2xl leading-tight italic"
      >
        {text}
        <span className="absolute -bottom-2 left-8 w-4 h-4 bg-[#f3f1e4] border-r border-b border-[#dfe4cf] rotate-45 rounded-sm" />
      </motion.div>
    </Html>
  );
}

interface ActorProps {
  posRef: React.MutableRefObject<THREE.Vector3>;
  route: { points: THREE.Vector3[]; key: number; fly?: boolean };
  speed: number;
  face: number;
  free: boolean; // follow posRef's height exactly (perched or flying)
  seatY: number | null;
  outfit: Outfit;
  pose: Pose;
  activity: Activity;
  lookAt: THREE.Vector3 | null;
  hopKey: number;
  bubble: string | null;
  onArrive: () => void;
}

function KiwiActor({ posRef, route, speed, face, free, seatY, outfit, pose, activity, lookAt, hopKey, bubble, onArrive }: ActorProps) {
  const group = useRef<THREE.Group>(null);
  const queue = useRef<THREE.Vector3[]>([]);
  const flying = useRef(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const [walking, setWalking] = useState(false);
  const born = useRef<number | null>(null);

  useEffect(() => {
    queue.current = route.points.map((p) => p.clone());
    flying.current = !!route.fly;
    setWalking(queue.current.length > 0 && !route.fly);
  }, [route]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    // Entrance: Kivi springs into view when the page opens.
    born.current ??= clock.elapsedTime;
    const e = Math.min((clock.elapsedTime - born.current) / 0.9, 1);
    const pop = e >= 1 ? 1 : 1 - Math.cos(e * Math.PI * 2.2) * Math.exp(-e * 5.5);
    g.scale.setScalar(KIWI_SCALE * Math.max(pop, 0.001));

    const p = posRef.current;
    let yaw = face;
    const target = queue.current[0];
    if (target) {
      const d = target.clone().sub(p);
      if (!flying.current) d.setY(0);
      const dist = d.length();
      // Cap the step so a slow frame never makes Kivi skip ahead.
      const step = speed * Math.min(dt, 1 / 30);
      if (Math.hypot(d.x, d.z) > 0.001) yaw = Math.atan2(d.x, d.z);
      if (dist <= step) {
        p.copy(target);
        if (!flying.current) p.y = 0;
        queue.current.shift();
        if (!queue.current.length) {
          setWalking(false);
          flying.current = false;
          arrive.current();
        }
      } else {
        p.addScaledVector(d.normalize(), step);
      }
    }
    // On the ground Kivi steps up onto the stone and into seats smoothly.
    const onStone = Math.hypot(p.x - STONE.x, p.z - STONE.z) < 1.05;
    const groundY = seatY ?? (onStone ? STONE_TOP : 0);
    const y = free || flying.current ? p.y : THREE.MathUtils.damp(g.position.y, groundY, 9, dt);
    g.position.set(p.x, y, p.z);
    g.rotation.y = dampAngle(g.rotation.y, yaw, target ? 10 : 5, dt);
  });

  return (
    <group ref={group} scale={KIWI_SCALE}>
      <Kiwi3D outfit={outfit} walking={walking} pose={pose} activity={activity} lookAt={lookAt} hopKey={hopKey} />
      {bubble && <Bubble text={bubble} />}
    </group>
  );
}

function Hub({
  place,
  interactive,
  highlighted,
  inside,
  active,
  showLabel,
  kiwiPos,
  onHover,
  onPick,
}: {
  place: Place;
  interactive: boolean;
  highlighted: boolean;
  inside: boolean;
  active: boolean;
  showLabel: boolean;
  kiwiPos: React.MutableRefObject<THREE.Vector3>;
  onHover: (id: string | null) => void;
  onPick: (p: Place) => void;
}) {
  const { room } = place;
  const lit = useRef(0);
  const open = useRef(0);
  const door = useRef(0);
  useFrame((_, dt) => {
    lit.current = THREE.MathUtils.damp(lit.current, highlighted ? 1 : 0, 4, dt);
    open.current = THREE.MathUtils.damp(open.current, inside ? 1 : 0, 2.2, dt);
    // The door opens for Kivi whenever it comes near.
    const near = kiwiPos.current.distanceTo(place.door) < 1.9;
    door.current = THREE.MathUtils.damp(door.current, near ? 1 : 0, 3.5, dt);
  });
  return (
    <group position={room.position} rotation={[0, room.rotation, 0]}>
      <group
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onHover(room.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          document.body.style.cursor = '';
          onPick(place);
        }}
      >
        <room.Scene lit={lit} open={open} door={door} />
      </group>
      {showLabel && (
        <Html position={[0, room.labelY, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full bg-[#f3f1e4]/85 backdrop-blur text-[#2c3a24] text-[11px] font-semibold tracking-[0.18em] shadow-[0_6px_20px_rgba(20,30,15,0.2)]"
          >
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[#62823a]" />}
            {room.label.toUpperCase()}
          </motion.div>
        </Html>
      )}
    </group>
  );
}

// Prepares every material in the background during the intro, so the world
// doesn't stutter the first time it comes into view.
function Precompile() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);
  return null;
}

// Moves the camera, depth of field and fog, and tracks where the viewer is.
function Director({
  stage,
  place,
  kiwiPos,
  camPos,
  mouseLook,
  dof,
}: {
  stage: Stage;
  place: Place | null;
  kiwiPos: React.MutableRefObject<THREE.Vector3>;
  camPos: THREE.Vector3;
  mouseLook: THREE.Vector3;
  dof: React.RefObject<DepthOfFieldEffect>;
}) {
  const look = useRef(BRANCH_PERCH.clone().add(new THREE.Vector3(0, 0.8, 0)));
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const blur = useRef(5);
  const range = useRef(1.2);

  useFrame(({ camera, pointer, scene }, dt) => {
    const k = kiwiPos.current;
    let speed = 1.6;
    let bokeh = 3;
    let focusRange = 2.4;
    let fov = 40;
    let fogNear = 22;
    let fogFar = 80;
    if (stage === 'intro') {
      pos.set(k.x + 0.85 + pointer.x * 0.1, k.y + 0.9 + pointer.y * 0.05, k.z + 2.5);
      tgt.set(k.x - 0.1, k.y + 0.78, k.z);
      focus.set(k.x, k.y + 0.8, k.z);
      bokeh = 5.5;
      focusRange = 1.2;
    } else if (stage === 'fly') {
      // Chase Kivi down through the canopy.
      pos.set(k.x + 0.35, k.y + 0.95, k.z + 3.0);
      tgt.set(k.x, k.y + 0.1, k.z - 3);
      focus.set(k.x, k.y + 0.6, k.z);
      speed = 3.2;
      bokeh = 3;
      focusRange = 2;
    } else if (stage === 'world') {
      pos.set(pointer.x * 1.2, 12.5 + pointer.y * 0.4, 11.5);
      tgt.set(0, 0.3, -2.8);
      focus.set(0, 1, -1.5);
      speed = 1.1;
      bokeh = 1.4;
      focusRange = 14;
      fov = 55;
      fogNear = 28;
      fogFar = 95;
    } else if (place && stage === 'enter') {
      pos.copy(place.arrivalCam).addScaledVector(place.side, pointer.x * 0.25);
      tgt.copy(place.arrivalLook);
      focus.set(k.x, 0.8, k.z);
      speed = 1.2;
      bokeh = 2.4;
      focusRange = 3;
    } else if (place) {
      pos.copy(place.cam).addScaledVector(place.side, pointer.x * 0.12);
      pos.y += pointer.y * 0.05;
      tgt.copy(place.look);
      focus.set(k.x, 0.9, k.z);
      speed = 1.3;
      bokeh = 3;
      focusRange = 2.4;
    }
    camera.position.lerp(pos, ease(speed, dt));
    look.current.lerp(tgt, ease(speed + 0.8, dt));
    camera.lookAt(look.current);
    camPos.copy(camera.position);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.damp(cam.fov, fov, 1.5, dt);
      cam.updateProjectionMatrix();
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = THREE.MathUtils.damp(scene.fog.near, fogNear, 1.5, dt);
      scene.fog.far = THREE.MathUtils.damp(scene.fog.far, fogFar, 1.5, dt);
    }

    // Gaze target in front of Kivi that follows the cursor during the intro.
    mouseLook.set(k.x + pointer.x * 2.2, k.y + 0.9 + pointer.y * 1.2, k.z + 2.5);

    blur.current = THREE.MathUtils.damp(blur.current, bokeh, 2, dt);
    range.current = THREE.MathUtils.damp(range.current, focusRange, 2, dt);
    const effect = dof.current;
    if (effect) {
      effect.target?.copy(focus);
      effect.bokehScale = blur.current;
      effect.cocMaterial.focusRange = range.current;
    }
  });
  return null;
}

// Brightens the stone's marks when Kivi lands, then lets them settle.
function StoneDriver({ glow, landedAt }: { glow: React.MutableRefObject<number>; landedAt: number | null }) {
  useFrame(({ clock }, dt) => {
    const since = landedAt === null ? Infinity : clock.elapsedTime - landedAt;
    glow.current = THREE.MathUtils.damp(glow.current, since < 1.2 ? 1 : 0, since < 1.2 ? 8 : 1.2, dt);
  });
  return null;
}

// People who ask for reduced motion start in the world, skipping the intro.
const prefersReducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
})();

export default function KiviWorld3D({ activeStyleName, onSelectActiveStyle, isAdaptiveMode = true, onToggleAdaptive }: KiviWorld3DProps) {
  const [stage, setStage] = useState<Stage>(prefersReducedMotion ? 'world' : 'intro');
  const [phase, setPhase] = useState<Phase>('transform');
  const [place, setPlace] = useState<Place | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ id: string; arrived: boolean } | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const [landedAt, setLandedAt] = useState<number | null>(null);
  const [route, setRoute] = useState<{ points: THREE.Vector3[]; key: number; fly?: boolean }>({ points: [], key: 0 });
  const kiwiPos = useRef(prefersReducedMotion ? STONE.clone() : BRANCH_PERCH.clone());
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const mouseLook = useMemo(() => new THREE.Vector3(), []);
  const stoneGlow = useRef(0);
  const clockRef = useRef(0);
  const dof = useRef<DepthOfFieldEffect>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIntroReady(true), 1100);
    return () => clearTimeout(t);
  }, []);
  const introText = useTypewriter(INTRO_LINE, stage === 'intro' && introReady, 45);
  const introDone = introText.length === INTRO_LINE.length;

  useEffect(
    () => () => {
      clearTimers();
      document.body.style.cursor = '';
    },
    [],
  );

  const walk = (points: THREE.Vector3[], fly = false) => setRoute((r) => ({ points, key: r.key + 1, fly }));

  const takeOff = () => {
    if (stage !== 'intro') return;
    setStage('fly');
    walk(FLIGHT_POINTS, true);
  };

  // Once Kivi has spoken, it takes flight.
  useEffect(() => {
    if (stage !== 'intro' || !introDone) return;
    const t = setTimeout(takeOff, 1900);
    return () => clearTimeout(t);
    // takeOff only reads `stage`, which is a dependency.
  }, [stage, introDone]);

  const hover = (id: string | null) => {
    setHovered(id);
    if (!id || stage !== 'world') return;
    setHopKey((k) => k + 1);
    // Kivi walks a little way along the path, then turns back to invite you.
    if (guide?.id !== id) {
      const p = PLACES.find((pl) => pl.room.id === id)!;
      setGuide({ id, arrived: false });
      const walked = p.walk.filter((pt) => pt.distanceTo(STONE) <= p.guide.distanceTo(STONE) + 0.01);
      walk(kiwiPos.current.distanceTo(STONE) < 1.2 ? walked : [STONE.clone().setY(0), ...walked]);
    }
  };

  const beginRoom = (next: Place) => {
    clearTimers();
    setPlace(next);
    setStage('room');
    setPhase('transform');
    onSelectActiveStyle(next.room.persona);
    later(() => {
      setPhase('toSeat');
      walk(next.approach);
    }, 1300);
  };

  const pick = (next: Place) => {
    if (stage !== 'world') return;
    clearTimers();
    setHovered(null);
    setGuide(null);
    setPlace(next);
    setStage('enter');
    const rest = next.walk.filter((pt) => pt.distanceTo(STONE) > kiwiPos.current.distanceTo(STONE) - 0.2);
    walk([...rest, next.entry]);
  };

  const arrived = () => {
    if (stage === 'fly') {
      setStage('world');
      setLandedAt(clockRef.current);
      setHopKey((k) => k + 1);
    } else if (stage === 'world' && guide && !guide.arrived) {
      setGuide({ ...guide, arrived: true });
    } else if (stage === 'enter' && place) {
      beginRoom(place);
    } else if (stage === 'room' && phase === 'toSeat') {
      setPhase('seated');
    }
  };

  const jump = (next: Place) => {
    if (next.room.id === place?.room.id) return;
    kiwiPos.current.copy(next.entry);
    walk([]);
    beginRoom(next);
  };

  const leave = () => {
    if (!place) return;
    clearTimers();
    setGuide(null);
    setStage('world');
    const back = [...place.approach].reverse().slice(1);
    walk([...back, place.entry, ...[...place.walk].reverse(), STONE.clone().setY(0)]);
  };

  const inRoom = stage === 'room';
  const seated = inRoom && phase === 'seated';
  const beckoning = stage === 'world' && !!guide?.arrived && hovered === guide.id;
  const outfit: Outfit = inRoom && place ? place.room.outfit : 'none';
  const guidePlace = guide ? PLACES.find((p) => p.room.id === guide.id) ?? null : null;
  const hoveredPlace = PLACES.find((p) => p.room.id === hovered) ?? null;

  let face = 0;
  if (seated && place) face = place.seatYaw;
  else if (inRoom && place) face = place.room.rotation;
  else if (beckoning) face = Math.atan2(camPos.x - kiwiPos.current.x, camPos.z - kiwiPos.current.z);

  let lookAt: THREE.Vector3 | null = null;
  if (stage === 'intro') lookAt = mouseLook;
  else if (beckoning) lookAt = camPos;
  else if (stage === 'world' && hoveredPlace) lookAt = hoveredPlace.label;
  else if (seated && place) lookAt = place.focus;

  const activity: Activity = stage === 'fly' ? 'fly' : beckoning ? 'beckon' : seated && place ? place.room.activity : 'none';
  const pose: Pose = seated && place ? place.room.pose : 'stand';
  const seatY = seated && place && place.room.pose === 'sit' ? place.seat.y : null;
  const speed = stage === 'fly' ? 6.5 : stage === 'room' ? 2.2 : 3;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden select-none bg-[#1d2418]" onClick={() => stage === 'intro' && introDone && takeOff()}>
      <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: false }} camera={{ fov: 40, position: [BRANCH_PERCH.x + 1.2, BRANCH_PERCH.y + 1.2, BRANCH_PERCH.z + 5], near: 0.05, far: 600 }}>
        <color attach="background" args={['#dfe6d4']} />
        <fog attach="fog" args={['#dfe6d2', 22, 80]} />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2} color="#fff6e2" position={[-6, 10, 6]} scale={[14, 6, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#dfeccf" position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#d8e6d4" position={[10, 3, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="ring" intensity={1.4} color="#fffbe8" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={6} />
        </Environment>
        <hemisphereLight args={['#f6f7e8', '#7d9658', 1.1]} />
        <ambientLight intensity={0.25} color="#fff8e8" />
        <directionalLight
          position={[-10, 18, 8]}
          intensity={3}
          color="#fff1d6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={30}
          shadow-camera-bottom={-18}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <Forest showBranch={stage === 'intro' || stage === 'fly'} stoneGlow={stoneGlow} />
        <StoneDriver glow={stoneGlow} landedAt={landedAt} />
        <ClockTap clockRef={clockRef} />
        <Sparkles count={90} scale={[36, 10, 36]} position={[0, 4, 4]} size={3} speed={0.2} opacity={0.6} color="#f6f2d0" />
        {PLACES.map((p) => (
          <Hub
            key={p.room.id}
            place={p}
            interactive={stage === 'world'}
            highlighted={hovered === p.room.id || (inRoom && place?.room.id === p.room.id)}
            inside={inRoom && place?.room.id === p.room.id}
            active={activeStyleName === p.room.persona}
            showLabel={stage === 'world' && (hovered === p.room.id || guidePlace?.room.id === p.room.id)}
            kiwiPos={kiwiPos}
            onHover={hover}
            onPick={pick}
          />
        ))}
        <KiwiActor
          posRef={kiwiPos}
          route={route}
          speed={speed}
          face={face}
          free={stage === 'intro'}
          seatY={seatY}
          outfit={outfit}
          pose={pose}
          activity={activity}
          lookAt={lookAt}
          hopKey={hopKey}
          bubble={stage === 'intro' ? introText || null : null}
          onArrive={arrived}
        />
        <Precompile />
        <Director stage={stage} place={place} kiwiPos={kiwiPos} camPos={camPos} mouseLook={mouseLook} dof={dof} />
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.8} intensity={2.2} distanceFalloff={0.6} halfRes />
          <DepthOfField ref={dof} target={[BRANCH_PERCH.x, BRANCH_PERCH.y + 0.8, BRANCH_PERCH.z]} focalLength={0.02} bokehScale={5} />
          <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.5} mipmapBlur />
          <Vignette offset={0.28} darkness={0.45} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      <AnimatePresence>{seated && place && <HubPanel key={place.room.id} persona={place.room.persona} />}</AnimatePresence>

      <AnimatePresence>
        {inRoom && place && (
          <motion.div key="room-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
            <button
              type="button"
              aria-label="Back to the forest"
              onClick={leave}
              className="pointer-events-auto absolute top-4 left-4 w-11 h-11 rounded-full bg-[#f3f1e4]/85 backdrop-blur-md text-[#2c3a24] shadow-md flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1 p-1 rounded-full bg-[#f3f1e4]/80 backdrop-blur-md shadow-[0_8px_30px_rgba(20,30,15,0.2)]">
              {PLACES.map((p) => {
                const Icon = ICONS[p.room.icon];
                const current = p.room.id === place.room.id;
                return (
                  <button
                    key={p.room.id}
                    type="button"
                    aria-label={p.room.label}
                    title={p.room.label}
                    onClick={() => jump(p)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      current ? 'bg-[#2c3a24] text-[#f3f1e4]' : 'text-[#2c3a24] hover:bg-[#2c3a24]/10'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(stage === 'world' || stage === 'enter' || stage === 'room') && (
        <div className="absolute top-4 right-4">
          <AdaptToggle on={isAdaptiveMode} onToggle={onToggleAdaptive} />
        </div>
      )}
    </div>
  );
}

// Exposes the render clock to event handlers (for timing the landing glow).
function ClockTap({ clockRef }: { clockRef: React.MutableRefObject<number> }) {
  useFrame(({ clock }) => {
    clockRef.current = clock.elapsedTime;
  });
  return null;
}
