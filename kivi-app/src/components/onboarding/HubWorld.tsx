import { motion, useTransform, MotionValue } from 'framer-motion';
import { ASSETS, EASE_IN, EASE_OUT, HUBS, HUB_ZOOM, HubId, hubById } from './config';
import { Size } from './hooks';

/*
 * The hub world: one high-resolution image with the hotspots pinned to its
 * buildings. The image and hotspots drift together against the pointer while
 * a mist layer drifts the other way, which reads as depth. Entering a hub
 * zooms toward that building; coming back zooms out from it.
 */

export type WorldCustom = { from: 'intro' | HubId | null; to: HubId | null; size: Size };

// The world plane overhangs the stage by PAD on every side so parallax never shows an edge.
const PAD = 0.03;
const planeSize = (size: Size) => ({ w: size.w * (1 + 2 * PAD), h: size.h * (1 + 2 * PAD) });

// Where the world image sits: covering the stage, except that at least 90% of
// its width always stays visible so no hub falls off the edge. On narrow
// stages that leaves bands above and below, filled by a blurred copy.
const MIN_VISIBLE = 0.9;
export function worldBox(size: Size) {
  const aspect = ASSETS.worldAspect;
  const width = Math.max(size.w, Math.min(size.h * aspect, size.w / MIN_VISIBLE));
  const height = width / aspect;
  return { width, height, left: (size.w - width) / 2, top: (size.h - height) / 2 };
}

// A hub's building on the stage, as a fraction of the stage (used as the zoom origin).
export function spotOnStage(size: Size, id: HubId) {
  const b = worldBox(planeSize(size));
  const { x, y } = hubById(id).spot;
  return { x: (-PAD * size.w + b.left + (b.width * x) / 100) / size.w, y: (-PAD * size.h + b.top + (b.height * y) / 100) / size.h };
}

const at = (c: WorldCustom, id: HubId | null) => (id ? spotOnStage(c.size, id) : { x: 0.5, y: 0.5 });

export const worldVariants = {
  initial: (c: WorldCustom) => {
    if (c.from && c.from !== 'intro') {
      const o = at(c, c.from);
      return { opacity: 0, scale: HUB_ZOOM, originX: o.x, originY: o.y };
    }
    return { opacity: 0, scale: 1.3, originX: 0.5, originY: 0.5 };
  },
  enter: (c: WorldCustom) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 1.2, ease: EASE_OUT, delay: c.from === 'intro' ? 0.45 : 0.15, originX: { duration: 0 }, originY: { duration: 0 } },
  }),
  exit: (c: WorldCustom) => {
    const o = at(c, c.to);
    return {
      scale: HUB_ZOOM,
      opacity: [1, 1, 0],
      originX: o.x,
      originY: o.y,
      transition: { duration: 0.95, ease: EASE_IN, times: [0, 0.7, 1], originX: { duration: 0 }, originY: { duration: 0 } },
    };
  },
};

// The world image cover-fitted to the stage, with children positioned in % of the image.
export { planeSize, PAD };

export function WorldPlane({ size, children }: { size: Size; children?: React.ReactNode }) {
  const b = worldBox(size);
  const banded = b.height < size.h - 1;
  const feather = banded ? 'linear-gradient(180deg, transparent 0, #000 9%, #000 91%, transparent 100%)' : undefined;
  return (
    <>
      {banded && <img src={ASSETS.world} alt="" draggable={false} className="absolute inset-0 w-full h-full max-w-none object-cover select-none" style={{ filter: 'blur(28px) brightness(0.55) saturate(1.1)', transform: 'scale(1.12)' }} />}
      <div className="absolute" style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
        <img src={ASSETS.world} alt="" draggable={false} className="absolute inset-0 w-full h-full max-w-none select-none" style={{ WebkitMaskImage: feather, maskImage: feather }} />
        {children}
      </div>
    </>
  );
}

function Hotspot({ id, onOpen, index }: { id: HubId; onOpen: (id: HubId) => void; index: number }) {
  const hub = hubById(id);
  const Icon = hub.icon;
  return (
    <motion.button
      aria-label={hub.label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(id);
      }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 outline-none"
      style={{ left: `${hub.spot.x}%`, top: `${hub.spot.y}%` }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.9 + index * 0.12 }}
    >
      <span className="relative grid place-items-center w-14 h-14">
        {/* pulse ring */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 2px ${hub.accent}` }}
          animate={{ scale: [1, 1.7], opacity: [0.7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: index * 0.4 }}
        />
        <span
          className="relative grid place-items-center w-14 h-14 rounded-full backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110"
          style={{ background: 'rgba(12,18,10,0.45)', boxShadow: `inset 0 0 0 1.5px ${hub.accent}cc, 0 0 32px ${hub.accent}99` }}
        >
          <Icon className="w-6 h-6" style={{ color: hub.accent }} strokeWidth={1.8} />
        </span>
      </span>
      <span
        // Near the right edge the label hangs to the left of the pin so it isn't clipped.
        className={`absolute top-full mt-2 whitespace-nowrap px-3 py-1 rounded-full text-[12px] font-semibold tracking-wide backdrop-blur-md opacity-80 transition-opacity group-hover:opacity-100 ${hub.spot.x > 78 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
        style={{ background: 'rgba(12,18,10,0.5)', color: '#f1ecd9', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      >
        {hub.label}
      </span>
    </motion.button>
  );
}

interface Props {
  custom: WorldCustom;
  size: Size;
  px: MotionValue<number>;
  py: MotionValue<number>;
  onOpen: (id: HubId) => void;
}

export default function HubWorld({ custom, size, px, py, onOpen }: Props) {
  // Background and hotspots move as one; the mist moves the other way.
  const x = useTransform(px, (v) => v * -22);
  const y = useTransform(py, (v) => v * -14);
  const mx = useTransform(px, (v) => v * 14);
  const my = useTransform(py, (v) => v * 8);
  return (
    <motion.section className="absolute inset-0 z-10 overflow-hidden" custom={custom} variants={worldVariants} initial="initial" animate="enter" exit="exit" style={{ willChange: 'transform, opacity' }}>
      <motion.div className="absolute -inset-[3%]" style={{ x, y }}>
        <WorldPlane size={planeSize(size)}>
          {HUBS.map((h, i) => (
            <Hotspot key={h.id} id={h.id} index={i} onOpen={onOpen} />
          ))}
        </WorldPlane>
      </motion.div>
      {/* foreground mist and vignette, drifting against the background */}
      <motion.div
        className="absolute -inset-[4%] pointer-events-none"
        style={{
          x: mx,
          y: my,
          background: 'radial-gradient(ellipse 70% 55% at 50% 60%, transparent 55%, rgba(6,10,6,0.55)), linear-gradient(180deg, rgba(6,10,6,0.35), transparent 30%, transparent 75%, rgba(6,10,6,0.5))',
        }}
      />
      <motion.p
        className="absolute bottom-6 inset-x-0 text-center text-[13px] text-[#f1ecd9]/70 pointer-events-none"
        style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ delay: 1.4 }}
      >
        Pick a place for Kivi to settle in
      </motion.p>
    </motion.section>
  );
}
