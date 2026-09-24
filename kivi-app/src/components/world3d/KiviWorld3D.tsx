import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html, Lightformer, Sparkles } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, Code2, Coffee } from 'lucide-react';
import * as THREE from 'three';
import Kiwi3D, { Activity, Outfit, Pose } from './Kiwi3D';
import World, { PLAZA, roomToWorld } from './World';
import { ROOMS } from './rooms';
import { dampAngle, ease } from './util';
import { AdaptToggle, useTypewriter } from '../styles/KiviWorld';

type Stage = 'intro' | 'world' | 'enter' | 'room';
type Phase = 'transform' | 'toSeat' | 'seated';

const INTRO_LINE = "Come, let's build our world together.";
const KIWI_SCALE = 0.62;
const WALK_SPEED = 2.6;
const ICONS = { office: Briefcase, cafe: Coffee, dev: Code2 };

interface KiviWorld3DProps {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
}

// World-space versions of each room's key points, computed once.
const PLACES = ROOMS.map((room) => ({
  room,
  entry: roomToWorld(room, room.entry),
  approach: room.approach.map((p) => roomToWorld(room, p)),
  seat: roomToWorld(room, room.seat.position),
  seatYaw: room.rotation + room.seat.yaw,
  focus: roomToWorld(room, room.focus),
  cam: roomToWorld(room, room.camera.position),
  look: roomToWorld(room, room.camera.look),
  label: roomToWorld(room, [0, 3.7, 0]),
  side: new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), room.rotation),
}));
type Place = (typeof PLACES)[number];

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
          className="relative whitespace-nowrap rounded-[22px] bg-[#fffaf0]/95 text-[#3e2723] shadow-[0_12px_40px_rgba(62,39,35,0.18)] px-5 py-3 text-lg md:text-xl font-semibold"
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

