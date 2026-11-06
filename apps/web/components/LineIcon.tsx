// Site paletinde sade çizgi ikonlar (tek kalınlık)
const PATHS = {
  calendar: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.1 6.6 20l1-6.1-4.4-4.3 6.1-.9L12 3z',
  table: 'M3 9h18M5 9l-1 11M19 9l1 11M8 9V5h8v4',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  heart: 'M12 20s-8-4.9-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.1 12 20 12 20z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  gift: 'M4 11h16v10H4V11zM3 7h18v4H3V7zM12 7v14M12 7S10.5 3 8 3a2 2 0 000 4h4zM12 7s1.5-4 4-4a2 2 0 010 4h-4z',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
} as const;

export type LineIconName = keyof typeof PATHS;

export function LineIcon({ name, size = 24 }: { name: LineIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e8a27a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={PATHS[name]} />
    </svg>
  );
}
