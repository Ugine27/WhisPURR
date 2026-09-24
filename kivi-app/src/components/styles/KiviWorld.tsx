import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Wand2 } from 'lucide-react';
import KiwiBird, { Costume } from '../kiwi/KiwiBird';
import { WorldBackdrop, HubBuilding, HubInterior, HubPlace } from '../kiwi/WorldArt';

interface Hub {
  id: string; // persona name stored as the active mode
  place: HubPlace;
  costume: Costume;
  label: string;
  line: string;
  // Base point of the building on the world map, in % of the stage.
  x: number;
  y: number;
}

// Fallback (no WebGL) mirrors the 3D world's three hubs.
const HUBS: Hub[] = [
  { id: 'Formal', place: 'office', costume: 'suit', label: 'Office', line: 'Could you share the final report by Friday?', x: 20, y: 60 },
  { id: 'Casual', place: 'cafe', costume: 'hoodie', label: 'Café', line: 'hey! coffee later?', x: 50, y: 78 },
  { id: 'Developer', place: 'studio', costume: 'coder', label: 'Developer', line: 'fix: refresh token before it expires', x: 80, y: 60 },
];

const INTRO_LINE = "Come, let's build our world together.";
const KIWI_HOME = { x: 50, y: 94 };

type Stage = 'intro' | 'world' | 'hub';

interface KiviWorldProps {
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
}

export function SpeechBubble({ text, className = '' }: { text: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`relative rounded-3xl bg-[#fffaf0] text-[#3e2723] shadow-xl px-6 py-4 font-semibold leading-snug ${className}`}
    >
      {text}
      <span className="absolute -bottom-2 left-10 w-5 h-5 bg-[#fffaf0] rotate-45 rounded-sm" />
    </motion.div>
  );
}

export function useTypewriter(text: string, active: boolean, speed = 38) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!active) return;
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return shown;
}