function KiwiActor({ posRef, route, face, elevate, outfit, pose, activity, lookAt, hopKey, bubble, bubbleId, onArrive }: ActorProps) {
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
    // Entrance: Kivi springs up into view the first time the world opens.
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
      const step = WALK_SPEED * dt;
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

function RoomSpot({
  place,
  interactive,
  highlighted,
  active,
  showLabel,
  onHover,
  onPick,
}: {
  place: Place;
  interactive: boolean;
  highlighted: boolean;
  active: boolean;
  showLabel: boolean;
  onHover: (id: string | null) => void;
  onPick: (p: Place) => void;
}) {
  const { room } = place;
  const lit = useRef(0);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    lit.current = THREE.MathUtils.damp(lit.current, highlighted ? 1 : 0, 4, dt);
    if (group.current) group.current.position.y = THREE.MathUtils.damp(group.current.position.y, highlighted && interactive ? 0.08 : 0, 6, dt);
  });
  return (
    <group position={room.position} rotation={[0, room.rotation, 0]}>
      <group
        ref={group}
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
      </group>
      {showLabel && (
        <Html position={[0, 3.7, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full bg-[#fffaf0]/90 backdrop-blur text-[#3e2723] text-sm font-semibold shadow-[0_6px_20px_rgba(62,39,35,0.15)]"
          >
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[#8d6e63]" />}
            {room.label}
          </motion.div>
        </Html>
      )}
    </group>
  );
}

// Moves the camera, the depth-of-field focus and Kivi's gaze target.
function Director({
  stage,
  place,
  kiwiPos,
  mouseLook,
  dof,
}: {
  stage: Stage;
  place: Place | null;
  kiwiPos: React.MutableRefObject<THREE.Vector3>;
  mouseLook: THREE.Vector3;
  dof: React.RefObject<DepthOfFieldEffect>;
}) {
  const look = useRef(new THREE.Vector3(0, 1, 4));
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const blur = useRef(4);
  const range = useRef(1.5);

  useFrame(({ camera, pointer }, dt) => {
    const k = kiwiPos.current;
    let speed = 1.6;
    let bokeh = 3;
    let focusRange = 2.5;
    if (stage === 'intro') {
      pos.set(k.x + 0.75 + pointer.x * 0.12, 0.98 + pointer.y * 0.06, k.z + 2.55);
      tgt.set(k.x, 0.8, k.z);
      focus.set(k.x, 0.85, k.z);
      bokeh = 5;
      focusRange = 1.1;
    } else if (stage === 'world') {
      pos.set(pointer.x * 1.4, 9 + pointer.y * 0.5, 22);
      tgt.set(0, 1.2, -1.6);
      focus.set(0, 1, -1.5);
      bokeh = 1.6;
      focusRange = 14;
      speed = 1.25;
    } else if (place) {
      pos.copy(place.cam).addScaledVector(place.side, pointer.x * 0.18);
      pos.y += pointer.y * 0.08;
      tgt.copy(place.look);
      focus.set(k.x, 0.8, k.z);
      speed = stage === 'enter' ? 1.05 : 1.6;
      bokeh = 3.2;
      focusRange = 2.2;
    }
    camera.position.lerp(pos, ease(speed, dt));
    look.current.lerp(tgt, ease(speed + 0.8, dt));
    camera.lookAt(look.current);

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

export default function KiviWorld3D({ activeStyleName, onSelectActiveStyle, isAdaptiveMode = true, onToggleAdaptive }: KiviWorld3DProps) {
  const [stage, setStage] = useState<Stage>('intro');
  const [phase, setPhase] = useState<Phase>('transform');
  const [place, setPlace] = useState<Place | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const [talk, setTalk] = useState(false);
  const [route, setRoute] = useState<{ points: THREE.Vector3[]; key: number }>({ points: [], key: 0 });
  const kiwiPos = useRef(PLAZA.clone());
  const mouseLook = useMemo(() => new THREE.Vector3(), []);
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

  useEffect(() => () => {
    clearTimers();
    document.body.style.cursor = '';
  }, []);

  // After Kivi finishes the invitation, pull the camera back to reveal the world.
  useEffect(() => {
    if (stage !== 'intro' || !introDone) return;
    const t = setTimeout(() => setStage('world'), 2200);
    return () => clearTimeout(t);
  }, [stage, introDone]);

  const walk = (points: THREE.Vector3[]) => setRoute((r) => ({ points, key: r.key + 1 }));

  const hover = (id: string | null) => {
    setHovered(id);
    if (id && stage === 'world') setHopKey((k) => k + 1);
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
    }, 1250);
  };

  const pick = (next: Place) => {
    if (stage !== 'world') return;
    clearTimers();
    setHovered(null);
    setPlace(next);
    setStage('enter');
    const fromPlaza = kiwiPos.current.distanceTo(PLAZA) < 0.5;
    walk(fromPlaza ? [next.entry] : [PLAZA, next.entry]);
  };

  const arrived = () => {
    if (stage === 'enter' && place) beginRoom(place);
    else if (stage === 'room' && phase === 'toSeat') {
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
    setStage('world');
    const back = [...place.approach].reverse().slice(1);
    walk([...back, place.entry, PLAZA]);
  };

  const inRoom = stage === 'room';
  const seated = inRoom && phase === 'seated';
  const outfit: Outfit = inRoom && place ? place.room.outfit : 'none';
  const face = seated && place ? place.seatYaw : inRoom && place ? place.room.rotation : 0;
  const hoveredPlace = PLACES.find((p) => p.room.id === hovered) ?? null;
  const lookAt =
    stage === 'intro' ? mouseLook : stage === 'world' && hoveredPlace ? hoveredPlace.label : seated && place ? place.focus : null;
  const bubble = stage === 'intro' ? introText || null : seated && talk && place ? place.room.line : null;

  return (
    <div
      className="relative w-full h-full rounded-3xl overflow-hidden select-none bg-[#f3e6d4]"
      onClick={() => stage === 'intro' && setStage('world')}
    >
      <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: false }} camera={{ fov: 40, position: [1.2, 1.4, 9], near: 0.1, far: 600 }}>
        <color attach="background" args={['#f3e6d4']} />
        <fog attach="fog" args={['#f1e5d3', 34, 110]} />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 6, 8]} scale={[14, 5, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe2c6" position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#dcebdc" position={[10, 3, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
          <Lightformer form="ring" intensity={1.5} color="#fff6e8" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={6} />
        </Environment>
        <hemisphereLight args={['#fff1e0', '#b7c79a', 0.45]} />
        <directionalLight
          position={[-9, 15, 11]}
          intensity={2.1}
          color="#fff0dc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <World />
        <Sparkles count={70} scale={[36, 9, 26]} position={[0, 4, -1]} size={3} speed={0.2} opacity={0.55} color="#fff6dc" />
        {PLACES.map((p) => (
          <RoomSpot
            key={p.room.id}
            place={p}
            interactive={stage === 'world'}
            highlighted={hovered === p.room.id || (inRoom && place?.room.id === p.room.id)}
            active={activeStyleName === p.room.persona}
            showLabel={stage === 'world' && hovered === p.room.id}
            onHover={hover}
            onPick={pick}
          />
        ))}
        <KiwiActor
          posRef={kiwiPos}
          route={route}
          face={face}
          elevate={seated && place ? place.seat.y : 0}
          outfit={outfit}
          pose={seated ? 'sit' : 'stand'}
          activity={seated && place ? place.room.activity : 'none'}
          lookAt={lookAt}
          hopKey={hopKey}
          bubble={bubble}
          bubbleId={stage === 'intro' ? 'intro' : place?.room.id ?? ''}
          onArrive={arrived}
        />
        <Director stage={stage} place={place} kiwiPos={kiwiPos} mouseLook={mouseLook} dof={dof} />
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.8} intensity={2.2} distanceFalloff={0.6} halfRes />
          <DepthOfField ref={dof} target={[0, 1, 4]} focalLength={0.02} bokehScale={4} />
          <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />
          <Vignette offset={0.28} darkness={0.42} />
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
            className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fffaf0]/85 backdrop-blur-md text-[#3e2723] text-sm font-semibold shadow-[0_6px_24px_rgba(62,39,35,0.14)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8d6e63]" />
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
            <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1 p-1 rounded-full bg-[#fffaf0]/80 backdrop-blur-md shadow-[0_8px_30px_rgba(62,39,35,0.14)]">
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

      {stage !== 'intro' && (
        <div className="absolute top-4 right-4">
          <AdaptToggle on={isAdaptiveMode} onToggle={onToggleAdaptive} />
        </div>
      )}
    </div>
  );
}
