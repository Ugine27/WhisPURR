import { DEFAULT_STYLES, StyleItem } from '../styles/StylesData';

export type StationKind = 'tower' | 'cafe' | 'monolith' | 'campfire' | 'workshop';

export interface IslandPersona extends StyleItem {
  accent: string;
  kind: StationKind;
  place: string; // what the station on the island is called
}

const LOOK: Record<string, { accent: string; kind: StationKind; place: string }> = {
  professional: { accent: '#6f9bd8', kind: 'tower', place: 'The Glass Tower' },
  casual: { accent: '#e88fa9', kind: 'cafe', place: 'The Corner Café' },
  concise: { accent: '#e0a73e', kind: 'monolith', place: 'The Monolith' },
  warm: { accent: '#ec7d4a', kind: 'campfire', place: 'The Campfire' },
  technical: { accent: '#4fb393', kind: 'workshop', place: 'The Workshop' },
};

export const ISLAND_PERSONAS: IslandPersona[] = DEFAULT_STYLES.filter((s) => LOOK[s.id]).map((s) => ({ ...s, ...LOOK[s.id] }));

// Stations sit on a ring; station i faces the camera when the island is turned by -i * STEP.
export const STEP = (Math.PI * 2) / ISLAND_PERSONAS.length;
export const RING = 3.6;
export const TOP = 0.25; // height of the island's grass surface