export function AdaptToggle({ on, onToggle }: { on: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      title={on ? 'Auto-Adapt is on: WhisPURR picks the hub from the app you use' : 'Auto-Adapt is off'}
      className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-full shadow-md backdrop-blur-md border transition-colors cursor-pointer ${
        on ? 'bg-[#fffaf0]/90 border-[#f3dcae] text-[#5d4037]' : 'bg-[#3e2723]/50 border-[#fffaf0]/30 text-[#fffaf0]'
      }`}
    >
      <Wand2 className="w-4 h-4" />
      <span className={`relative inline-flex h-5 w-9 rounded-full p-0.5 transition-colors ${on ? 'bg-[#8d6e63]' : 'bg-[#fffaf0]/30'}`}>
        <motion.span layout className={`h-4 w-4 rounded-full bg-[#fffaf0] shadow ${on ? 'ml-auto' : ''}`} />
      </span>
    </button>
  );
}

function Poof() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full bg-[#fffaf0]"
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{ x: Math.cos(angle) * 140, y: Math.sin(angle) * 120, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export default function KiviWorld({ activeStyleName, onSelectActiveStyle, isAdaptiveMode = true, onToggleAdaptive }: KiviWorldProps) {
  const [stage, setStage] = useState<Stage>('intro');
  const [hub, setHub] = useState<Hub | null>(null);
  const [walkingTo, setWalkingTo] = useState<Hub | null>(null);
  const [dressed, setDressed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const introText = useTypewriter(INTRO_LINE, stage === 'intro');
  const introDone = introText.length === INTRO_LINE.length;

  // Kivi arrives in everyday feathers, then changes into the hub's outfit.
  useEffect(() => {
    if (stage !== 'hub' || !hub) return;
    setDressed(false);
    const t = setTimeout(() => setDressed(true), 450);
    return () => clearTimeout(t);
  }, [stage, hub]);

  const enterHub = (next: Hub) => {
    onSelectActiveStyle(next.id);
    setHub(next);
    setWalkingTo(null);
    setStage('hub');
  };

  const walkTo = (next: Hub) => {
    if (walkingTo) return;
    setWalkingTo(next);
    setTimeout(() => enterHub(next), 950);
  };

  const kiwiPos = walkingTo ? { x: walkingTo.x, y: Math.min(walkingTo.y + 8, 96) } : KIWI_HOME;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden select-none bg-[#ffe8c7]">
      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <motion.div
            key="intro"
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            style={{ background: 'radial-gradient(circle at 50% 60%, #fff3d6 0%, #ffd3ab 55%, #f9bf9f 100%)' }}
            onClick={() => setStage('world')}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col items-center gap-2">
              <AnimatePresence>
                {introText && <SpeechBubble text={introText} className="text-xl md:text-2xl min-w-[12rem] text-center" />}
              </AnimatePresence>
              <motion.div
                initial={{ y: 200, scale: 0.5, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              >
                <KiwiBird className="w-[min(420px,60vw)] h-auto" />
              </motion.div>
              <AnimatePresence>
                {introDone && (
                  <motion.button
                    type="button"
                    aria-label="Enter the world"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: [1, 1.08, 1] }}
                    transition={{ scale: { duration: 1.4, repeat: Infinity }, opacity: { duration: 0.3 } }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStage('world');
                    }}
                    className="w-14 h-14 rounded-full bg-[#5d4037] text-[#fffaf0] shadow-xl flex items-center justify-center cursor-pointer"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {stage === 'world' && (
          <motion.div
            key="world"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.8 }}
            style={{ transformOrigin: walkingTo ? `${walkingTo.x}% ${walkingTo.y}%` : '50% 60%' }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <WorldBackdrop />

            {HUBS.map((h, i) => {
              const isActive = activeStyleName === h.id;
              const showLabel = hovered === h.id || isActive;
              return (
                <motion.button
                  key={h.id}
                  type="button"
                  aria-label={h.label}
                  onClick={() => walkTo(h)}
                  onHoverStart={() => setHovered(h.id)}
                  onHoverEnd={() => setHovered(null)}
                  className="absolute flex flex-col items-center cursor-pointer focus:outline-none"
                  style={{ left: `${h.x}%`, top: `${h.y}%`, x: '-50%', y: '-100%' }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 + i * 0.08 }}
                >
                  <AnimatePresence>
                    {showLabel && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className={`mb-1 px-3 py-1 rounded-full text-sm font-bold shadow-md ${
                          isActive ? 'bg-[#5d4037] text-[#fffaf0]' : 'bg-[#fffaf0] text-[#5d4037]'
                        }`}
                      >
                        {h.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <HubBuilding place={h.place} className="w-[clamp(84px,12vw,150px)] h-auto drop-shadow-lg" />
                  {isActive && (
                    <motion.span
                      className="absolute -bottom-1 w-3/4 h-3 rounded-full bg-[#fff6e0] blur-sm"
                      animate={{ opacity: [0.4, 0.9, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </motion.button>
              );
            })}

            <motion.div
              className="absolute pointer-events-none"
              initial={false}
              animate={{ left: `${kiwiPos.x}%`, top: `${kiwiPos.y}%` }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              style={{ x: '-50%', y: '-100%', scaleX: walkingTo && walkingTo.x < KIWI_HOME.x ? -1 : 1 }}
            >
              <KiwiBird walking={!!walkingTo} className="w-[clamp(64px,8vw,110px)] h-auto" />
            </motion.div>

            <div className="absolute top-4 right-4">
              <AdaptToggle on={isAdaptiveMode} onToggle={onToggleAdaptive} />
            </div>
          </motion.div>
        )}

        {stage === 'hub' && hub && (
          <motion.div
            key="hub"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.45 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={hub.place}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <HubInterior place={hub.place} />
              </motion.div>
            </AnimatePresence>

            <div className="absolute left-1/2 bottom-[6%] -translate-x-1/2 flex flex-col items-center">
              <AnimatePresence mode="wait">
                {dressed && <SpeechBubble key={hub.id} text={hub.line} className="text-lg md:text-xl mb-1" />}
              </AnimatePresence>
              <div className="relative">
                {dressed && <Poof key={hub.id} />}
                <KiwiBird costume={dressed ? hub.costume : 'none'} className="w-[min(380px,42vw)] max-h-[52vh] h-auto" />
              </div>
            </div>

            <button
              type="button"
              aria-label="Back to the world"
              onClick={() => setStage('world')}
              className="absolute top-4 left-4 w-11 h-11 rounded-full bg-[#fffaf0]/90 text-[#5d4037] shadow-md flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="absolute top-4 right-4">
              <AdaptToggle on={isAdaptiveMode} onToggle={onToggleAdaptive} />
            </div>

            {/* Hop between hubs without going back to the map */}
            <div className="absolute bottom-4 right-4 flex gap-1.5 p-1.5 rounded-2xl bg-[#fffaf0]/80 backdrop-blur-md shadow-md">
              {HUBS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-label={h.label}
                  title={h.label}
                  onClick={() => h.id !== hub.id && enterHub(h)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    h.id === hub.id ? 'bg-[#5d4037]/20 ring-2 ring-[#5d4037]' : 'hover:bg-[#5d4037]/10'
                  }`}
                >
                  <HubBuilding place={h.place} className="w-9 h-9" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
