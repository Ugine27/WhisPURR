import { motion } from 'framer-motion';
import { ASSETS, EASE_IN, EASE_OUT } from './config';

/*
 * The pixel intro with Kivi idling above the button. On "Let's Go" three
 * things happen at once: the headline and button clear away, the pixel
 * screen scales up and fades, and Kivi rushes toward the camera, filling
 * the frame before it fades too, so it feels like Kivi pulls you through
 * into the world fading up underneath (see Onboarding).
 */

const GREEN = '#a4e35a';
const DIVE = 1.15; // seconds

const backdrop = {
  exit: { scale: 2.4, opacity: 0, filter: 'blur(6px)', transition: { duration: DIVE * 0.9, ease: EASE_IN } },
};

const copy = {
  exit: { opacity: 0, y: -24, filter: 'blur(8px)', transition: { duration: 0.35, ease: 'easeIn' } },
};

const kiviDive = {
  exit: {
    scale: 9,
    z: 480,
    y: '-18%',
    opacity: [1, 1, 0],
    transition: { duration: DIVE, ease: EASE_IN, times: [0, 0.78, 1] },
  },
};

export default function IntroScreen({ onGo }: { onGo: () => void }) {
  const k = ASSETS.kiviDefault;
  // Tighter than the hub matte: the pixel screen is darker and greener than Kivi's studio backdrop.
  const matte = k.matte ? 'radial-gradient(ellipse 44% 47% at 50% 55%, #000 48%, transparent 96%)' : undefined;

  return (
    <motion.section className="absolute inset-0 z-20 overflow-hidden" style={{ perspective: 900 }}>
      {/* pixel screen */}
      <motion.div className="absolute inset-0" variants={backdrop} exit="exit" style={{ willChange: 'transform, opacity, filter' }}>
        <img src={ASSETS.intro} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(6,9,5,0.7))' }} />
      </motion.div>

      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        <motion.h1
          variants={copy}
          exit="exit"
          className="font-serif leading-[0.95] tracking-[-0.02em] text-[#f1ecd9]"
          style={{ fontSize: 'clamp(38px, 5.8vw, 84px)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 1, ease: EASE_OUT, delay: 0.15 } }}
        >
          come, let's build
          <br />
          <span style={{ color: GREEN }}>our world together.</span>
        </motion.h1>

        {/* Kivi, resting just above the button */}
        <motion.div
          variants={kiviDive}
          exit="exit"
          className="relative mt-3 h-[clamp(230px,46vh,460px)] aspect-[4/5]"
          // The raised wing widens the image on the left; shift so Kivi's body sits on the centre line.
          style={{ x: '-10%', transformPerspective: 900, willChange: 'transform, opacity' }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_OUT, delay: 0.35 } }}
        >
          <motion.img
            src={k.src}
            alt="Kivi"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain object-bottom"
            style={{ originX: 0.6, originY: 0.85, WebkitMaskImage: matte, maskImage: matte }}
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{
              y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 5.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.7, 1] },
            }}
          />
        </motion.div>

        <motion.button
          variants={copy}
          exit="exit"
          onClick={onGo}
          className="mt-4 rounded-2xl px-8 py-3.5 text-[17px] font-bold"
          style={{ background: GREEN, color: '#10170c', boxShadow: `0 12px 44px ${GREEN}55`, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT, delay: 0.6 } }}
          whileHover={{ scale: 1.04, boxShadow: `0 16px 56px ${GREEN}80` }}
          whileTap={{ scale: 0.97 }}
        >
          Let's Go
        </motion.button>
      </div>
    </motion.section>
  );
}
