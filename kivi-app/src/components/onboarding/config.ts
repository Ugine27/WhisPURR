import { Briefcase, Code2, Coffee, type LucideIcon } from 'lucide-react';
import type { BrandId } from './brands';

/*
 * Everything the onboarding flow shows, in one place. Swap any image by
 * changing its path; drop high-resolution files into /public/assets.
 */

export const ASSETS = {
  intro: '/assets/pixel-bg.png', // small dithered image, scaled up with crisp pixels
  // Kivi on the intro screen (waving), a transparent cutout.
  // `matte` softens a studio backdrop; only needed for images without transparency.
  kiviDefault: { src: '/assets/kivi-default.webp', matte: false },
  kiviAvatar: '/assets/kivi-avatar.svg', // small app-icon Kivi used on the persona cards
  world: '/assets/world-bg.jpg',
  worldAspect: 1024 / 572, // width / height of the world image, for placing hotspots
};

export type HubId = 'office' | 'cafe' | 'developer';

export interface App {
  brand: BrandId;
  name: string;
}

export interface Hub {
  id: HubId;
  label: string; // the place on the map
  persona: string; // the persona's name, shown on its card
  icon: LucideIcon;
  // Positions over the world image, in % of its width and height:
  //   spot  the building's centre (the zoom heads here)
  //   area  the building's footprint on screen (hovering it shows the label)
  //   pin   where the marker floats, just above the roofline
  spot: { x: number; y: number };
  area: { x: number; y: number; w: number; h: number };
  pin: { x: number; y: number };
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
  apps: App[];
  example: { said: string; written: string };
  rules: string[];
}

export const HUBS: Hub[] = [
  {
    id: 'office',
    label: 'Office',
    persona: 'Formal',
    icon: Briefcase,
    spot: { x: 17.5, y: 64 },
    area: { x: 0.5, y: 47, w: 35.5, h: 37 },
    pin: { x: 18, y: 39 },
    interior: null, // '/assets/office-bg.jpg'
    kivi: { src: '/assets/kivi-suit.jpg', matte: true, flip: false },
    accent: '#cfe3ff',
    mode: 'Formal',
    apps: [
      { brand: 'gmail', name: 'Gmail' },
      { brand: 'linkedin', name: 'LinkedIn' },
      { brand: 'gcal', name: 'Google Calendar' },
      { brand: 'slack', name: 'Slack' },
    ],
    example: { said: 'hey bro let meet', written: 'Could we schedule a meeting?' },
    rules: ['No emojis', 'Keep it under three sentences', "Sign off with 'Best regards'"],
  },
  {
    id: 'cafe',
    label: 'Café',
    persona: 'Casual',
    icon: Coffee,
    spot: { x: 54.5, y: 62 },
    area: { x: 39, y: 46, w: 32, h: 34 },
    pin: { x: 54.3, y: 38.5 },
    interior: null, // '/assets/cafe-bg.jpg'
    kivi: { src: '/assets/kivi-casual.jpg', matte: true, flip: true },
    accent: '#ffc27a',
    mode: 'Casual',
    apps: [
      { brand: 'messages', name: 'Messages' },
      { brand: 'instagram', name: 'Instagram' },
      { brand: 'spotify', name: 'Spotify' },
    ],
    example: { said: 'can u pick me up at 6', written: 'Hey! Could you grab me at 6? 🙂' },
    rules: ['Emojis are welcome', 'Keep it light and friendly'],
  },
  {
    id: 'developer',
    label: 'Developer Room',
    persona: 'Developer',
    icon: Code2,
    spot: { x: 85.5, y: 63 },
    area: { x: 73.5, y: 49.5, w: 24.5, h: 33 },
    pin: { x: 85.5, y: 42 },
    interior: null, // '/assets/dev-bg.jpg'
    kivi: { src: '/assets/kivi-dev.jpg', matte: true, flip: false },
    accent: '#8dffb8',
    mode: 'Developer',
    apps: [
      { brand: 'github', name: 'GitHub' },
      { brand: 'terminal', name: 'Terminal' },
      { brand: 'editor', name: 'Code editor' },
    ],
    example: { said: 'the login thing broke again', written: 'fix(auth): login fails on session refresh' },
    rules: ['Use conventional commit style', 'Keep code identifiers exactly as said'],
  },
];

// Apps a user can add to any persona with the + button.
export const APP_LIBRARY: App[] = [
  { brand: 'gmail', name: 'Gmail' },
  { brand: 'slack', name: 'Slack' },
  { brand: 'linkedin', name: 'LinkedIn' },
  { brand: 'gcal', name: 'Google Calendar' },
  { brand: 'slides', name: 'Google Slides' },
  { brand: 'docs', name: 'Google Docs' },
  { brand: 'meet', name: 'Zoom' },
  { brand: 'messages', name: 'Messages' },
  { brand: 'telegram', name: 'Telegram' },
  { brand: 'instagram', name: 'Instagram' },
  { brand: 'x', name: 'X' },
  { brand: 'youtube', name: 'YouTube' },
  { brand: 'spotify', name: 'Spotify' },
  { brand: 'github', name: 'GitHub' },
  { brand: 'terminal', name: 'Terminal' },
  { brand: 'editor', name: 'Code editor' },
  { brand: 'figma', name: 'Figma' },
];

export const hubById = (id: HubId) => HUBS.find((h) => h.id === id)!;

// Shared motion curves.
export const EASE_IN: [number, number, number, number] = [0.64, 0, 0.78, 0]; // accelerating
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]; // settling
export const HUB_ZOOM = 2.6; // how far the world zooms into a building

export const preloadAll = () => {
  [ASSETS.world, ASSETS.kiviDefault.src, ...HUBS.flatMap((h) => [h.kivi.src, h.interior].filter(Boolean) as string[])].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};
