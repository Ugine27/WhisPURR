import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Costume = 'none' | 'suit' | 'hoodie' | 'coder' | 'wizard' | 'explorer';

interface KiwiBirdProps {
  costume?: Costume;
  walking?: boolean;
  className?: string;
}

const FEATHER = '#7b5a3c';
const FEATHER_DARK = '#5e4128';
const LEG = '#d99a4e';

// Pops a costume piece in and out when Kivi changes outfit.
const piece = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 18 } },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.15 } },
};
const pieceStyle = { transformBox: 'fill-box' as const, transformOrigin: 'center' };

export default function KiwiBird({ costume = 'none', walking = false, className }: KiwiBirdProps) {
  const clipId = `kiwi-body-${useId().replace(/:/g, '')}`;

  return (
    <motion.svg
      viewBox="0 0 240 220"
      className={className}
      animate={{ y: walking ? [0, -5, 0] : [0, -4, 0] }}
      transition={{ duration: walking ? 0.35 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <ellipse cx="105" cy="125" rx="72" ry="58" />
          <ellipse cx="150" cy="106" rx="30" ry="26" />
        </clipPath>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="108" cy="208" rx="62" ry="7" fill="#000" opacity="0.12" />

      {/* Legs */}
      <motion.g
        stroke={LEG}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        style={{ transformBox: 'fill-box', transformOrigin: 'top' }}
      >
        <motion.path
          d="M92 176 L88 204 M88 204 l-12 3 M88 204 l1 7 M88 204 l11 2"
          style={{ transformBox: 'fill-box', transformOrigin: 'top' }}
          animate={{ rotate: walking ? [-14, 14, -14] : 0 }}
          transition={{ duration: 0.35, repeat: walking ? Infinity : 0 }}
        />
        <motion.path
          d="M122 178 L126 204 M126 204 l-11 2 M126 204 l1 7 M126 204 l12 3"
          style={{ transformBox: 'fill-box', transformOrigin: 'top' }}
          animate={{ rotate: walking ? [14, -14, 14] : 0 }}
          transition={{ duration: 0.35, repeat: walking ? Infinity : 0 }}
        />
      </motion.g>

      {/* Behind-the-body pieces */}
      <AnimatePresence>
        {costume === 'explorer' && (
          <motion.g key="backpack" {...piece} style={pieceStyle}>
            <rect x="18" y="92" width="44" height="60" rx="12" fill="#3f7d58" />
            <rect x="24" y="116" width="30" height="22" rx="6" fill="#2f6146" />
          </motion.g>
        )}
        {costume === 'hoodie' && (
          <motion.circle key="hood" cx="166" cy="92" r="37" fill="#d9674c" {...piece} style={pieceStyle} />
        )}
      </AnimatePresence>

      {/* Body + neck */}
      <ellipse cx="105" cy="125" rx="72" ry="58" fill={FEATHER} />
      <ellipse cx="150" cy="106" rx="30" ry="26" fill={FEATHER} />
      <ellipse cx="80" cy="100" rx="38" ry="22" fill="#95704c" opacity="0.45" />
      <g stroke={FEATHER_DARK} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5">
        <path d="M60 120 q6 8 14 6" />
        <path d="M84 142 q6 8 14 6" />
        <path d="M112 118 q6 8 14 6" />
        <path d="M70 160 q6 6 13 4" />
        <path d="M104 162 q6 6 13 4" />
      </g>

      {/* Clothing, clipped to the body */}
      <AnimatePresence>
        {costume !== 'none' && (
          <motion.g key={`outfit-${costume}`} clipPath={`url(#${clipId})`} {...piece} style={pieceStyle}>
            {costume === 'suit' && (
              <>
                <rect x="20" y="60" width="200" height="140" fill="#2c3e57" />
                <path d="M134 92 L168 108 L152 152 L126 116 Z" fill="#fdfcf8" />
                <path d="M134 92 L126 116 L138 150" stroke="#1d2b3f" strokeWidth="4" fill="none" />
                <path d="M168 108 L162 140" stroke="#1d2b3f" strokeWidth="4" fill="none" />
                <path d="M86 116 l16 0 l-8 10 z" fill="#fdfcf8" />
                <circle cx="140" cy="164" r="3" fill="#1d2b3f" />
              </>
            )}
            {costume === 'hoodie' && (
              <>
                <rect x="20" y="60" width="200" height="140" fill="#e07a5f" />
                <path d="M70 146 h66 a10 10 0 0 1 10 10 v30 h-86 v-30 a10 10 0 0 1 10 -10 z" fill="#c9644b" />
                <path d="M158 118 L156 144 M170 114 L172 140" stroke="#fff6ea" strokeWidth="3" strokeLinecap="round" />
                <circle cx="156" cy="146" r="3" fill="#fff6ea" />
                <circle cx="172" cy="142" r="3" fill="#fff6ea" />
              </>
            )}
            {costume === 'coder' && (
              <>
                <rect x="20" y="60" width="200" height="140" fill="#1f2937" />
                <text x="84" y="146" fontFamily="monospace" fontSize="26" fontWeight="bold" fill="#6ee7b7">
                  {'</>'}
                </text>
              </>
            )}
            {costume === 'wizard' && (
              <>
                <rect x="20" y="60" width="200" height="140" fill="#5b3fa0" />
                <path d="M150 90 L130 200" stroke="#f5c542" strokeWidth="5" />
                <text x="70" y="130" fontSize="18" fill="#f5c542">✦</text>
                <text x="96" y="168" fontSize="13" fill="#f5c542">✦</text>
                <text x="52" y="160" fontSize="11" fill="#f5c542">✦</text>
              </>
            )}
            {costume === 'explorer' && (
              <>
                <path d="M60 86 L150 170" stroke="#2f6146" strokeWidth="11" />
                <path d="M128 100 L176 124 L170 132 L126 110 Z" fill="#e9b949" />
              </>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Head */}
      <circle cx="170" cy="92" r="28" fill={FEATHER} />
      <path d="M192 96 Q218 110 232 150 Q229 153 226 150 Q212 118 190 105 Z" fill="#e9cf9f" />
      <ellipse cx="172" cy="102" rx="7" ry="4" fill="#f4a38c" opacity="0.6" />
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ scaleY: [1, 1, 0.1, 1] }}
        transition={{ duration: 0.25, times: [0, 0.5, 0.75, 1], repeat: Infinity, repeatDelay: 3.2 }}
      >
        <circle cx="178" cy="86" r="5.5" fill="#1f140d" />
        <circle cx="180" cy="84" r="1.8" fill="#fff" />
      </motion.g>

      {/* Head pieces */}
      <AnimatePresence>
        {costume === 'hoodie' && (
          <motion.path
            key="hood-rim"
            d="M142 76 A32 32 0 0 1 196 70"
            stroke="#c9644b"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            {...piece}
            style={pieceStyle}
          />
        )}
        {costume === 'suit' && (
          <motion.path
            key="tie"
            d="M146 108 L156 111 L154 140 L148 150 L143 139 Z"
            fill="#c0392b"
            {...piece}
            style={pieceStyle}
          />
        )}
        {costume === 'coder' && (
          <motion.g key="headphones" {...piece} style={pieceStyle}>
            <path d="M146 90 A26 26 0 0 1 192 70" stroke="#2d2d2d" strokeWidth="6" fill="none" strokeLinecap="round" />
            <ellipse cx="150" cy="96" rx="9" ry="12" fill="#2d2d2d" />
            <ellipse cx="150" cy="96" rx="4" ry="6" fill="#6ee7b7" />
            <circle cx="179" cy="87" r="10" stroke="#2d2d2d" strokeWidth="3" fill="#cfefff" fillOpacity="0.25" />
            <path d="M189 86 l6 -2" stroke="#2d2d2d" strokeWidth="3" />
          </motion.g>
        )}
        {costume === 'wizard' && (
          <motion.g key="wizard-hat" {...piece} style={pieceStyle}>
            <path d="M148 70 L192 68 Q180 36 184 8 Q160 30 148 70 Z" fill="#5b3fa0" />
            <ellipse cx="170" cy="70" rx="32" ry="7" fill="#4a3285" />
            <text x="160" y="54" fontSize="12" fill="#f5c542">✦</text>
            <circle cx="184" cy="8" r="4" fill="#f5c542" />
          </motion.g>
        )}
        {costume === 'explorer' && (
          <motion.g key="explorer-hat" {...piece} style={pieceStyle}>
            <ellipse cx="170" cy="70" rx="36" ry="8" fill="#c9a36b" />
            <path d="M150 70 Q150 46 170 46 Q190 46 190 70 Z" fill="#d9b67f" />
            <rect x="150" y="62" width="40" height="6" fill="#7a5a2e" />
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );
}
