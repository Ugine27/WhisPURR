import { Briefcase, Calendar, Code2, Coffee, GitBranch, Instagram, Linkedin, Mail, MessageCircle, Music2, Presentation, Terminal, type LucideIcon } from 'lucide-react';

/*
 * Everything the onboarding flow shows, in one place. Swap any image by
 * changing its path; drop high-resolution files into /public/assets.
 */

export const ASSETS = {
  intro: '/assets/intro-pixel.png',
  world: '/assets/world-bg.jpg',
  worldAspect: 1024 / 572, // width / height of the world image, for placing hotspots
};

export type HubId = 'office' | 'cafe' | 'developer';

export interface Hub {
  id: HubId;
  label: string;
  icon: LucideIcon;
  // Hotspot centre over the world image, in % of its width and height.
  spot: { x: number; y: number };
  // Interior background. null zooms into the building on the world image instead.
  interior: string | null;
  kivi: {
    src: string;
    // true while the image still has its studio backdrop: it gets a soft
    // matte so the backdrop melts into the scene. Use false for a real cutout.
    matte: boolean;
    flip: boolean; // mirror so Kivi faces the settings card
  };
  accent: string;
  mode: string; // dictation mode this persona switches to
  apps: { icon: LucideIcon; name: string }[];
  example: { said: string; written: string };
  rules: string[];
}

export const HUBS: Hub[] = [
  {
    id: 'office',
    label: 'Office',
    icon: Briefcase,
    spot: { x: 17.5, y: 64 },
    interior: null, // '/assets/office-bg.jpg'
    kivi: { src: '/assets/kivi-suit.jpg', matte: true, flip: false },
    accent: '#cfe3ff',
    mode: 'Formal',
    apps: [
      { icon: Mail, name: 'Mail' },
      { icon: Linkedin, name: 'LinkedIn' },
      { icon: Calendar, name: 'Calendar' },
      { icon: Presentation, name: 'Slides' },
    ],
    example: { said: 'hey bro let meet', written: 'Could we schedule a meeting?' },
    rules: ['No emojis', 'Keep it under three sentences', "Sign off with 'Best regards'"],
  },
  {
    id: 'cafe',
    label: 'Café',
    icon: Coffee,
    spot: { x: 54.5, y: 62 },
    interior: null, // '/assets/cafe-bg.jpg'
    kivi: { src: '/assets/kivi-casual.jpg', matte: true, flip: true },
    accent: '#ffc27a',
    mode: 'Casual',
    apps: [
      { icon: MessageCircle, name: 'Messages' },
      { icon: Instagram, name: 'Instagram' },
      { icon: Music2, name: 'Music' },
    ],
    example: { said: 'can u pick me up at 6', written: 'Hey! Could you grab me at 6? 🙂' },
    rules: ['Emojis are welcome', 'Keep it light and friendly'],
  },
  {
    id: 'developer',
    label: 'Developer Room',
    icon: Code2,
    spot: { x: 85.5, y: 63 },
    interior: null, // '/assets/dev-bg.jpg'
    kivi: { src: '/assets/kivi-dev.jpg', matte: true, flip: false },
    accent: '#8dffb8',
    mode: 'Developer',
    apps: [
      { icon: GitBranch, name: 'GitHub' },
      { icon: Terminal, name: 'Terminal' },
      { icon: Code2, name: 'Editor' },
    ],
    example: { said: 'the login thing broke again', written: 'fix(auth): login fails on session refresh' },
    rules: ['Use conventional commit style', 'Keep code identifiers exactly as said'],
  },
];

export const hubById = (id: HubId) => HUBS.find((h) => h.id === id)!;

// Shared motion curves.
export const EASE_IN: [number, number, number, number] = [0.64, 0, 0.78, 0]; // accelerating
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]; // settling
export const HUB_ZOOM = 2.6; // how far the world zooms into a building

export const preloadAll = () => {
  [ASSETS.world, ...HUBS.flatMap((h) => [h.kivi.src, h.interior].filter(Boolean) as string[])].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
