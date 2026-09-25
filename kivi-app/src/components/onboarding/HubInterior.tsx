import { motion, useTransform, MotionValue } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE_IN, EASE_OUT, HUB_ZOOM, Hub } from './config';
import { Size } from './hooks';
import { WorldPlane, planeSize, spotOnStage } from './HubWorld';
import PersonaCard from './PersonaCard';

/*
 * Inside a hub: the interior backdrop, Kivi on the right and the persona
 * card on the left. Without an interior image the backdrop is the world
 * image held at exactly the framing the zoom ended on, so the crossfade
 * from the world is seamless; it then keeps easing in, softly out of focus.
 */

interface Props {
  hub: Hub;
  size: Size;
  px: MotionValue<number>;
  py: MotionValue<number>;
  active: boolean;
  onUse: () => void;
  onBack: () => void;
}

function Backdrop({ hub, size }: { hub: Hub; size: Size }) {
  if (hub.interior) {
    return (
      <motion.img
        src={hub.interior}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ opacity: 0, scale: 1.18 }}
        animate={{ opacity: 1, scale: 1.04, transition: { opacity: { duration: 0.6, delay: 0.45 }, scale: { duration: 2.4, ease: EASE_OUT, delay: 0.45 } } }}
        exit={{ opacity: 0, scale: 1.12, transition: { duration: 0.6, ease: EASE_IN } }}
      />
    );
  }
  const o = spotOnStage(size, hub.id);
  return (
    <motion.div
      className="absolute inset-0"
      style={{ originX: o.x, originY: o.y }}
      initial={{ opacity: 0, scale: HUB_ZOOM, filter: 'blur(0px) brightness(1)' }}
      animate={{
        opacity: 1,
        scale: HUB_ZOOM * 1.06,
        filter: 'blur(3px) brightness(0.72)',
        transition: { opacity: { duration: 0.45, delay: 0.55 }, scale: { duration: 3, ease: EASE_OUT, delay: 0.55 }, filter: { duration: 1.4, delay: 0.7 } },
      }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: EASE_IN, delay: 0.15 } }}
    >
      <div className="absolute -inset-[3%]">
        <WorldPlane size={planeSize(size)} />
      </div>
    </motion.div>
  );
}

export default function HubInterior({ hub, size, px, py, active, onUse, onBack }: Props) {
  const kx = useTransform(px, (v) => v * -12);
  const ky = useTransform(py, (v) => v * -6);
  const k = hub.kivi;
  const matte = k.matte ? 'radial-gradient(ellipse 46% 48% at 50% 54%, #000 60%, transparent 100%)' : undefined;

  return (
    <section className="absolute inset-0 overflow-hidden">
      <Backdrop hub={hub} size={size} />

      {/* shade behind the card so it stays readable on any backdrop */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, rgba(6,10,6,0.7) 0%, rgba(6,10,6,0.35) 45%, transparent 70%), radial-gradient(ellipse 45% 40% at 78% 92%, rgba(0,0,0,0.5), transparent)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.8, delay: 0.6 } }}
        exit={{ opacity: 0, transition: { duration: 0.4 } }}
      />

      {/* Kivi */}
      <motion.div
        className="absolute bottom-0 right-[2%] h-[86%] aspect-[3/4] pointer-events-none"
        style={{ x: kx, y: ky }}
        initial={{ opacity: 0, x: 220 }}
        animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 70, damping: 16, delay: 0.55 } }}
        exit={{ opacity: 0, x: 220, transition: { duration: 0.45, ease: EASE_IN } }}
      >
        <motion.img
          src={k.src}
          alt={`Kivi, dressed for the ${hub.label}`}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain object-bottom"
          style={{ scaleX: k.flip ? -1 : 1, WebkitMaskImage: matte, maskImage: matte, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.45))' }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* settings card */}
      <div className="absolute left-[4%] top-[12%] bottom-[5%] w-[min(420px,56%)] flex items-center pointer-events-none">
        <PersonaCard hub={hub} active={active} onUse={onUse} />
      </div>

      <motion.button
        onClick={onBack}
        className="absolute top-5 left-[4%] flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-[14px] font-semibold backdrop-blur-xl border"
        style={{ background: 'rgba(12,18,10,0.55)', borderColor: 'rgba(255,255,255,0.14)', color: '#f1ecd9', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay: 0.8 } }}
        exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Map
      </motion.button>
    </section>
  );
}
