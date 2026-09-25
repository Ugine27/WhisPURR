import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, MotionValue } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import KiviStage, { KiviTarget } from './KiviStage';
import { LAYER_W, SCENES, SceneId, preloadScenes, useDithered } from './art';
import { WORLDS, rewrite, worldForMode } from './worlds';

/*
 * Personas as Kivi's worlds. Kivi greets you in the dark garden, walks
 * forward as the garden falls away, and the three worlds open up as one
 * continuous strip. Hovering a world sends Kivi there in that world's outfit;
 * clicking steps inside to tune how Kivi talks there.
 */

type Phase = 'intro' | 'enter' | 'worlds' | 'focus';

interface Props {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
}

const reduced = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
})();

const EASE: [number, number, number, number] = [0.7, 0, 0.2, 1];
const CREAM = '#f1ecd9';
const GREEN = '#a4e35a';

const DEFAULT_TONE: Record<string, [number, number]> = { office: [80, 60], cafe: [20, 45], developer: [55, 30] };
const loadTone = (): Record<string, [number, number]> => {
  try {
    return { ...DEFAULT_TONE, ...JSON.parse(localStorage.getItem('whispurr_world_tone') || '{}') };
  } catch (e) {
    return DEFAULT_TONE;
  }
};

function useTypewriter(text: string) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced) return setShown(text);
    let i = 0;
    setShown('');
    const id = window.setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [text]);
  return shown;
}

function Layer({ scene, layer, depth, px, py, className = '' }: { scene: SceneId; layer: 'back' | 'front'; depth: number; px: MotionValue<number>; py: MotionValue<number>; className?: string }) {
  const src = useDithered(SCENES[scene][layer], LAYER_W[layer]);
  const x = useTransform(px, (v) => v * -depth);
  const y = useTransform(py, (v) => v * -depth * 0.5);
  if (!src) return null;
  return (
    <motion.img
      src={src}
      alt=""
      draggable={false}
      style={{ x, y, imageRendering: 'pixelated' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`absolute -left-[4%] -top-[4%] w-[108%] h-[108%] max-w-none object-cover pointer-events-none ${className}`}
    />
  );
}

// Kiwi footprints, the trail motif from the website.
function Footprints({ show }: { show: boolean }) {
  return (
    <div className="absolute left-1/2 bottom-[17%] flex gap-7 pointer-events-none">
      {Array.from({ length: 8 }, (_, i) => (
        <motion.svg
          key={i}
          width="18"
          height="14"
          viewBox="0 0 18 14"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: [0, 0.6, 0] } : { opacity: 0 }}
          transition={{ duration: 1.1, delay: i * 0.07 }}
          style={{ marginTop: i % 2 ? 10 : 0 }}
        >
          <path d="M1 7 L9 1 L7 7 L9 13Z M9 7 L17 2 L15 7 L17 12Z" fill={CREAM} />
        </motion.svg>
      ))}
    </div>
  );
}

