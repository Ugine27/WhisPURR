import { motion } from 'framer-motion';
import { ASSETS, EASE_IN, EASE_OUT } from './config';

/*
 * The pixel intro. On "Let's Go" the whole screen dives: an accelerating
 * zoom that blurs and fades out in its last stretch while the world fades
 * up underneath (see Onboarding for the overlap).
 */

export const introVariants = {
  enter: { scale: 1, opacity: 1, filter: 'blur(0px)' },
  exit: {
    scale: 4.5,
    opacity: [1, 1, 0],
    filter: ['blur(0px)', 'blur(2px)', 'blur(12px)'],
    transition: { duration: 1.15, ease: EASE_IN, times: [0, 0.55, 1] },
  },
};

const GREEN = '#a4e35a';

export default function IntroScreen({ onGo }: { onGo: () => void }) {
  return (
    <motion.section
      className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
      variants={introVariants}
      initial="enter"
      animate="enter"
      exit="exit"
      style={{ willChange: 'transform, opacity, filter' }}
    >
      <img src={ASSETS.intro} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(8,12,7,0.25), rgba(8,12,7,0.8))' }} />

      <div className="relative flex flex-col items-center text-center px-6">
        <motion.h1
          className="font-serif leading-[0.95] tracking-[-0.02em] text-[#f1ecd9]"
          style={{ fontSize: 'clamp(40px, 6.4vw, 92px)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.15 }}
        >
          come, let's build
          <br />
          <span style={{ color: GREEN }}>our world together.</span>
        </motion.h1>
        <motion.button
          onClick={onGo}
          className="mt-10 rounded-2xl px-8 py-3.5 text-[17px] font-bold"
          style={{ background: GREEN, color: '#10170c', boxShadow: `0 12px 44px ${GREEN}55`, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.04, boxShadow: `0 16px 56px ${GREEN}80` }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.55 }}
        >
          Let's Go
        </motion.button>
      </div>
    </motion.section>
  );
}
