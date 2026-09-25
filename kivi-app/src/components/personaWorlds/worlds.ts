import { transformLocally } from '../styles/StylesData';

export type WorldId = 'office' | 'cafe' | 'developer';

export interface World {
  id: WorldId;
  label: string;
  sub: string;
  mode: string; // the dictation mode this world switches Kivi to
  style: string; // the StylesData style used for live rewrites
  tint: string; // rim light on Kivi while it stands in this world
  sample: string;
  // Curated rewrites of `sample`: [casual, balanced, formal] x [brief, detailed].
  lines: [string, string][];
}

export const WORLDS: World[] = [
  {
    id: 'office',
    label: 'Office',
    sub: 'clear · polished',
    mode: 'Formal',
    style: 'Professional',
    tint: '#ffcf8a',
    sample: "hey sorry I couldn't finish this today I'll send it tomorrow",
    lines: [
      ["Couldn't wrap up today, will send tomorrow.", "Sorry I couldn't wrap this up today — I'll send it over tomorrow."],
      ['Not finished today. Sending tomorrow.', "Apologies, I couldn't finish this today. I'll send it tomorrow."],
      ['Unable to finalise today. Will deliver tomorrow.', "Apologies — I wasn't able to complete this today. I will send it to you first thing tomorrow."],
    ],
  },
  {
    id: 'cafe',
    label: 'Café',
    sub: 'relaxed · natural',
    mode: 'Casual',
    style: 'Casual',
    tint: '#f2a664',
    sample: "wanna grab coffee later I'm free after 4",
    lines: [
      ['coffee later? free after 4 ☕', "Wanna grab a coffee later? I'm free any time after 4 ☕"],
      ["Coffee later? I'm free after 4!", "Want to grab a coffee later? I'm free after 4 if you are!"],
      ['Coffee later? Free after 4.', "Would you like to get a coffee later? I'm free from 4 o'clock onwards."],
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    sub: 'precise · technical',
    mode: 'Developer',
    style: 'Technical',
    tint: '#a4e35a',
    sample: 'the login thing is broken again can someone look at the auth stuff',
    lines: [
      ['login broke again, can someone check auth?', 'Login is broken again 😅 can someone dig into the auth service?'],
      ['fix(auth): login failing again', 'Login is failing again — could someone investigate the auth service?'],
      ['Bug: login failure (auth).', 'Bug report: login is failing again. Root cause is likely in the auth service; please investigate.'],
    ],
  },
];

export function worldForMode(mode: string): number {
  const m = mode.toLowerCase();
  if (m === 'formal' || m === 'professional') return 0;
  if (m === 'casual') return 1;
  if (m === 'developer' || m === 'technical') return 2;
  return -1;
}

// tone and length run 0..100, like the StylesData sliders.
export function rewrite(world: World, input: string, tone: number, length: number): string {
  if (input.trim() === world.sample) {
    const row = world.lines[tone < 35 ? 0 : tone > 65 ? 2 : 1];
    return row[length < 50 ? 0 : 1];
  }
  return transformLocally(input, world.style, tone, length);
}
