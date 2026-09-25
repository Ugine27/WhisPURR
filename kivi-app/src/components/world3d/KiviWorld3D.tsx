import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, Sparkles } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, Code2, Coffee } from 'lucide-react';
import * as THREE from 'three';
import Kiwi3D, { Activity, Outfit, Pose } from './Kiwi3D';
import World, { PLAZA, roomToWorld } from './World';
import Foyer, { FOYER_DOOR_Z, FOYER_KIWI } from './foyer';
import { BuildingShell } from './buildings';
import { ROOMS } from './rooms';
import { dampAngle, ease } from './util';
import { AdaptToggle, useTypewriter } from '../styles/KiviWorld';

/*
 * The journey: Kivi greets you in its foyer, leads you through an arched door
 * into its world, guides you towards the buildings, and walks in first.
 *
 *   intro → lead (walk, look back, open the door, pass through) → world
 *   → enter (to a building's door) → room (outfit change, sit, speak)
 */
type Stage = 'intro' | 'lead' | 'world' | 'enter' | 'room';
type Leg = 'start' | 'beckon' | 'toDoor' | 'through';
type Phase = 'transform' | 'toSeat' | 'seated';

const INTRO_LINE = "Come, let's build our world together.";
const KIWI_SCALE = 0.62;
const ICONS = { office: Briefcase, cafe: Coffee, dev: Code2 };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

interface KiviWorld3DProps {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
}

// World-space versions of each room's key points, computed once.
const PLACES = ROOMS.map((room) => {
  const doorstep = roomToWorld(room, room.doorstep);
  return {
    room,
    doorstep,
    entry: roomToWorld(room, room.entry),
    door: roomToWorld(room, [room.entry[0], 0, 2.6]),
    guide: PLAZA.clone().lerp(doorstep, 0.38),
    approach: room.approach.map((p) => roomToWorld(room, p)),
    seat: roomToWorld(room, room.seat.position),
    seatYaw: room.rotation + room.seat.yaw,
    focus: roomToWorld(room, room.focus),
    cam: roomToWorld(room, room.camera.position),
    look: roomToWorld(room, room.camera.look),
    arrivalCam: roomToWorld(room, room.arrival.position),
    arrivalLook: roomToWorld(room, room.arrival.look),
    label: roomToWorld(room, [0, 4.9, 0]),
    side: new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation),
  };
});
type Place = (typeof PLACES)[number];

const LEAD = {
  start: V(0, 0, 19.3),
  door: V(0, 0, FOYER_DOOR_Z + 0.9),
  through: V(0, 0, FOYER_DOOR_Z - 4.5),
};

