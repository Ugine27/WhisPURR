import type { SVGProps } from 'react';

/*
 * Full-colour app logos for the persona cards, as inline SVG (no requests).
 * Multi-colour marks (Gmail, Slack, LinkedIn, Figma, Instagram, the Google
 * apps) are drawn here; single-colour marks use the CC0 paths from
 * simple-icons (https://simpleicons.org), laid over a white shape where the
 * mark is cut out of a badge so it reads in full colour on dark glass.
 */

export type BrandId =
  | 'gmail' | 'slack' | 'linkedin' | 'gcal' | 'slides' | 'docs' | 'meet' | 'messages' | 'telegram'
  | 'instagram' | 'x' | 'youtube' | 'spotify' | 'github' | 'terminal' | 'editor' | 'figma';

type P = SVGProps<SVGSVGElement>;
const svg = (viewBox: string, body: JSX.Element) => (p: P) => (
  <svg viewBox={viewBox} aria-hidden {...p}>
    {body}
  </svg>
);

const SI = {
  telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  spotify: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  messages: 'M5.285 0A5.273 5.273 0 0 0 0 5.285v13.43A5.273 5.273 0 0 0 5.285 24h13.43A5.273 5.273 0 0 0 24 18.715V5.285A5.273 5.273 0 0 0 18.715 0ZM12 4.154a8.809 7.337 0 0 1 8.809 7.338A8.809 7.337 0 0 1 12 18.828a8.809 7.337 0 0 1-2.492-.303A8.656 7.337 0 0 1 5.93 19.93a9.929 7.337 0 0 0 1.54-2.155 8.809 7.337 0 0 1-4.279-6.283A8.809 7.337 0 0 1 12 4.154',
};

const doc = (fill: string, inner: JSX.Element) => (
  <>
    <path d="M6 1h8.5L20 6.5V21a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill={fill} />
    <path d="M14.5 1 20 6.5h-4a1.5 1.5 0 0 1-1.5-1.5z" fill="#fff" opacity="0.45" />
    {inner}
  </>
);

export const BRANDS: Record<BrandId, (p: P) => JSX.Element> = {
  gmail: svg(
    '52 42 88 66',
    <>
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </>,
  ),
  slack: svg(
    '0 0 127 127',
    <>
      <path fill="#E01E5A" d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" />
      <path fill="#36C5F0" d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z" />
      <path fill="#2EB67D" d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z" />
      <path fill="#ECB22E" d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" />
    </>,
  ),
  linkedin: svg(
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <circle cx="7" cy="7.1" r="1.6" fill="#fff" />
      <rect x="5.6" y="9.6" width="2.8" height="8.8" rx=".3" fill="#fff" />
      <path fill="#fff" d="M10.6 9.6h2.7v1.2c.4-.8 1.4-1.4 2.8-1.4 2.6 0 3.4 1.7 3.4 4v5h-2.8v-4.4c0-1.1-.2-2-1.4-2s-1.9.9-1.9 2v4.4h-2.8z" />
    </>,
  ),
  gcal: svg(
    '0 0 24 24',
    <>
      <path d="M4 1h16a3 3 0 0 1 3 3v12l-7 7H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" fill="#fff" />
      <path d="M4 1h16a3 3 0 0 1 3 3v2.5H1V4a3 3 0 0 1 3-3z" fill="#4285F4" />
      <path d="M23 16h-5a2 2 0 0 0-2 2v5z" fill="#EA4335" />
      <path d="M1 16v4a3 3 0 0 0 3 3h12v-4H5a1 1 0 0 1-1-1v-2z" fill="#34A853" opacity=".9" />
      <text x="11.6" y="17" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif" fill="#1A73E8">31</text>
    </>,
  ),
  slides: svg('0 0 24 24', doc('#FBBC04', <rect x="7.5" y="10.5" width="9" height="6.5" rx=".8" fill="none" stroke="#fff" strokeWidth="1.6" />)),
  docs: svg(
    '0 0 24 24',
    doc(
      '#4285F4',
      <g fill="#fff">
        <rect x="7.5" y="10.5" width="9" height="1.4" rx=".5" />
        <rect x="7.5" y="13.3" width="9" height="1.4" rx=".5" />
        <rect x="7.5" y="16.1" width="6" height="1.4" rx=".5" />
      </g>,
    ),
  ),
  meet: svg(
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5.5" fill="#0B5CFF" />
      <rect x="4.5" y="8" width="10.5" height="8" rx="2" fill="#fff" />
      <path d="M16 11.2l3.5-2.4v6.4L16 12.8z" fill="#fff" />
    </>,
  ),
  messages: svg(
    '0 0 24 24',
    <>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#fff" />
      <path fill="#34DA50" d={SI.messages} />
    </>,
  ),
  telegram: svg(
    '0 0 24 24',
    <>
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <path fill="#26A5E4" d={SI.telegram} />
    </>,
  ),
  instagram: svg(
    '0 0 24 24',
    <>
      <defs>
        <radialGradient id="ig-grad" cx="0.28" cy="1.05" r="1.25">
          <stop offset="0" stopColor="#FFD776" />
          <stop offset="0.25" stopColor="#F3A554" />
          <stop offset="0.5" stopColor="#F13F79" />
          <stop offset="0.75" stopColor="#C62FA8" />
          <stop offset="1" stopColor="#5B4FE0" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </>,
  ),
  x: svg(
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5" fill="#000" />
      <path fill="#fff" d={SI.x} transform="translate(5 5) scale(.583)" />
    </>,
  ),
  youtube: svg(
    '0 0 24 24',
    <>
      <path d="M9 8h7v8H9z" fill="#fff" />
      <path fill="#FF0000" d={SI.youtube} />
    </>,
  ),
  spotify: svg(
    '0 0 24 24',
    <>
      <circle cx="12" cy="12" r="11" fill="#000" />
      <path fill="#1ED760" d={SI.spotify} />
    </>,
  ),
  github: svg('0 0 24 24', <path fill="#fff" d={SI.github} />),
  terminal: svg(
    '0 0 24 24',
    <>
      <rect x="1" y="3" width="22" height="18" rx="3.5" fill="#1E1E1E" stroke="#3a3a3a" />
      <path d="M5.5 9l3.5 3-3.5 3" fill="none" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="10.5" y="14.2" width="6" height="1.8" rx=".6" fill="#E5E5E5" />
    </>,
  ),
  editor: svg(
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5" fill="#1F6FEB" />
      <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  figma: svg(
    '-9.5 0 57 57',
    <>
      <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
      <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
      <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
      <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
    </>,
  ),
};

export function BrandIcon({ id, ...p }: P & { id: BrandId }) {
  const Logo = BRANDS[id];
  return <Logo {...p} />;
}