function Specks({ burst }: { burst: boolean }) {
  const specks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: ((i * 37) % 100) - 50,
        y: ((i * 61) % 100) - 50,
        s: 2 + (i % 3),
        c: i % 4 ? GREEN : '#e8c47a',
        d: 4 + (i % 5),
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {specks.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: `${50 + p.x}%`, top: `${50 + p.y}%`, width: p.s, height: p.s, background: p.c }}
          animate={
            burst
              ? { x: p.x * 14, y: p.y * 10, opacity: 0, scale: 3 }
              : reduced
                ? { opacity: 0.5 }
                : { y: [0, -18, 0], opacity: [0.15, 0.7, 0.15] }
          }
          transition={burst ? { duration: 1, ease: EASE } : { duration: p.d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function ToneLine({ left, right, value, onChange }: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-4 text-[13px]" style={{ color: `${CREAM}99` }}>
      <span className="w-14 text-right">{left}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="kivi-range flex-1" />
      <span className="w-14">{right}</span>
    </label>
  );
}

export default function PersonaWorlds({ activeStyleName, onSelectActiveStyle }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1100, h: 760 });
  const [phase, setPhase] = useState<Phase>(reduced ? 'worlds' : 'intro');
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = worldForMode(activeStyleName);
  const [home, setHome] = useState(active >= 0 ? active : 1); // where Kivi rests
  const [tones, setTones] = useState(loadTone);
  const [inputs, setInputs] = useState(() => WORLDS.map((w) => w.sample));

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 20 });
  const py = useSpring(my, { stiffness: 60, damping: 20 });

  useEffect(preloadScenes, []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const enter = () => {
    if (phase !== 'intro') return;
    setPhase('enter');
    window.setTimeout(() => setPhase('worlds'), 1150);
  };
  const open = (i: number) => {
    setFocused(i);
    setHome(i);
    setHovered(null);
    setPhase('focus');
  };
  const back = () => {
    setPhase('worlds');
    setFocused(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (phase === 'intro' && e.key === 'Enter') enter();
      if (phase === 'focus' && e.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    try {
      localStorage.setItem('whispurr_world_tone', JSON.stringify(tones));
    } catch (e) {}
  }, [tones]);

  // Zone widths: the hovered world opens up; a focused world takes the stage.
  const grow = WORLDS.map((_, i): number => {
    if (phase === 'focus') return i === focused ? 1 : 0;
    if (hovered === null) return 1;
    return i === hovered ? 1.7 : 0.65;
  });
  const total = grow.reduce((a, b) => a + b, 0);
  // Which world is under the pointer, using the layout as it stands.
  const zoneAt = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = ((e.clientX - r.left) / r.width) * total;
    let acc = 0;
    return grow.findIndex((g) => (acc += g) >= f);
  };
  const centre = (i: number) => {
    const before = grow.slice(0, i).reduce((a, b) => a + b, 0);
    return ((before + grow[i] / 2) / total - 0.5) * size.w;
  };

  const { w, h } = size;
  const ground = -h / 2 + h * 0.16;
  const inWorld = phase === 'worlds' || phase === 'focus';
  const here = phase === 'focus' ? focused! : hovered ?? home;
  let kivi: KiviTarget;
  if (phase === 'intro') kivi = { x: 0, y: ground + h * 0.03, size: h * 0.12 };
  else if (phase === 'enter') kivi = { x: w * 0.14, y: ground + h * 0.03, size: h * 0.12 };
  else if (phase === 'focus') kivi = { x: -w * 0.03, y: ground - h * 0.03, size: h * 0.17 };
  else kivi = { x: centre(here), y: ground, size: h * 0.13 };
  const kiviWorld = inWorld ? WORLDS[here].id : null;
  const tint = inWorld ? WORLDS[here].tint : GREEN;

  const fw = focused !== null ? WORLDS[focused] : null;
  const [tone, length] = fw ? tones[fw.id] : [50, 50];
  const output = useTypewriter(fw ? rewrite(fw, inputs[focused!], tone, length) : '');

  return (
    <div
      ref={box}
      className="relative w-full h-full rounded-3xl overflow-hidden select-none"
      style={{ background: '#0b100a', color: CREAM }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2 * 12);
        my.set(((e.clientY - r.top) / r.height - 0.5) * 2 * 12);
      }}
      onClick={phase === 'intro' ? enter : undefined}
    >
      <style>{`
        .kivi-range { -webkit-appearance: none; appearance: none; height: 1px; background: ${CREAM}40; outline: none; cursor: pointer; }
        .kivi-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${GREEN}; box-shadow: 0 0 0 5px ${GREEN}26; }
        .kivi-range::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: ${GREEN}; }
      `}</style>

      {/* ---------------- the garden (intro) ---------------- */}
      <AnimatePresence>
        {(phase === 'intro' || phase === 'enter') && (
          <motion.div key="garden" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div className="absolute inset-0" animate={phase === 'enter' ? { scale: 1.3, filter: 'blur(6px)', opacity: 0.2 } : { scale: 1, filter: 'blur(0px)', opacity: 1 }} transition={{ duration: 1.2, ease: EASE }}>
              <Layer scene="intro" layer="back" depth={0.6} px={px} py={py} />
            </motion.div>
            <Specks burst={phase === 'enter'} />
            <motion.div className="absolute inset-0" animate={phase === 'enter' ? { scale: 1.8, filter: 'blur(12px)', opacity: 0 } : { scale: 1, filter: 'blur(0px)', opacity: 1 }} transition={{ duration: 1.1, ease: EASE }}>
              <Layer scene="intro" layer="front" depth={1.6} px={px} py={py} />
            </motion.div>
            <Footprints show={phase === 'enter'} />

            <motion.div
              className="absolute inset-x-0 top-[22%] flex flex-col items-center text-center px-6"
              animate={phase === 'enter' ? { opacity: 0, y: -30, filter: 'blur(8px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <motion.h1
                className="font-serif leading-[0.95] tracking-[-0.02em]"
                style={{ fontSize: 'clamp(40px, 6.4vw, 92px)' }}
                initial={reduced ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: EASE, delay: 0.2 }}
              >
                come, let's build
                <br />
                <span style={{ color: GREEN }}>our world together.</span>
              </motion.h1>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  enter();
                }}
                className="mt-10 rounded-2xl px-7 py-3 text-[17px] font-bold"
                style={{ background: GREEN, color: '#10170c', boxShadow: `0 10px 40px ${GREEN}40`, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
              >
                let's go
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- the worlds ---------------- */}
      {inWorld && (
        <motion.div
          className="absolute inset-0 flex"
          style={{ cursor: phase === 'worlds' ? 'pointer' : 'default' }}
          initial={reduced ? false : { opacity: 0, scale: 1.12, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: EASE }}
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(e) => {
            const i = zoneAt(e);
            if (phase === 'worlds' && i >= 0 && i !== hovered) setHovered(i);
          }}
          onClick={(e) => {
            const i = zoneAt(e);
            if (phase === 'worlds' && i >= 0) open(i);
          }}
        >
          {WORLDS.map((wd, i) => {
            const isFocus = phase === 'focus' && i === focused;
            const lit = phase === 'focus' ? isFocus : hovered === null ? i === home : i === hovered;
            return (
              <motion.div
                key={wd.id}
                className="relative h-full overflow-hidden"
                style={{
                  flexBasis: 0,
                                    margin: phase === 'focus' ? 0 : '0 -4%',
                  WebkitMaskImage: phase === 'focus' ? 'none' : 'linear-gradient(90deg, transparent 0, #000 15%, #000 85%, transparent 100%)',
                  maskImage: phase === 'focus' ? 'none' : 'linear-gradient(90deg, transparent 0, #000 15%, #000 85%, transparent 100%)',
                }}
                animate={{ flexGrow: grow[i], filter: lit ? 'brightness(1.05) saturate(1)' : 'brightness(0.45) saturate(0.7)' }}
                transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
              >
                <motion.div className="absolute inset-0" animate={isFocus ? { scale: 1.08, x: '-26%' } : { scale: 1, x: '0%' }} transition={{ duration: 1.2, ease: EASE }}>
                  <Layer scene={wd.id} layer="back" depth={0.5} px={px} py={py} />
                  <Layer scene={wd.id} layer="front" depth={1.3} px={px} py={py} />
                </motion.div>

              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* world names, set into the floor under each world */}
      <AnimatePresence>
        {phase === 'worlds' &&
          WORLDS.map((wd, i) => {
            const lit = hovered === null ? i === home : i === hovered;
            return (
              <motion.div
                key={wd.id}
                className="absolute left-1/2 bottom-[5%] pointer-events-none text-center whitespace-nowrap"
                initial={{ opacity: 0, y: 16, x: `calc(${centre(i)}px - 50%)` }}
                animate={{ opacity: lit ? 1 : 0.45, y: 0, x: `calc(${centre(i)}px - 50%)`, scale: lit ? 1 : 0.72 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.7, ease: EASE, opacity: { delay: 0.1 * i } }}
              >
                <div className="font-serif leading-none tracking-[-0.02em]" style={{ fontSize: 'clamp(30px, 4vw, 56px)' }}>
                  {wd.label}
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 text-[12px] tracking-wide" style={{ color: `${CREAM}8c`, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                  {i === active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />}
                  {wd.sub}
                </div>
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* ---------------- stepping inside a world ---------------- */}
      <AnimatePresence>
        {phase === 'focus' && fw && (
          <motion.div key={fw.id} className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
            <div className="absolute inset-y-0 right-0 w-[62%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(8,12,7,0.82) 35%, rgba(8,12,7,0.94))' }} />
            <button onClick={back} className="pointer-events-auto absolute top-5 left-6 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] backdrop-blur-md transition-colors hover:bg-black/60" style={{ background: 'rgba(8,12,7,0.45)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
              <ArrowLeft className="w-4 h-4" /> worlds
            </button>
            <div className="absolute left-7 bottom-[6%] font-serif leading-none tracking-[-0.02em]" style={{ fontSize: 'clamp(44px, 6vw, 88px)' }}>
              {fw.label}
            </div>

            <div className="pointer-events-auto absolute right-[6%] top-1/2 -translate-y-1/2 w-[min(440px,42%)] space-y-9">
              <div>
                <input
                  value={inputs[focused!]}
                  onChange={(e) => setInputs((all) => all.map((v, k) => (k === focused ? e.target.value : v)))}
                  placeholder="say something…"
                  spellCheck={false}
                  className="w-full bg-transparent outline-none border-b border-transparent hover:border-current focus:border-current pb-1 italic text-[15px] transition-colors"
                  style={{ color: `${CREAM}80`, borderColor: undefined }}
                />
                <div className="my-3 text-[13px]" style={{ color: GREEN }}>
                  ↓
                </div>
                <p className="font-serif leading-[1.15] min-h-[4.5em]" style={{ fontSize: 'clamp(22px, 2.3vw, 32px)' }}>
                  {output}
                </p>
              </div>

              <div className="space-y-4" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                <ToneLine left="relaxed" right="formal" value={tone} onChange={(v) => setTones((t) => ({ ...t, [fw.id]: [v, t[fw.id][1]] }))} />
                <ToneLine left="brief" right="detailed" value={length} onChange={(v) => setTones((t) => ({ ...t, [fw.id]: [t[fw.id][0], v] }))} />
              </div>

              {focused === active ? (
                <div className="flex items-center gap-2 text-[14px]" style={{ color: GREEN, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                  <Check className="w-4 h-4" /> Kivi speaks like this now
                </div>
              ) : (
                <motion.button
                  onClick={() => onSelectActiveStyle(fw.mode)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-2xl px-6 py-3 text-[15px] font-bold"
                  style={{ background: GREEN, color: '#10170c', boxShadow: `0 10px 40px ${GREEN}33`, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  speak like this
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- kivi, grain and chrome ---------------- */}
      <KiviStage target={kivi} world={kiviWorld} tint={tint} reduced={reduced} />

      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.14]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55))' }} />

      <AnimatePresence>
        {phase === 'worlds' && (
          <motion.div className="absolute top-6 inset-x-7 flex justify-between text-[13px] pointer-events-none" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.6 }}>
            <span style={{ color: `${CREAM}8c` }}>kivi's worlds</span>
            {active >= 0 && (
              <span className="flex items-center gap-2" style={{ color: `${CREAM}b3` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />
                speaking in {WORLDS[active].label}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
