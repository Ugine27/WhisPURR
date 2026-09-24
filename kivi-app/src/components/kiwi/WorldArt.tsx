import { motion } from 'framer-motion';

export type HubPlace = 'office' | 'cafe' | 'studio' | 'tower' | 'park';

// Deterministic scatter so decorations don't jump between renders.
const scatter = (count: number, seed: number, w: number, h: number) =>
  Array.from({ length: count }, (_, i) => ({
    x: ((i + 1) * 137 * seed) % w,
    y: ((i + 1) * 89 * seed) % h,
    r: 1 + ((i * seed) % 3),
    d: 1.5 + ((i * 7) % 5) * 0.4,
  }));

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fffaf2" opacity="0.9">
      <ellipse cx="0" cy="0" rx="60" ry="22" />
      <circle cx="-22" cy="-12" r="22" />
      <circle cx="16" cy="-18" r="28" />
    </g>
  );
}

function Tree({ x, y, s = 1, tone = '#5c9e5a' }: { x: number; y: number; s?: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="-10" width="10" height="34" fill="#7a5230" />
      <circle cx="0" cy="-30" r="28" fill={tone} />
      <circle cx="-18" cy="-18" r="18" fill={tone} />
      <circle cx="18" cy="-18" r="18" fill={tone} />
    </g>
  );
}

