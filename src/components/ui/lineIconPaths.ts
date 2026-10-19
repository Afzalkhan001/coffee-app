/**
 * Glyph data for <LineIcon /> (pure: no React / RN imports, so it can be previewed and unit-tested).
 *
 * Grid: 24×24 viewBox, content kept inside ~2.5–21.5. Strokes are drawn with round caps and joins
 * at 1.75 units (see LineIcon), the same soft, slightly hand-drawn language as the 64-unit
 * `lineArtPaths` illustrations: rounded corners, bowed lines, curls of steam, no hard mitres.
 *
 * A glyph is a list of stroke paths plus optional filled dots (info/alert/chat dots) and an optional
 * `solid` outline that is filled when the icon is asked for its filled variant (rating stars).
 */

export interface LineGlyph {
  /** Stroked paths (fill none). */
  readonly d: readonly string[];
  /** Small filled circles: [cx, cy, r]. Always filled with the icon colour. */
  readonly dots?: readonly (readonly [number, number, number])[];
  /** Paths that get a fill when `filled` is requested (e.g. rating stars). */
  readonly solid?: readonly string[];
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** Full circle as a path (two arcs), so every glyph is made of <Path> only. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)} A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)} Z`;
}

/** Rounded star (5 points) — joins are softened by the round line join. */
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Cog: `teeth` trapezoid teeth on a base circle (arcs between teeth). */
function gearPath(cx: number, cy: number, outer: number, base: number, teeth: number): string {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (r: number, deg: number) => `${n(cx + r * Math.cos(rad(deg)))} ${n(cy + r * Math.sin(rad(deg)))}`;
  const step = 360 / teeth;
  const baseHalf = step * 0.27;
  const tipHalf = step * 0.17;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const c = -90 + i * step;
    const start = at(base, c - baseHalf);
    d += i === 0 ? `M${start}` : ` A${n(base)} ${n(base)} 0 0 1 ${start}`;
    d += ` L${at(outer, c - tipHalf)} L${at(outer, c + tipHalf)} L${at(base, c + baseHalf)}`;
  }
  d += ` A${n(base)} ${n(base)} 0 0 1 ${at(base, -90 - baseHalf)} Z`;
  return d;
}

/** Scale + translate an absolute-coordinate path (M/L/C/Q only: every number pair is x y). */
function transformPath(d: string, scale: number, dx: number, dy: number): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => {
    const v = Number(m);
    const out = i % 2 === 0 ? v * scale + dx : v * scale + dy;
    i += 1;
    return n(out);
  });
}

// Shared parts ──────────────────────────────────────────────────────────────
const CUP_BODY = 'M4.5 9.75 H16.5 V13.75 C16.5 17 13.81 19.6 10.5 19.6 C7.19 19.6 4.5 17 4.5 13.75 Z';
const CUP_HANDLE = 'M16.5 11.25 H17.6 C18.92 11.25 20 12.26 20 13.5 C20 14.74 18.92 15.75 17.6 15.75 H16.2';
const CUP_SAUCER = 'M3.25 21.35 C6.25 21.95 14.75 21.95 17.75 21.35';
const STEAM_L = 'M8.6 3.1 C7.95 3.85 7.95 4.65 8.6 5.4 C9.25 6.15 9.25 6.95 8.6 7.7';
const STEAM_R = 'M12.4 3.1 C11.75 3.85 11.75 4.65 12.4 5.4 C13.05 6.15 13.05 6.95 12.4 7.7';

const BAG_BODY =
  'M5.6 8.25 H18.4 C18.98 8.25 19.43 8.74 19.39 9.32 L18.62 19.07 C18.56 19.88 17.88 20.5 17.07 20.5 H6.93 C6.12 20.5 5.44 19.88 5.38 19.07 L4.61 9.32 C4.57 8.74 5.02 8.25 5.6 8.25 Z';
const BAG_HANDLE = 'M8.75 10.75 V7 C8.75 5.21 10.21 3.75 12 3.75 C13.79 3.75 15.25 5.21 15.25 7 V10.75';

const BELL_BODY =
  'M5.25 17.25 C6.35 16.4 6.75 15.2 6.75 13.25 V10.75 C6.75 7.85 9.1 5.5 12 5.5 C14.9 5.5 17.25 7.85 17.25 10.75 V13.25 C17.25 15.2 17.65 16.4 18.75 17.25 Z';
const BELL_CLAPPER = 'M10 19.75 C10.35 20.65 11.1 21.15 12 21.15 C12.9 21.15 13.65 20.65 14 19.75';

const GIFT: LineGlyph = {
  d: [
    'M4.25 8.75 H19.75 C20.3 8.75 20.75 9.2 20.75 9.75 V11.25 C20.75 11.8 20.3 12.25 19.75 12.25 H4.25 C3.7 12.25 3.25 11.8 3.25 11.25 V9.75 C3.25 9.2 3.7 8.75 4.25 8.75 Z',
    'M4.75 12.25 V19 C4.75 19.83 5.42 20.5 6.25 20.5 H17.75 C18.58 20.5 19.25 19.83 19.25 19 V12.25',
    'M12 8.75 V20.5',
    'M12 8.75 C10.6 8.75 7.75 8.35 7.75 6.5 C7.75 5.3 8.75 4.55 9.8 4.85 C11.2 5.25 11.85 7.2 12 8.75',
    'M12 8.75 C12.15 7.2 12.8 5.25 14.2 4.85 C15.25 4.55 16.25 5.3 16.25 6.5 C16.25 8.35 13.4 8.75 12 8.75',
  ],
};

const CUP: LineGlyph = { d: [CUP_BODY, CUP_HANDLE, CUP_SAUCER, STEAM_L, STEAM_R] };

const RING = circlePath(12, 12, 8.75);

// The croissant reuses the 64-unit illustration's main strokes (same silhouette as the empty states).
const CROISSANT_SRC = [
  'M6.4 45.8 C7 43.07 6.87 39.7 8.2 37.6 C9.53 35.5 12.33 34.67 14.4 33.2 C15.27 30.73 15.17 27.57 17 25.8 C18.83 24.03 22.6 23.67 25.4 22.6 C27.6 20.53 29.8 16.4 32 16.4 C34.2 16.4 36.4 20.53 38.6 22.6 C41.4 23.67 45.17 24.03 47 25.8 C48.83 27.57 48.73 30.73 49.6 33.2 C51.67 34.67 54.47 35.5 55.8 37.6 C57.13 39.7 57 43.07 57.6 45.8',
  'M57.6 45.8 C56 45.73 54.53 46.2 52.8 45.6 C51.07 45 49.07 43.33 47.2 42.2 C45.73 42 44.37 42.23 42.8 41.6 C41.23 40.97 39.47 39.47 37.8 38.4 C35.87 38.07 33.93 37.4 32 37.4 C30.07 37.4 28.13 38.07 26.2 38.4 C24.53 39.47 22.77 40.97 21.2 41.6 C19.63 42.23 18.27 42 16.8 42.2 C14.93 43.33 12.93 45 11.2 45.6 C9.47 46.2 8 45.73 6.4 45.8',
  'M25.4 22.6 C25.13 25.27 24.47 27.97 24.6 30.6 C24.73 33.23 25.67 35.8 26.2 38.4',
  'M38.6 22.6 C38.87 25.27 39.53 27.97 39.4 30.6 C39.27 33.23 38.33 35.8 37.8 38.4',
];

export const LINE_ICONS = {
  // ── Navigation ────────────────────────────────────────────
  home: {
    d: [
      'M3.25 11.25 L10.9 4.7 C11.53 4.16 12.47 4.16 13.1 4.7 L20.75 11.25',
      'M5.5 9.6 V18.5 C5.5 19.6 6.4 20.5 7.5 20.5 H16.5 C17.6 20.5 18.5 19.6 18.5 18.5 V9.6',
      'M10 20.5 V16.25 C10 15.15 10.9 14.25 12 14.25 C13.1 14.25 14 15.15 14 16.25 V20.5',
    ],
  },
  menu: CUP,
  orders: {
    d: [
      'M5.75 20.75 V5.25 C5.75 4.42 6.42 3.75 7.25 3.75 H16.75 C17.58 3.75 18.25 4.42 18.25 5.25 V20.75 L16.17 19.4 L14.08 20.75 L12 19.4 L9.92 20.75 L7.83 19.4 Z',
      'M9 8.25 H15',
      'M9 11.75 H15',
      'M9 15.25 H12.25',
    ],
  },
  rewards: GIFT,
  gift: GIFT,
  profile: {
    d: [circlePath(12, 7.9, 3.9), 'M4.75 20.25 C5.35 16.55 8.35 14.25 12 14.25 C15.65 14.25 18.65 16.55 19.25 20.25'],
  },

  // ── Header & commerce ─────────────────────────────────────
  bag: { d: [BAG_BODY, BAG_HANDLE] },
  search: { d: [circlePath(10.75, 10.75, 6.5), 'M15.6 15.6 L20.25 20.25'] },
  bell: { d: [BELL_BODY, BELL_CLAPPER, 'M12 5.5 V3.5'] },
  'bell-off': { d: [BELL_BODY, BELL_CLAPPER, 'M12 5.5 V3.5', 'M4 3.75 L20 20.25'] },
  pin: {
    d: [
      'M12 21.25 C12 21.25 5.25 15.4 5.25 10 C5.25 6.27 8.27 3.25 12 3.25 C15.73 3.25 18.75 6.27 18.75 10 C18.75 15.4 12 21.25 12 21.25 Z',
      circlePath(12, 10, 2.6),
    ],
  },
  store: {
    d: [
      'M3.5 9 L5.1 4.75 H18.9 L20.5 9',
      'M3.5 9 A2.13 2.13 0 0 0 7.75 9 A2.13 2.13 0 0 0 12 9 A2.13 2.13 0 0 0 16.25 9 A2.13 2.13 0 0 0 20.5 9',
      'M3.5 9 H20.5',
      'M5 11.4 V20.5 H19 V11.4',
      'M10 20.5 V16 C10 15.45 10.45 15 11 15 H13 C13.55 15 14 15.45 14 16 V20.5',
    ],
  },
  briefcase: {
    d: [
      'M5.75 7.5 H18.25 C19.35 7.5 20.25 8.4 20.25 9.5 V17.75 C20.25 18.85 19.35 19.75 18.25 19.75 H5.75 C4.65 19.75 3.75 18.85 3.75 17.75 V9.5 C3.75 8.4 4.65 7.5 5.75 7.5 Z',
      'M9 7.5 V5.75 C9 4.92 9.67 4.25 10.5 4.25 H13.5 C14.33 4.25 15 4.92 15 5.75 V7.5',
      'M3.75 12.4 C9.25 14.05 14.75 14.05 20.25 12.4',
      'M12 12.75 V14.75',
    ],
  },
  tag: {
    d: [
      'M3.75 4.75 V10.6 C3.75 11.13 3.96 11.64 4.34 12.01 L12.24 19.91 C13.02 20.69 14.29 20.69 15.07 19.91 L19.91 15.07 C20.69 14.29 20.69 13.02 19.91 12.24 L12.01 4.34 C11.64 3.96 11.13 3.75 10.6 3.75 H4.75 C4.2 3.75 3.75 4.2 3.75 4.75 Z',
      circlePath(8, 8, 1.5),
    ],
  },
  card: {
    d: [
      'M5 5.5 H19 C20.1 5.5 21 6.4 21 7.5 V16.5 C21 17.6 20.1 18.5 19 18.5 H5 C3.9 18.5 3 17.6 3 16.5 V7.5 C3 6.4 3.9 5.5 5 5.5 Z',
      'M3 9.75 H21',
      'M6.5 14.75 H10',
    ],
  },
  lock: {
    d: [
      'M8 10.5 V7.75 C8 5.54 9.79 3.75 12 3.75 C14.21 3.75 16 5.54 16 7.75 V10.5',
      'M7.25 10.5 H16.75 C17.85 10.5 18.75 11.4 18.75 12.5 V18.5 C18.75 19.6 17.85 20.5 16.75 20.5 H7.25 C6.15 20.5 5.25 19.6 5.25 18.5 V12.5 C5.25 11.4 6.15 10.5 7.25 10.5 Z',
      'M12 14.4 V16.6',
    ],
  },
  sparkle: {
    d: [
      'M10 3.25 C10.6 7.4 12.35 9.15 16.5 9.75 C12.35 10.35 10.6 12.1 10 16.25 C9.4 12.1 7.65 10.35 3.5 9.75 C7.65 9.15 9.4 7.4 10 3.25 Z',
      'M17.5 14 C17.75 15.8 18.45 16.5 20.25 16.75 C18.45 17 17.75 17.7 17.5 19.5 C17.25 17.7 16.55 17 14.75 16.75 C16.55 16.5 17.25 15.8 17.5 14 Z',
    ],
    dots: [[18.25, 5.5, 0.95]],
  },
  heart: {
    d: [
      'M12 20.25 C12 20.25 3.5 15.25 3.5 9.4 C3.5 6.69 5.6 4.6 8.15 4.6 C9.8 4.6 11.2 5.5 12 6.85 C12.8 5.5 14.2 4.6 15.85 4.6 C18.4 4.6 20.5 6.69 20.5 9.4 C20.5 15.25 12 20.25 12 20.25 Z',
    ],
    solid: [
      'M12 20.25 C12 20.25 3.5 15.25 3.5 9.4 C3.5 6.69 5.6 4.6 8.15 4.6 C9.8 4.6 11.2 5.5 12 6.85 C12.8 5.5 14.2 4.6 15.85 4.6 C18.4 4.6 20.5 6.69 20.5 9.4 C20.5 15.25 12 20.25 12 20.25 Z',
    ],
  },
  star: { d: [starPath(12, 12.6, 9.25, 4.35)], solid: [starPath(12, 12.6, 9.25, 4.35)] },
  clock: { d: [RING, 'M12 7.25 V12 L15.25 14'] },
  flame: {
    d: [
      'M12 21.25 C8.55 21.25 6 18.85 6 15.6 C6 12.45 8.2 10.85 9.2 8.4 C9.75 9.75 10.55 10.6 11.45 10.85 C11.1 7.75 12.35 4.85 14.85 3.25 C14.75 6.55 18 9.1 18 14.85 C18 18.6 15.45 21.25 12 21.25 Z',
      'M12 21.25 C10.55 21.25 9.5 20.15 9.5 18.7 C9.5 16.95 10.95 16.1 11.55 14.6 C12.85 15.65 14.5 16.7 14.5 18.7 C14.5 20.15 13.45 21.25 12 21.25',
    ],
  },
  leaf: {
    d: [
      'M4.75 19.25 C4.1 11.75 9.25 5.1 19.75 4.25 C20.4 14.35 13.9 19.9 4.75 19.25 Z',
      'M3.75 20.25 C7.6 16.4 11.1 12.9 14.75 9.25',
    ],
  },
  settings: { d: [gearPath(12, 12, 9.1, 6.9, 8), circlePath(12, 12, 2.85)] },
  // Dietary pills and the card face (were Ionicons fallbacks).
  sprout: {
    d: [
      'M12 20.75 V11.75',
      'M12 14.25 C12 10.85 9.55 8.4 5.25 8.4 C5.25 12.15 7.7 14.25 12 14.25 Z',
      'M12 11.75 C12 7.75 14.6 4.75 18.9 4.75 C18.9 9.05 16.3 11.75 12 11.75 Z',
    ],
  },
  drop: {
    d: [
      'M12 3.5 C12 3.5 5.75 10.1 5.75 14.4 C5.75 17.85 8.55 20.5 12 20.5 C15.45 20.5 18.25 17.85 18.25 14.4 C18.25 10.1 12 3.5 12 3.5 Z',
      'M9.1 14.9 C9.25 16.35 10.25 17.35 11.7 17.5',
    ],
  },
  ban: { d: [RING, 'M5.85 5.85 L18.15 18.15'] },
  bolt: { d: ['M13.4 3.25 L6 13.1 C5.8 13.37 5.99 13.75 6.33 13.75 H11.75 L10.6 20.75 L18 10.9 C18.2 10.63 18.01 10.25 17.67 10.25 H12.25 Z'] },
  contactless: {
    d: [
      'M7.4 9 C8.35 10.85 8.35 13.15 7.4 15',
      'M10.9 6.75 C12.95 9.9 12.95 14.1 10.9 17.25',
      'M14.4 4.5 C17.55 9.1 17.55 14.9 14.4 19.5',
    ],
  },

  // ── Utility ───────────────────────────────────────────────
  'chevron-down': { d: ['M6.5 9.25 L12 14.75 L17.5 9.25'] },
  'chevron-up': { d: ['M6.5 14.75 L12 9.25 L17.5 14.75'] },
  'chevron-forward': { d: ['M9.25 6.5 L14.75 12 L9.25 17.5'] },
  'chevron-back': { d: ['M14.75 6.5 L9.25 12 L14.75 17.5'] },
  back: { d: ['M19.25 12 H5', 'M10.5 6.5 L5 12 L10.5 17.5'] },
  'arrow-forward': { d: ['M4.75 12 H19', 'M13.5 6.5 L19 12 L13.5 17.5'] },
  plus: { d: ['M12 5.25 V18.75', 'M5.25 12 H18.75'] },
  minus: { d: ['M5.25 12 H18.75'] },
  close: { d: ['M6.5 6.5 L17.5 17.5', 'M17.5 6.5 L6.5 17.5'] },
  check: { d: ['M5.25 12.5 L9.75 17 L18.75 7.75'] },
  'check-circle': { d: [RING, 'M8.25 12.25 L10.85 14.85 L15.9 9.4'] },
  'close-circle': { d: [RING, 'M9.4 9.4 L14.6 14.6', 'M14.6 9.4 L9.4 14.6'] },
  info: { d: [RING, 'M12 11 V16.25'], dots: [[12, 7.9, 1.1]] },
  alert: { d: [RING, 'M12 7.25 V12.75'], dots: [[12, 16.25, 1.1]] },
  help: {
    d: [RING, 'M9.4 9.5 C9.6 8.1 10.7 7.25 12.05 7.25 C13.55 7.25 14.65 8.3 14.65 9.65 C14.65 11.4 12.1 11.6 12.1 13.5'],
    dots: [[12.1, 16.5, 1.1]],
  },
  edit: {
    d: [
      'M4.25 19.75 L5 15.9 L15.55 5.35 C16.33 4.57 17.6 4.57 18.38 5.35 L18.65 5.62 C19.43 6.4 19.43 7.67 18.65 8.45 L8.1 19 Z',
      'M13.75 7.15 L16.85 10.25',
    ],
  },
  trash: {
    d: [
      'M4.5 7 H19.5',
      'M9.5 7 V5.25 C9.5 4.7 9.95 4.25 10.5 4.25 H13.5 C14.05 4.25 14.5 4.7 14.5 5.25 V7',
      'M6.25 7 L7.1 18.9 C7.18 19.8 7.92 20.5 8.82 20.5 H15.18 C16.08 20.5 16.82 19.8 16.9 18.9 L17.75 7',
      'M10.25 10.75 V16.5',
      'M13.75 10.75 V16.5',
    ],
  },
  refresh: { d: ['M19.5 12 A7.5 7.5 0 1 1 17.3 6.7', 'M17.6 3.25 L17.3 6.7 L13.85 6.4'] },
  repeat: {
    d: [
      'M4.75 11 V9.75 C4.75 8.37 5.87 7.25 7.25 7.25 H19',
      'M16 4.25 L19 7.25 L16 10.25',
      'M19.25 13 V14.25 C19.25 15.63 18.13 16.75 16.75 16.75 H5',
      'M8 13.75 L5 16.75 L8 19.75',
    ],
  },
  swap: { d: ['M4.5 8.5 H19.5', 'M16 5 L19.5 8.5 L16 12', 'M19.5 15.5 H4.5', 'M8 12 L4.5 15.5 L8 19'] },
  navigate: { d: ['M20.25 3.75 L3.75 10.6 L11.1 12.9 L13.4 20.25 Z'] },
  'cloud-off': {
    d: [
      'M7 18.5 C4.79 18.5 3 16.71 3 14.5 C3 12.51 4.46 10.86 6.36 10.55 C6.95 7.68 9.48 5.5 12.5 5.5 C15.62 5.5 18.2 7.82 18.6 10.84 C20.27 11.27 21.5 12.79 21.5 14.6 C21.5 16.75 19.75 18.5 17.6 18.5 Z',
      'M4.25 3.75 L19.75 20.25',
    ],
  },
  logout: {
    d: [
      'M9.5 20.25 H6.25 C5.42 20.25 4.75 19.58 4.75 18.75 V5.25 C4.75 4.42 5.42 3.75 6.25 3.75 H9.5',
      'M10.5 12 H20',
      'M16.25 8.25 L20 12 L16.25 15.75',
    ],
  },
  phone: {
    d: [
      'M7.6 3.75 L9.9 4.2 L11.1 8.25 L9.1 9.9 C10.2 12.2 11.8 13.8 14.1 14.9 L15.75 12.9 L19.8 14.1 L20.25 16.4 C20.25 18.6 18.6 20.25 16.4 20.25 C9.4 20.25 3.75 14.6 3.75 7.6 C3.75 5.4 5.4 3.75 7.6 3.75 Z',
    ],
  },
  mail: {
    d: [
      'M5 5.5 H19 C20.1 5.5 21 6.4 21 7.5 V16.5 C21 17.6 20.1 18.5 19 18.5 H5 C3.9 18.5 3 17.6 3 16.5 V7.5 C3 6.4 3.9 5.5 5 5.5 Z',
      'M3.6 7.25 L12 12.75 L20.4 7.25',
    ],
  },
  shield: {
    d: ['M12 3.5 L19 6.25 V11.5 C19 15.75 16.1 19.1 12 20.5 C7.9 19.1 5 15.75 5 11.5 V6.25 Z', 'M8.9 12.1 L11.1 14.3 L15.2 10.2'],
  },
  chat: {
    d: [
      'M4 11.5 C4 7.36 7.58 4 12 4 C16.42 4 20 7.36 20 11.5 C20 15.64 16.42 19 12 19 C10.9 19 9.85 18.8 8.9 18.4 L4.75 19.75 L5.9 16.2 C4.7 14.9 4 13.27 4 11.5 Z',
    ],
    dots: [
      [8.5, 11.5, 1],
      [12, 11.5, 1],
      [15.5, 11.5, 1],
    ],
  },
  doc: {
    d: [
      'M7 3.75 H13.5 L18.5 8.75 V19 C18.5 19.97 17.72 20.75 16.75 20.75 H7.25 C6.28 20.75 5.5 19.97 5.5 19 V5.25 C5.5 4.42 6.17 3.75 7 3.75 Z',
      'M13.25 3.75 V8.25 C13.25 8.8 13.7 9.25 14.25 9.25 H18.5',
      'M8.75 13 H15.25',
      'M8.75 16.25 H13',
    ],
  },

  // ── Categories ────────────────────────────────────────────
  cup: CUP,
  matcha: {
    d: [
      'M3.25 12.75 H20.75 C20.75 17.17 17.17 20.5 12.75 20.5 H11.25 C6.83 20.5 3.25 17.17 3.25 12.75 Z',
      'M9.5 21.75 H14.5',
      'M19.25 2.75 L15.9 7.4',
      'M15.9 7.4 C13.9 8 12.6 9.75 12.5 12.75',
      'M15.9 7.4 C14.9 8.6 14.45 10.4 14.6 12.75',
      'M15.9 7.4 C16.45 8.75 16.85 10.5 16.7 12.75',
    ],
  },
  iced: {
    d: [
      'M5.75 4.25 H18.25 L16.6 19.35 C16.5 20.2 15.79 20.75 14.95 20.75 H9.05 C8.21 20.75 7.5 20.2 7.4 19.35 Z',
      'M8.5 10.1 L11.35 9.35 L12.1 12.2 L9.25 12.95 Z',
      'M12.6 13.45 L15.35 14.3 L14.5 17.05 L11.75 16.2 Z',
      'M13.6 10.6 L16.65 2.25',
    ],
  },
  breakfast: {
    d: [
      'M8.2 4.9 C10.6 3.4 14.2 4 15.7 5.9 C17.9 5.7 20.1 7.6 19.85 10.6 C19.7 12.6 20.75 14.4 19.4 16.6 C17.9 19.1 14.9 19.1 12.9 19.85 C10.5 20.75 6.7 20.3 5.3 17.6 C4.5 16.1 3.25 14.6 3.6 12 C3.9 9.6 4.9 8.4 5.8 7.2 C6.4 6.3 7.3 5.5 8.2 4.9 Z',
      circlePath(11.75, 12.25, 3.1),
      'M10.3 11.35 C10.5 10.8 10.95 10.4 11.5 10.3',
    ],
  },
  croissant: { d: CROISSANT_SRC.map((d) => transformPath(d, 0.36, 0.5, 1.6)) },
  cake: {
    d: [
      'M3.5 11.25 L17.25 5.75 L20.5 11.25',
      'M3.5 11.25 H20.5 V18.75 C20.5 19.3 20.05 19.75 19.5 19.75 H4.5 C3.95 19.75 3.5 19.3 3.5 18.75 Z',
      'M3.5 15.25 C6.5 14.6 9 15.9 12 15.25 C15 14.6 17.5 15.9 20.5 15.25',
      circlePath(12, 6.05, 1.6),
      'M12.45 4.5 C12.75 3.55 13.35 2.95 14.15 2.7',
    ],
  },

  // ── Ordering modes ────────────────────────────────────────
  'dine-in': {
    d: [
      'M3.25 11.75 H20.75',
      'M5.75 11.75 L4.75 20.75',
      'M18.25 11.75 L19.25 20.75',
      'M5.3 16 H18.7',
      'M8.75 6 H14.25 V8 C14.25 9.52 13.02 10.75 11.5 10.75 C9.98 10.75 8.75 9.52 8.75 8 Z',
      'M14.25 6.75 H14.75 C15.44 6.75 16 7.31 16 8 C16 8.69 15.44 9.25 14.75 9.25 H14.1',
      'M10.5 2.5 C10 3.05 10 3.6 10.5 4.15',
      'M12.5 2.5 C12 3.05 12 3.6 12.5 4.15',
    ],
  },
  pickup: { d: [BAG_BODY, BAG_HANDLE, 'M9.25 14.6 L11.1 16.45 L14.75 12.75'] },
  car: {
    d: [
      'M3 16.75 V13.9 C3 12.95 3.65 12.15 4.57 11.95 L7.1 11.4 L9.35 8.05 C9.72 7.5 10.34 7.15 11 7.15 H15.25 C15.92 7.15 16.55 7.48 16.92 8.04 L19.25 11.4 C20.3 11.62 21 12.5 21 13.55 V16.75',
      'M7.1 11.4 H19.25',
      'M13.1 7.3 V11.4',
      'M3 16.75 H4.95',
      'M10.05 16.75 H13.95',
      'M19.05 16.75 H21',
      circlePath(7.5, 16.75, 2.4),
      circlePath(16.5, 16.75, 2.4),
    ],
  },
  delivery: {
    d: [
      circlePath(6, 17.75, 2.4),
      circlePath(18.4, 17.75, 2.4),
      // raked fork from the bars to the front hub, with the curved leg shield hugging it
      'M14.6 6.5 L18.4 17.75',
      'M13.25 6.5 H16',
      'M12.2 15.4 C14.1 14.9 15.4 12.6 15.75 9.9',
      // rear cowl / seat flowing into the footboard
      'M3.1 16.1 C3.1 13.75 4.95 12.1 7.3 12.1 H10.9 C11.5 12.1 11.9 12.7 11.65 13.25 L10.75 15.4 H17.6',
      // insulated delivery box on the rack
      'M4 12.1 V8.25 C4 7.70 4.45 7.25 5 7.25 H8.75 C9.3 7.25 9.75 7.7 9.75 8.25 V12.1',
      'M5.6 9.4 H8.15',
    ],
  },
} satisfies Record<string, LineGlyph>;

export type LineIconName = keyof typeof LINE_ICONS;

export function isLineIconName(name: string): name is LineIconName {
  return Object.prototype.hasOwnProperty.call(LINE_ICONS, name);
}

/**
 * Ionicons names that render as a LineIcon instead (so every `<Icon name="…">` in the app picks up
 * the custom set without screen edits). `filled: true` keeps a solid fill (rating stars).
 */
export const IONICON_TO_LINE: Readonly<Record<string, { name: LineIconName; filled?: boolean }>> = {
  home: { name: 'home' },
  'home-outline': { name: 'home' },
  cafe: { name: 'cup' },
  'cafe-outline': { name: 'cup' },
  receipt: { name: 'orders' },
  'receipt-outline': { name: 'orders' },
  gift: { name: 'gift' },
  'gift-outline': { name: 'gift' },
  person: { name: 'profile' },
  'person-outline': { name: 'profile' },
  bag: { name: 'bag' },
  'bag-outline': { name: 'bag' },
  'bag-handle': { name: 'bag' },
  'bag-handle-outline': { name: 'bag' },
  cart: { name: 'bag' },
  'cart-outline': { name: 'bag' },
  'bag-check': { name: 'pickup' },
  'bag-check-outline': { name: 'pickup' },
  search: { name: 'search' },
  'search-outline': { name: 'search' },
  notifications: { name: 'bell' },
  'notifications-outline': { name: 'bell' },
  'notifications-off': { name: 'bell-off' },
  'notifications-off-outline': { name: 'bell-off' },
  location: { name: 'pin' },
  'location-outline': { name: 'pin' },
  storefront: { name: 'store' },
  briefcase: { name: 'briefcase' },
  'briefcase-outline': { name: 'briefcase' },
  'storefront-outline': { name: 'store' },
  pricetag: { name: 'tag' },
  'pricetag-outline': { name: 'tag' },
  card: { name: 'card' },
  'card-outline': { name: 'card' },
  'lock-closed': { name: 'lock' },
  'lock-closed-outline': { name: 'lock' },
  sparkles: { name: 'sparkle' },
  'sparkles-outline': { name: 'sparkle' },
  heart: { name: 'heart', filled: true },
  'heart-outline': { name: 'heart' },
  star: { name: 'star', filled: true },
  'star-outline': { name: 'star' },
  time: { name: 'clock' },
  'time-outline': { name: 'clock' },
  flame: { name: 'flame' },
  'flame-outline': { name: 'flame' },
  leaf: { name: 'leaf' },
  'leaf-outline': { name: 'leaf' },
  settings: { name: 'settings' },
  'settings-outline': { name: 'settings' },
  'chevron-down': { name: 'chevron-down' },
  'chevron-up': { name: 'chevron-up' },
  'chevron-forward': { name: 'chevron-forward' },
  'chevron-back': { name: 'chevron-back' },
  'arrow-back': { name: 'back' },
  'arrow-forward': { name: 'arrow-forward' },
  add: { name: 'plus' },
  remove: { name: 'minus' },
  close: { name: 'close' },
  checkmark: { name: 'check' },
  'checkmark-circle': { name: 'check-circle' },
  'checkmark-circle-outline': { name: 'check-circle' },
  'close-circle': { name: 'close-circle' },
  'close-circle-outline': { name: 'close-circle' },
  'information-circle': { name: 'info' },
  'information-circle-outline': { name: 'info' },
  'alert-circle': { name: 'alert' },
  'alert-circle-outline': { name: 'alert' },
  'help-circle-outline': { name: 'help' },
  'help-buoy-outline': { name: 'help' },
  create: { name: 'edit' },
  'create-outline': { name: 'edit' },
  'trash-outline': { name: 'trash' },
  refresh: { name: 'refresh' },
  'refresh-outline': { name: 'refresh' },
  repeat: { name: 'repeat' },
  'swap-horizontal': { name: 'swap' },
  navigate: { name: 'navigate' },
  'navigate-outline': { name: 'navigate' },
  'cloud-offline': { name: 'cloud-off' },
  'cloud-offline-outline': { name: 'cloud-off' },
  'log-out-outline': { name: 'logout' },
  call: { name: 'phone' },
  'call-outline': { name: 'phone' },
  mail: { name: 'mail' },
  'mail-outline': { name: 'mail' },
  'shield-checkmark': { name: 'shield' },
  'shield-checkmark-outline': { name: 'shield' },
  'chatbubble-ellipses-outline': { name: 'chat' },
  'document-text-outline': { name: 'doc' },
  restaurant: { name: 'dine-in' },
  'restaurant-outline': { name: 'dine-in' },
  car: { name: 'car' },
  'car-outline': { name: 'car' },
  'car-sport': { name: 'car' },
  'car-sport-outline': { name: 'car' },
  bicycle: { name: 'delivery' },
  'bicycle-outline': { name: 'delivery' },
};

/** Resolve any icon name (LineIcon name or a mapped Ionicons name) to a glyph, if the set has one. */
export function resolveLineIcon(name: string): { name: LineIconName; filled?: boolean } | null {
  // Ionicons semantics first: `star` / `heart` are filled glyphs there (rating chips), `*-outline` are not.
  const mapped = IONICON_TO_LINE[name];
  if (mapped) return mapped;
  return isLineIconName(name) ? { name } : null;
}

/**
 * Stroke width in viewBox units for a requested px size: 1.75 at 24px, a touch heavier when the
 * icon is drawn small (so 14–16px chips stay crisp) and a touch lighter when large.
 */
export function lineIconStroke(size: number, strokeWidth = 1.75): number {
  const ratio = 24 / Math.max(8, size);
  const k = ratio > 1 ? Math.min(Math.pow(ratio, 0.55), 1.45) : Math.pow(ratio, 0.35);
  return Math.round(strokeWidth * k * 100) / 100;
}