function Bubble({ text, id, y }: { text: string; id: string; y: number }) {
  return (
    <Html position={[0, y, 0.2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 10, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="relative whitespace-nowrap rounded-[22px] bg-[#fffaf0]/95 text-[#3e2723] shadow-[0_12px_40px_rgba(30,20,10,0.25)] px-5 py-3 text-lg md:text-xl font-semibold"
        >
          {text}
          <span className="absolute -bottom-1.5 left-1/2 -ml-1.5 w-3 h-3 bg-[#fffaf0] rotate-45 rounded-sm" />
        </motion.div>
      </AnimatePresence>
    </Html>
  );
}

interface ActorProps {
  posRef: React.MutableRefObject<THREE.Vector3>;
  route: { points: THREE.Vector3[]; key: number };
  speed: number;
  face: number;
  elevate: number;
  outfit: Outfit;
  pose: Pose;
  activity: Activity;
  lookAt: THREE.Vector3 | null;
  hopKey: number;
  bubble: string | null;
  bubbleId: string;
  onArrive: () => void;
}

function KiwiActor({ posRef, route, speed, face, elevate, outfit, pose, activity, lookAt, hopKey, bubble, bubbleId, onArrive }: ActorProps) {
  const group = useRef<THREE.Group>(null);
  const queue = useRef<THREE.Vector3[]>([]);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const [walking, setWalking] = useState(false);
  const born = useRef<number | null>(null);

  useEffect(() => {
    queue.current = route.points.map((p) => p.clone());
    setWalking(queue.current.length > 0);
  }, [route]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    // Entrance: Kivi springs up into view when the page opens.
    born.current ??= clock.elapsedTime;
    const e = Math.min((clock.elapsedTime - born.current) / 0.9, 1);
    const pop = e >= 1 ? 1 : 1 - Math.cos(e * Math.PI * 2.2) * Math.exp(-e * 5.5);
    g.scale.setScalar(KIWI_SCALE * Math.max(pop, 0.001));

    const p = posRef.current;
    let yaw = face;
    const target = queue.current[0];
    if (target) {
      const d = target.clone().sub(p).setY(0);
      const dist = d.length();
      // Cap the step so a slow frame never makes Kivi skip ahead.
      const step = speed * Math.min(dt, 1 / 30);
      if (dist > 0.001) yaw = Math.atan2(d.x, d.z);
      if (dist <= step) {
        p.copy(target).setY(0);
        queue.current.shift();
        if (!queue.current.length) {
          setWalking(false);
          arrive.current();
        }
      } else {
        p.addScaledVector(d.normalize(), step);
      }
    }
    g.position.set(p.x, THREE.MathUtils.damp(g.position.y, elevate, 7, dt), p.z);
    g.rotation.y = dampAngle(g.rotation.y, yaw, target ? 10 : 5, dt);
  });

  return (
    <group ref={group} scale={KIWI_SCALE}>
      <Kiwi3D outfit={outfit} walking={walking} pose={pose} activity={activity} lookAt={lookAt} hopKey={hopKey} />
      {bubble && <Bubble text={bubble} id={bubbleId} y={bubbleId === 'intro' ? 2.3 : 2.85} />}
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
        <room.Scene lit={lit} />
        <BuildingShell style={room.exterior} lit={lit} open={open} door={door} sideColor={room.sideColor} />
      </group>
      {showLabel && (
        <Html position={[0, 4.9, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full bg-[#fffaf0]/85 backdrop-blur text-[#3e2723] text-[11px] font-semibold tracking-[0.18em] shadow-[0_6px_20px_rgba(30,20,10,0.18)]"
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

// Eases the foyer door and the light around it.
function FoyerDriver({ open, pull, doorOpen, beckoning }: { open: React.MutableRefObject<number>; pull: React.MutableRefObject<number>; doorOpen: boolean; beckoning: boolean }) {
  useFrame((_, dt) => {
    open.current = THREE.MathUtils.damp(open.current, doorOpen ? 1 : 0, 1.6, dt);
    pull.current = THREE.MathUtils.damp(pull.current, beckoning ? 1 : 0, 2, dt);
  });
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
  const look = useRef(new THREE.Vector3(FOYER_KIWI[0], 0.8, FOYER_KIWI[2]));
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
    let fogNear = 34;
    let fogFar = 110;
    if (stage === 'intro') {
      pos.set(k.x + 0.55 + pointer.x * 0.1, 1.0 + pointer.y * 0.05, k.z + 2.3);
      tgt.set(k.x, 0.8, k.z);
      focus.set(k.x, 0.85, k.z);
      bokeh = 5;
      focusRange = 1.1;
      fogNear = 5;
      fogFar = 30;
    } else if (stage === 'lead') {
      // Follow just behind Kivi, through the doorway.
      pos.set(k.x + 0.45, 1.3, k.z + 2.7);
      tgt.set(k.x, 0.95, k.z - 2.5);
      focus.set(k.x, 0.8, k.z);
      speed = 2.2;
      bokeh = 3.5;
      focusRange = 1.8;
      const past = THREE.MathUtils.clamp((FOYER_DOOR_Z + 0.5 - k.z) / 3, 0, 1);
      fogNear = THREE.MathUtils.lerp(5, 34, past);
      fogFar = THREE.MathUtils.lerp(30, 110, past);
    } else if (stage === 'world') {
      pos.set(pointer.x * 1.4, 9 + pointer.y * 0.5, 22.5);
      tgt.set(0, 1.4, -1.6);
      focus.set(0, 1, -1.5);
      speed = 1.1;
      bokeh = 1.5;
      focusRange = 15;
    } else if (place && stage === 'enter') {
      pos.copy(place.arrivalCam).addScaledVector(place.side, pointer.x * 0.25);
      tgt.copy(place.arrivalLook);
      focus.set(k.x, 0.8, k.z);
      speed = 1.2;
      bokeh = 2.4;
      focusRange = 3;
    } else if (place) {
      pos.copy(place.cam).addScaledVector(place.side, pointer.x * 0.15);
      pos.y += pointer.y * 0.06;
      tgt.copy(place.look);
      focus.set(k.x, 0.8, k.z);
      speed = 1.3;
      bokeh = 3.2;
      focusRange = 2.2;
    }
    camera.position.lerp(pos, ease(speed, dt));
    look.current.lerp(tgt, ease(speed + 0.8, dt));
    camera.lookAt(look.current);
    camPos.copy(camera.position);

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = THREE.MathUtils.damp(scene.fog.near, fogNear, 1.5, dt);
      scene.fog.far = THREE.MathUtils.damp(scene.fog.far, fogFar, 1.5, dt);
    }

    // Gaze target in front of Kivi that follows the cursor during the intro.
    mouseLook.set(k.x + pointer.x * 2.2, 0.9 + pointer.y * 1.2, k.z + 2.5);

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

// People who ask for reduced motion start in the world, skipping the entrance.
const prefersReducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
})();

export default function KiviWorld3D({ activeStyleName, onSelectActiveStyle, isAdaptiveMode = true, onToggleAdaptive }: KiviWorld3DProps) {
  const [stage, setStage] = useState<Stage>(prefersReducedMotion ? 'world' : 'intro');
  const [leg, setLeg] = useState<Leg>('start');
  const [phase, setPhase] = useState<Phase>('transform');
  const [place, setPlace] = useState<Place | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ id: string; arrived: boolean } | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const [talk, setTalk] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [route, setRoute] = useState<{ points: THREE.Vector3[]; key: number }>({ points: [], key: 0 });
  const kiwiPos = useRef(prefersReducedMotion ? PLAZA.clone() : new THREE.Vector3(...FOYER_KIWI));
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const mouseLook = useMemo(() => new THREE.Vector3(), []);
  const foyerOpen = useRef(0);
  const foyerPull = useRef(0);
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

  const walk = (points: THREE.Vector3[]) => setRoute((r) => ({ points, key: r.key + 1 }));

  const startLead = () => {
    if (stage !== 'intro') return;
    setStage('lead');
    setLeg('start');
    walk([LEAD.start]);
  };

  // Once Kivi has said its line, it sets off towards the door.
  useEffect(() => {
    if (stage !== 'intro' || !introDone) return;
    const t = setTimeout(startLead, 1800);
    return () => clearTimeout(t);
    // startLead only reads `stage`, which is a dependency.
  }, [stage, introDone]);

  const hover = (id: string | null) => {
    setHovered(id);
    if (!id || stage !== 'world') return;
    setHopKey((k) => k + 1);
    // Kivi walks a little way towards the hub, then turns back to invite you.
    if (guide?.id !== id) {
      const p = PLACES.find((pl) => pl.room.id === id)!;
      setGuide({ id, arrived: false });
      walk([p.guide]);
    }
  };

  const beginRoom = (next: Place) => {
    clearTimers();
    setTalk(false);
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
    walk([next.doorstep, next.entry]);
  };

  const arrived = () => {
    if (stage === 'lead') {
      if (leg === 'start') {
        setLeg('beckon');
        later(() => {
          setLeg('toDoor');
          walk([LEAD.door]);
        }, 1800);
      } else if (leg === 'toDoor') {
        setDoorOpen(true);
        later(() => {
          setLeg('through');
          walk([LEAD.through]);
        }, 1700);
      } else if (leg === 'through') {
        setStage('world');
        walk([PLAZA]);
      }
    } else if (stage === 'world' && guide && !guide.arrived) {
      setGuide({ ...guide, arrived: true });
    } else if (stage === 'enter' && place) {
      beginRoom(place);
    } else if (stage === 'room' && phase === 'toSeat') {
      setPhase('seated');
      later(() => setTalk(true), 700);
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
    setTalk(false);
    setGuide(null);
    setStage('world');
    const back = [...place.approach].reverse().slice(1);
    walk([...back, place.entry, place.doorstep, PLAZA]);
  };

  const inRoom = stage === 'room';
  const seated = inRoom && phase === 'seated';
  const beckonInFoyer = stage === 'lead' && leg === 'beckon';
  const beckonInWorld = stage === 'world' && !!guide?.arrived && hovered === guide.id;
  const outfit: Outfit = inRoom && place ? place.room.outfit : 'none';
  const guidePlace = guide ? PLACES.find((p) => p.room.id === guide.id) ?? null : null;
  const hoveredPlace = PLACES.find((p) => p.room.id === hovered) ?? null;

  let face = 0;
  if (seated && place) face = place.seatYaw;
  else if (inRoom && place) face = place.room.rotation;
  else if (beckonInWorld) face = Math.atan2(camPos.x - kiwiPos.current.x, camPos.z - kiwiPos.current.z);

  let lookAt: THREE.Vector3 | null = null;
  if (stage === 'intro') lookAt = mouseLook;
  else if (beckonInFoyer || beckonInWorld) lookAt = camPos;
  else if (stage === 'world' && hoveredPlace) lookAt = hoveredPlace.label;
  else if (seated && place) lookAt = place.focus;

  const activity: Activity = beckonInFoyer || beckonInWorld ? 'beckon' : seated && place ? place.room.activity : 'none';
  const bubble = stage === 'intro' ? introText || null : seated && talk && place ? place.room.line : null;
  const speed = stage === 'lead' ? 1.9 : stage === 'room' ? 2.2 : 3;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden select-none bg-[#2a1f18]" onClick={() => stage === 'intro' && introDone && startLead()}>
      <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: false }} camera={{ fov: 40, position: [0.8, 1.2, 23.4], near: 0.05, far: 600 }}>
        <color attach="background" args={['#f3e6d4']} />
        <fog attach="fog" args={['#f3e7d6', 5, 30]} />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 6, 8]} scale={[14, 5, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe2c6" position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#dcebdc" position={[10, 3, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="ring" intensity={1.5} color="#fff6e8" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={6} />
        </Environment>
        <hemisphereLight args={['#fff1e0', '#b7c79a', 0.4]} />
        <directionalLight
          position={[-9, 15, 11]}
          intensity={2.2}
          color="#fff0dc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={26}
          shadow-camera-bottom={-18}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <World />
        <Foyer visible={stage === 'intro' || stage === 'lead'} open={foyerOpen} pull={foyerPull} />
        <FoyerDriver open={foyerOpen} pull={foyerPull} doorOpen={doorOpen} beckoning={beckonInFoyer} />
        <Sparkles count={70} scale={[36, 9, 26]} position={[0, 4, -1]} size={3} speed={0.2} opacity={0.55} color="#fff6dc" />
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
          elevate={seated && place ? place.seat.y : 0}
          outfit={outfit}
          pose={seated ? 'sit' : 'stand'}
          activity={activity}
          lookAt={lookAt}
          hopKey={hopKey}
          bubble={bubble}
          bubbleId={stage === 'intro' ? 'intro' : place?.room.id ?? ''}
          onArrive={arrived}
        />
        <Precompile />
        <Director stage={stage} place={place} kiwiPos={kiwiPos} camPos={camPos} mouseLook={mouseLook} dof={dof} />
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.8} intensity={2.2} distanceFalloff={0.6} halfRes />
          <DepthOfField ref={dof} target={[0, 1, 20]} focalLength={0.02} bokehScale={5} />
          <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.5} mipmapBlur />
          <Vignette offset={0.28} darkness={0.45} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      <AnimatePresence>
        {seated && place && (
          <motion.div
            key={`chip-${place.room.id}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: 0.3 }}
            className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fffaf0]/85 backdrop-blur-md text-[#3e2723] text-sm font-semibold shadow-[0_6px_24px_rgba(30,20,10,0.18)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#62823a]" />
            {place.room.chip}
          </motion.div>
        )}

        {inRoom && place && (
          <motion.div key="room-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
            <button
              type="button"
              aria-label="Back to the world"
              onClick={leave}
              className="pointer-events-auto absolute top-4 left-4 w-11 h-11 rounded-full bg-[#fffaf0]/85 backdrop-blur-md text-[#5d4037] shadow-md flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1 p-1 rounded-full bg-[#fffaf0]/80 backdrop-blur-md shadow-[0_8px_30px_rgba(30,20,10,0.18)]">
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
                      current ? 'bg-[#5d4037] text-[#fffaf0]' : 'text-[#5d4037] hover:bg-[#5d4037]/10'
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