export function WorldBackdrop() {
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="world-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe8c7" />
          <stop offset="0.6" stopColor="#ffd3ab" />
          <stop offset="1" stopColor="#f9bf9f" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#world-sky)" />
      <circle cx="930" cy="150" r="120" fill="#fff3d6" opacity="0.35" />
      <circle cx="930" cy="150" r="66" fill="#fff6e0" />
      <motion.g animate={{ x: [-30, 30] }} transition={{ duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
        <Cloud x={200} y={120} />
        <Cloud x={620} y={80} s={0.8} />
        <Cloud x={1080} y={200} s={0.7} />
      </motion.g>
      <path d="M0 330 Q150 260 320 310 T640 300 T960 290 T1200 310 L1200 700 L0 700Z" fill="#c3d9a6" />
      <path d="M0 400 Q200 330 420 390 T820 370 T1200 380 L1200 700 L0 700Z" fill="#9dc48a" />
      <path d="M0 500 Q300 450 600 490 T1200 480 L1200 700 L0 700Z" fill="#7cae6f" />
      <path
        d="M600 720 C560 640 420 620 400 560 S520 460 640 440 S860 400 1020 430"
        stroke="#f3dcae"
        strokeWidth="24"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <Tree x={90} y={420} s={0.8} tone="#6aa865" />
      <Tree x={470} y={370} s={0.6} tone="#78b36e" />
      <Tree x={1140} y={440} s={0.9} tone="#5c9e5a" />
      <Tree x={760} y={560} s={0.7} tone="#6aa865" />
      {scatter(26, 7, 1200, 180).map((f, i) => (
        <circle key={i} cx={f.x} cy={520 + f.y} r={f.r + 1.5} fill={i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#f4a3b5' : '#fffaf2'} />
      ))}
    </svg>
  );
}

export function HubBuilding({ place, className }: { place: HubPlace; className?: string }) {
  return (
    <svg viewBox="0 0 120 130" className={className} aria-hidden="true">
      <ellipse cx="60" cy="124" rx="48" ry="6" fill="#000" opacity="0.12" />
      {place === 'office' && (
        <g>
          <line x1="60" y1="20" x2="60" y2="4" stroke="#4a6a9c" strokeWidth="3" />
          <circle cx="60" cy="4" r="3" fill="#e63946" />
          <rect x="30" y="20" width="60" height="102" rx="4" fill="#5b7db1" />
          <rect x="74" y="20" width="16" height="102" fill="#4a6a9c" />
          {Array.from({ length: 18 }, (_, i) => (
            <rect
              key={i}
              x={37 + (i % 3) * 14}
              y={28 + Math.floor(i / 3) * 12}
              width="9"
              height="8"
              rx="1"
              fill={i % 4 === 1 ? '#ffe9a8' : '#dbe8ff'}
            />
          ))}
          <rect x="52" y="104" width="16" height="18" fill="#34496b" />
        </g>
      )}
      {place === 'cafe' && (
        <g>
          <path d="M12 62 L60 30 L108 62Z" fill="#b5533c" />
          <rect x="18" y="60" width="84" height="62" rx="3" fill="#f3d9b1" />
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <rect x={18 + i * 14} y="62" width="14" height="14" fill={i % 2 ? '#fff6ea' : '#e76f51'} />
              <circle cx={25 + i * 14} cy="76" r="7" fill={i % 2 ? '#fff6ea' : '#e76f51'} />
            </g>
          ))}
          <rect x="26" y="88" width="30" height="20" rx="2" fill="#ffd98a" />
          <rect x="68" y="88" width="24" height="34" rx="2" fill="#8b5a3c" />
          <circle cx="60" cy="48" r="9" fill="#fff6ea" />
          <path d="M55 45 h9 v5 a4 4 0 0 1 -9 0 z M64 46 a2.5 2.5 0 0 1 0 4" fill="#8b5a3c" stroke="#8b5a3c" strokeWidth="1" />
          <motion.path
            d="M40 28 q4 -6 0 -12 q-4 -6 0 -12"
            stroke="#fffaf2"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            animate={{ opacity: [0, 0.9, 0], y: [4, -4, -10] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
        </g>
      )}
      {place === 'studio' && (
        <g>
          <line x1="86" y1="44" x2="96" y2="22" stroke="#3c4a63" strokeWidth="3" />
          <ellipse cx="98" cy="20" rx="10" ry="5" fill="#93c5fd" transform="rotate(-25 98 20)" />
          <path d="M14 122 L14 78 Q60 26 106 78 L106 122Z" fill="#3c4a63" />
          <rect x="32" y="74" width="56" height="32" rx="3" fill="#0f1a2b" />
          <motion.g animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
            <rect x="37" y="80" width="26" height="3" rx="1.5" fill="#6ee7b7" />
            <rect x="41" y="87" width="34" height="3" rx="1.5" fill="#93c5fd" />
            <rect x="41" y="94" width="18" height="3" rx="1.5" fill="#fca5a5" />
            <rect x="37" y="100" width="28" height="3" rx="1.5" fill="#6ee7b7" />
          </motion.g>
          <rect x="52" y="110" width="16" height="12" fill="#26324a" />
        </g>
      )}
      {place === 'tower' && (
        <g>
          <rect x="40" y="44" width="40" height="78" fill="#b8a7df" />
          <path d="M40 64 h40 M40 84 h40 M40 104 h40 M52 44 v20 M68 64 v20 M52 84 v20 M68 104 v18" stroke="#a08ed0" strokeWidth="1.5" />
          <path d="M32 46 L60 4 L88 46Z" fill="#5b3fa0" />
          <path d="M52 76 a8 8 0 0 1 16 0 v14 h-16z" fill="#ffe38a" />
          <motion.text
            x="60"
            y="8"
            textAnchor="middle"
            fontSize="14"
            fill="#f5c542"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            ✦
          </motion.text>
          <rect x="54" y="106" width="12" height="16" rx="6" fill="#4a3285" />
        </g>
      )}
      {place === 'park' && (
        <g>
          <rect x="54" y="68" width="12" height="54" fill="#7a5230" />
          <circle cx="60" cy="46" r="32" fill="#5c9e5a" />
          <circle cx="36" cy="60" r="20" fill="#6fb46a" />
          <circle cx="84" cy="60" r="20" fill="#6fb46a" />
          <circle cx="48" cy="38" r="4" fill="#f4a3b5" />
          <circle cx="74" cy="52" r="4" fill="#ffd166" />
          <rect x="72" y="104" width="36" height="5" rx="2" fill="#a86b3c" />
          <path d="M76 109 v13 M104 109 v13" stroke="#7a5230" strokeWidth="3" />
          <circle cx="20" cy="118" r="3" fill="#f4a3b5" />
          <circle cx="30" cy="120" r="3" fill="#ffd166" />
        </g>
      )}
    </svg>
  );
}

function Stars({ count, seed }: { count: number; seed: number }) {
  return (
    <>
      {scatter(count, seed, 1200, 420).map((s, i) => (
        <motion.circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#fff8e1"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: s.d, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </>
  );
}

export function HubInterior({ place }: { place: HubPlace }) {
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      {place === 'office' && (
        <g>
          <defs>
            <linearGradient id="office-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a9cbf2" />
              <stop offset="1" stopColor="#e6f0fb" />
            </linearGradient>
          </defs>
          <rect width="1200" height="700" fill="#e9eef6" />
          <rect x="140" y="70" width="560" height="350" fill="url(#office-sky)" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={160 + i * 76} y={250 - (i % 3) * 50} width="56" height={170 + (i % 3) * 50} fill={i % 2 ? '#9fb6d6' : '#8aa6cc'} />
          ))}
          <path d="M140 70 h560 v350 h-560 z M420 70 v350 M140 245 h560" stroke="#fdfdfd" strokeWidth="12" fill="none" />
          <circle cx="960" cy="150" r="42" fill="#fdfdfd" stroke="#5b7db1" strokeWidth="6" />
          <path d="M960 150 v-26 M960 150 l18 10" stroke="#2c3e57" strokeWidth="5" strokeLinecap="round" />
          <rect y="520" width="1200" height="180" fill="#cdb89a" />
          <rect x="740" y="430" width="380" height="22" rx="4" fill="#6d4c3d" />
          <path d="M770 452 v90 M1090 452 v90" stroke="#5a3d31" strokeWidth="14" />
          <rect x="820" y="320" width="170" height="105" rx="8" fill="#2c3e57" />
          <rect x="832" y="332" width="146" height="81" rx="4" fill="#9cc3f0" />
          <rect x="892" y="425" width="30" height="8" fill="#2c3e57" />
          <path d="M1050 430 l-10 -40 h44 l-10 40z" fill="#c26a4a" />
          <circle cx="1062" cy="370" r="24" fill="#5c9e5a" />
        </g>
      )}
      {place === 'cafe' && (
        <g>
          <rect width="1200" height="700" fill="#f7e2c4" />
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={(i % 10) * 130 + (Math.floor(i / 10) % 2) * 65} y={40 + Math.floor(i / 10) * 44} width="110" height="30" rx="4" fill="#efd3ae" />
          ))}
          <rect x="110" y="200" width="300" height="190" rx="10" fill="#3b3b36" stroke="#8b5a3c" strokeWidth="10" />
          <path d="M150 250 h120 M150 290 h200 M150 330 h90" stroke="#f4efe6" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
          {[260, 600, 940].map((x) => (
            <g key={x}>
              <line x1={x} y1="0" x2={x} y2="150" stroke="#5d3a24" strokeWidth="4" />
              <motion.circle
                cx={x}
                cy="180"
                r="70"
                fill="#ffd98a"
                animate={{ opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <path d={`M${x - 36} 180 Q${x} 130 ${x + 36} 180 Z`} fill="#b5533c" />
            </g>
          ))}
          <rect y="560" width="1200" height="140" fill="#a47148" />
          <rect x="660" y="420" width="560" height="150" fill="#8b5a3c" />
          <rect x="650" y="408" width="580" height="18" rx="4" fill="#5d3a24" />
          <rect x="1000" y="320" width="110" height="88" rx="10" fill="#c7c9cc" />
          <rect x="1020" y="340" width="70" height="30" rx="4" fill="#3b3b36" />
          {[720, 800, 880].map((x) => (
            <g key={x}>
              <path d={`M${x} 370 h40 v26 a20 20 0 0 1 -40 0 z`} fill="#fff6ea" />
              <path d={`M${x + 40} 378 a10 10 0 0 1 0 18`} stroke="#fff6ea" strokeWidth="6" fill="none" />
              <motion.path
                d={`M${x + 20} 360 q8 -12 0 -24 q-8 -12 0 -24`}
                stroke="#fffaf2"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                animate={{ opacity: [0, 0.8, 0], y: [6, -6, -16] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: (x - 720) / 200 }}
              />
            </g>
          ))}
          <path d="M60 560 l-16 -70 h72 l-16 70z" fill="#c26a4a" />
          <circle cx="80" cy="460" r="46" fill="#5c9e5a" />
        </g>
      )}
      {place === 'studio' && (
        <g>
          <rect width="1200" height="700" fill="#161d2b" />
          <motion.line
            x1="0"
            y1="90"
            x2="1200"
            y2="90"
            stroke="#6ee7b7"
            strokeWidth="6"
            animate={{ opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          {[
            { x: 90, y: 200, w: 300, h: 190 },
            { x: 820, y: 170, w: 320, h: 210 },
          ].map((m, mi) => (
            <g key={mi}>
              <rect x={m.x - 14} y={m.y - 14} width={m.w + 28} height={m.h + 28} rx="14" fill="#232d42" />
              <rect x={m.x} y={m.y} width={m.w} height={m.h} rx="6" fill="#0b1220" />
              {Array.from({ length: 7 }, (_, i) => (
                <motion.rect
                  key={i}
                  x={m.x + 20 + (i % 3) * 20}
                  y={m.y + 20 + i * 24}
                  height="10"
                  rx="5"
                  fill={['#6ee7b7', '#93c5fd', '#fca5a5', '#fcd34d'][(i + mi) % 4]}
                  initial={{ width: 0 }}
                  animate={{ width: 60 + ((i * 53 + mi * 31) % (m.w - 120)) }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.12 + mi * 0.4 }}
                />
              ))}
              <rect x={m.x + m.w / 2 - 20} y={m.y + m.h + 14} width="40" height="46" fill="#232d42" />
            </g>
          ))}
          <rect y="480" width="1200" height="220" fill="#0f141f" />
          <rect x="40" y="440" width="1120" height="26" rx="6" fill="#2a3448" />
          <path d="M1040 440 q0 -30 24 -30 q12 0 16 10 l14 -2 l-8 10 q4 12 -16 12 z" fill="#fcd34d" />
          <circle cx="1068" cy="420" r="3" fill="#161d2b" />
        </g>
      )}
      {place === 'tower' && (
        <g>
          <defs>
            <linearGradient id="tower-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22164a" />
              <stop offset="1" stopColor="#4b3190" />
            </linearGradient>
          </defs>
          <rect width="1200" height="700" fill="url(#tower-sky)" />
          <Stars count={60} seed={11} />
          <circle cx="880" cy="160" r="64" fill="#fff3c4" />
          <circle cx="905" cy="140" r="12" fill="#f1e2a6" />
          <circle cx="862" cy="180" r="8" fill="#f1e2a6" />
          {[0, 1].map((side) => (
            <g key={side} transform={side ? 'translate(1200 0) scale(-1 1)' : undefined}>
              <rect x="0" y="180" width="190" height="400" fill="#2d1f5c" />
              {[0, 1, 2, 3].map((row) =>
                Array.from({ length: 8 }, (_, i) => (
                  <rect
                    key={`${row}-${i}`}
                    x={14 + i * 21}
                    y={200 + row * 96 + ((i * 7) % 16)}
                    width="16"
                    height={70 - ((i * 7) % 16)}
                    fill={['#c084fc', '#f5c542', '#93c5fd', '#f4a3b5', '#6ee7b7'][(i + row) % 5]}
                    opacity="0.85"
                  />
                )),
              )}
            </g>
          ))}
          <rect y="580" width="1200" height="120" fill="#1c1240" />
          <rect x="890" y="480" width="70" height="100" rx="6" fill="#3a2a70" />
          <motion.circle
            cx="925"
            cy="450"
            r="40"
            fill="#c4b5fd"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </g>
      )}
      {place === 'park' && (
        <g>
          <defs>
            <linearGradient id="park-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bfe3ff" />
              <stop offset="1" stopColor="#eef8ff" />
            </linearGradient>
          </defs>
          <rect width="1200" height="700" fill="url(#park-sky)" />
          <circle cx="1000" cy="130" r="60" fill="#ffe08a" />
          <motion.g animate={{ x: [-40, 40] }} transition={{ duration: 16, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
            <Cloud x={260} y={120} />
            <Cloud x={700} y={90} s={0.8} />
          </motion.g>
          <path d="M0 420 Q300 340 600 400 T1200 390 L1200 700 L0 700Z" fill="#9dd18c" />
          <path d="M0 520 Q400 470 800 510 T1200 500 L1200 700 L0 700Z" fill="#7cbf6d" />
          <Tree x={150} y={430} s={2.2} />
          <Tree x={1060} y={440} s={2} tone="#6fb46a" />
          <rect x="820" y="520" width="200" height="14" rx="5" fill="#a86b3c" />
          <rect x="820" y="490" width="200" height="12" rx="5" fill="#a86b3c" />
          <path d="M840 534 v40 M1000 534 v40" stroke="#7a5230" strokeWidth="8" />
          {scatter(30, 13, 1200, 150).map((f, i) => (
            <circle key={i} cx={f.x} cy={550 + f.y} r={f.r + 3} fill={i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#f4a3b5' : '#fffaf2'} />
          ))}
          {[0, 1].map((i) => (
            <motion.g
              key={i}
              animate={{ x: [0, 60, 0], y: [0, -30, 0] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.g
                animate={{ scaleX: [1, 0.3, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <ellipse cx={380 + i * 380} cy={260 + i * 40} rx="12" ry="8" fill={i ? '#f4a3b5' : '#c084fc'} />
                <ellipse cx={396 + i * 380} cy={260 + i * 40} rx="12" ry="8" fill={i ? '#f4a3b5' : '#c084fc'} />
              </motion.g>
            </motion.g>
          ))}
        </g>
      )}
    </svg>
  );
}
