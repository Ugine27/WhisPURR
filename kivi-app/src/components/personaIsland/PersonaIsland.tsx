import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import IslandScene from './IslandScene';
import { ISLAND_PERSONAS } from './personas';
import { transformLocally } from '../styles/StylesData';

/*
 * The Persona page: Kivi's dial island with an info panel over it. Scroll,
 * the arrow keys, the dial bar or a click on a station all spin the island to
 * a persona; "Use this persona" makes it the active one.
 */

interface Props {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
}

const reducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
})();

const n = ISLAND_PERSONAS.length;
const indexOf = (name: string) => Math.max(0, ISLAND_PERSONAS.findIndex((p) => p.name.toLowerCase() === name.toLowerCase()));

// Reveals text a few characters at a time whenever it changes.
function useTypewriter(text: string, speed = 18) {
  const [shown, setShown] = useState(reducedMotion ? text : '');
  useEffect(() => {
    if (reducedMotion) return setShown(text);
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return shown;
}

function Meter({ left, right, value, accent }: { left: string; right: string; value: number; accent: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-wider text-[#f4ece1]/45 mb-1.5">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, rgba(244,236,225,0.12), ${accent}88)` }}>
        <motion.div
          className="absolute top-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full ring-2 ring-[#2a1d17]"
          style={{ background: accent }}
          animate={{ left: `${value}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        />
      </div>
    </div>
  );
}

export default function PersonaIsland({ activeStyleName, onSelectActiveStyle }: Props) {
  const active = indexOf(activeStyleName);
  const [selected, setSelected] = useState(active);
  const [draft, setDraft] = useState('');
  const wheel = useRef({ acc: 0, until: 0 });
  const persona = ISLAND_PERSONAS[selected];

  const go = (d: number) => setSelected((s) => (s + d + n) % n);

  // Arrow keys spin the dial. Alt+arrows belong to the OS-level dial, so skip those.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Enter') onSelectActiveStyle(ISLAND_PERSONAS[selected].name);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onSelectActiveStyle]);

  const onWheel = (e: React.WheelEvent) => {
    if (e.altKey) return;
    const w = wheel.current;
    const now = performance.now();
    if (now < w.until) return;
    w.acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(w.acc) > 60) {
      go(Math.sign(w.acc));
      w.acc = 0;
      w.until = now + 420;
    }
  };

  const example = useTypewriter(persona.sampleOutput);
  const tried = draft.trim() ? transformLocally(draft, persona.name, persona.casualToFormal, persona.conciseToDetailed, persona.customInstructions) : '';
  const isActive = selected === active;

  return (
    <div
      className="relative w-full h-full rounded-3xl overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #f3c9a6 0%, #f6dcc2 45%, #f1cdb2 100%)' }}
      onWheel={onWheel}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 3.6, 13], fov: 40 }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => (document.body.style.cursor = '')}>
        <IslandScene selected={selected} active={active} reduced={reducedMotion} onSelect={setSelected} />
      </Canvas>

      {/* header */}
      <div className="absolute top-5 left-6 right-6 flex items-start justify-between pointer-events-none">
        <div>
          <h1 className="text-[28px] leading-none font-bold text-[#3e2723]">Personas</h1>
          <p className="text-sm text-[#5d4037]/75 mt-1.5">Spin Kivi's island to choose how your words come out.</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#2a1d17]/75 backdrop-blur-md px-3.5 py-1.5 text-xs text-[#f4ece1]">
          <span className="w-2 h-2 rounded-full" style={{ background: ISLAND_PERSONAS[active].accent }} />
          Active: <strong>{ISLAND_PERSONAS[active].name}</strong>
        </div>
      </div>

      {/* info panel */}
      <div className="absolute left-5 top-24 bottom-24 w-[340px] max-w-[calc(100%-2.5rem)] flex flex-col pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={persona.id}
            initial={reducedMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="context-studio-panel pointer-events-auto max-h-full overflow-y-auto rounded-2xl bg-[#2a1d17]/80 backdrop-blur-xl border border-white/10 shadow-2xl p-5 text-[#f4ece1] space-y-4"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#f4ece1]/45">
                <span>{persona.place}</span>
                <span>
                  {selected + 1} / {n}
                </span>
              </div>
              <h2 className="text-3xl font-bold mt-1" style={{ color: persona.accent }}>
                {persona.name}
              </h2>
              <p className="text-sm text-[#f4ece1]/75 mt-1">{persona.tagline}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {persona.desc.split('·').map((d) => (
                  <span key={d} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${persona.accent}66`, color: persona.accent }}>
                    {d.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Meter left="Casual" right="Formal" value={persona.casualToFormal} accent={persona.accent} />
              <Meter left="Concise" right="Detailed" value={persona.conciseToDetailed} accent={persona.accent} />
            </div>

            <div className="rounded-xl bg-black/20 p-3 space-y-2 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-[#f4ece1]/40">You say</div>
              <p className="text-[#f4ece1]/60 italic">"{persona.sampleInput}"</p>
              <div className="text-[11px] uppercase tracking-wider pt-1" style={{ color: persona.accent }}>
                Kivi writes
              </div>
              <p className="min-h-[2.5rem]">
                {example}
                {example.length < persona.sampleOutput.length && <span className="inline-block w-1.5 h-4 align-middle ml-0.5 bg-[#f4ece1]/60 animate-pulse" />}
              </p>
            </div>

            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Try your own sentence…"
                rows={2}
                className="w-full resize-none rounded-xl bg-black/25 border border-white/15 focus:border-white/35 outline-none px-3 py-2 text-sm placeholder:text-[#f4ece1]/50"
              />
              {tried && (
                <p className="mt-2 text-sm flex gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: persona.accent }} />
                  {tried}
                </p>
              )}
            </div>

            <button
              onClick={() => onSelectActiveStyle(persona.name)}
              disabled={isActive}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all disabled:cursor-default"
              style={isActive ? { background: 'rgba(255,255,255,0.06)', color: persona.accent } : { background: persona.accent, color: '#2a1d17' }}
            >
              {isActive ? (
                <>
                  <Check className="w-4 h-4" /> Active persona
                </>
              ) : (
                'Use this persona'
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* dial bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-[#2a1d17]/80 backdrop-blur-xl border border-white/10 p-1.5 shadow-xl">
          <button onClick={() => go(-1)} aria-label="Previous persona" className="p-2 rounded-full text-[#f4ece1]/70 hover:bg-white/10 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {ISLAND_PERSONAS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setSelected(i)}
              className="relative px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              style={{ color: i === selected ? '#2a1d17' : 'rgba(244,236,225,0.7)' }}
            >
              {i === selected && <motion.span layoutId="dial-pill" className="absolute inset-0 rounded-full" style={{ background: p.accent }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} />}
              <span className="relative flex items-center gap-1.5">
                {i === active && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                {p.name}
              </span>
            </button>
          ))}
          <button onClick={() => go(1)} aria-label="Next persona" className="p-2 rounded-full text-[#f4ece1]/70 hover:bg-white/10 hover:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-[#5d4037]/70">Scroll or use ← → to spin · Enter to use</p>
      </div>
    </div>
  );
}
