// Simple, recognisable app marks drawn inline (no text labels on screen).
// Unknown apps fall back to a lettered tile.

const tile = (bg: string, children: React.ReactNode) => (
  <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
    <rect x="2" y="2" width="36" height="36" rx="9" fill={bg} />
    {children}
  </svg>
);

const ICONS: Record<string, () => JSX.Element> = {
  Outlook: () =>
    tile(
      '#0a64c9',
      <>
        <rect x="9" y="12" width="22" height="16" rx="2" fill="#fff" />
        <path d="M9.5 13 20 21l10.5-8" stroke="#0a64c9" strokeWidth="2" fill="none" />
      </>,
    ),
  Teams: () =>
    tile(
      '#5b5fc7',
      <>
        <circle cx="27" cy="13" r="3.5" fill="#c5c7f7" />
        <rect x="9" y="11" width="16" height="18" rx="3" fill="#fff" />
        <path d="M13 16h8M17 16v9" stroke="#5b5fc7" strokeWidth="2.4" strokeLinecap="round" />
      </>,
    ),
  Word: () => tile('#1e5ab8', <path d="M11 13l3 14 4-10 4 10 3-14" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />),
  Excel: () => tile('#107c41', <path d="M13 13l14 14M27 13 13 27" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />),
  PowerPoint: () =>
    tile(
      '#c43e1c',
      <>
        <path d="M15 28V12h6a5 5 0 0 1 0 10h-6" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  Slack: () => (
    <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="9" fill="#fff" />
      <rect x="17" y="8" width="5" height="13" rx="2.5" fill="#36c5f0" />
      <rect x="19" y="17" width="13" height="5" rx="2.5" fill="#2eb67d" />
      <rect x="18" y="19" width="5" height="13" rx="2.5" fill="#ecb22e" />
      <rect x="8" y="18" width="13" height="5" rx="2.5" fill="#e01e5a" />
    </svg>
  ),
  iMessage: () =>
    tile(
      '#34c759',
      <path d="M20 11c-6.1 0-11 3.9-11 8.8 0 2.8 1.6 5.2 4.1 6.8L12 30l4.6-2.3c1 .2 2.2.4 3.4.4 6.1 0 11-3.9 11-8.8S26.1 11 20 11Z" fill="#fff" />,
    ),
  Discord: () =>
    tile(
      '#5865f2',
      <>
        <path d="M12 14c3-1.6 13-1.6 16 0 2 4 2.6 8 2.2 12-2.2 1.6-4.4 2.4-6.2 2.6l-1.4-2.2c-1.7.4-3.5.4-5.2 0L16 28.6c-1.8-.2-4-1-6.2-2.6-.4-4 .2-8 2.2-12Z" fill="#fff" />
        <circle cx="16.3" cy="21" r="1.8" fill="#5865f2" />
        <circle cx="23.7" cy="21" r="1.8" fill="#5865f2" />
      </>,
    ),
  WhatsApp: () =>
    tile(
      '#25d366',
      <>
        <path d="M20 10a10 10 0 0 0-8.6 15.1L10 30l5-1.3A10 10 0 1 0 20 10Z" fill="#fff" />
        <path d="M16 16.5c.3 2.9 4.1 6.8 7.3 7.2l1.6-1.6-2.1-1.3-1 1c-1.4-.6-2.6-1.8-3.2-3.2l1-1-1.3-2.1Z" fill="#25d366" />
      </>,
    ),
  'VS Code': () =>
    tile(
      '#1f7ad1',
      <>
        <path d="M26 9l5 2.5v17L26 31 13 20Z" fill="#fff" opacity="0.95" />
        <path d="M26 9 13 20l-4-3v6l4-3 13 11" stroke="#1f7ad1" strokeWidth="1.6" fill="none" />
      </>,
    ),
  Terminal: () =>
    tile(
      '#1d1f24',
      <>
        <path d="M11 15l5 5-5 5" stroke="#7dd3c0" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 26h9" stroke="#e8e4dc" strokeWidth="2.6" strokeLinecap="round" />
      </>,
    ),
  GitHub: () =>
    tile(
      '#24292f',
      <path
        d="M20 9a11 11 0 0 0-3.5 21.4c.6.1.8-.2.8-.5v-2c-3.1.7-3.7-1.3-3.7-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.4-.3-5-1.2-5-5.4 0-1.2.4-2.2 1.1-2.9-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.3 10.3 0 0 1 5.4 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.7 1.1 2.9 0 4.2-2.6 5.1-5 5.4.4.3.8 1 .8 2v3c0 .3.2.6.8.5A11 11 0 0 0 20 9Z"
        fill="#fff"
      />,
    ),
  'Stack Overflow': () => (
    <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="9" fill="#fff" />
      <path d="M11 22v8h17v-8" stroke="#bcbbbb" strokeWidth="2.4" fill="none" />
      <path d="M15 26h9M15.3 22.4l8.8 1.3M16.3 18.4l8.2 3.3M18.2 14.6l7.3 4.9M21.3 11.2l5.6 6.6" stroke="#f48024" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
};

export const KNOWN_APPS = Object.keys(ICONS);

export default function AppIcon({ app }: { app: string }) {
  const Icon = ICONS[app];
  if (Icon) return <Icon />;
  return tile(
    '#e8e2d6',
    <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#5d4037">
      {app.slice(0, 1).toUpperCase()}
    </text>,
  );
}
