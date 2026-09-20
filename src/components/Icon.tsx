import type { CSSProperties } from 'react'

const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  wallet: <><path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" /><path d="M20 12h-5v5h5M16 14.5h.01" /></>,
  chart: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 16v-4M12 16V8M17 16v-6" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-5h6v5M8 7h1M15 7h1M8 11h1M15 11h1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 16V3M7 8l5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  filter: <><path d="M3 6h18M6 12h12M9 18h6" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /></>,
  refresh: <><path d="M20 7a9 9 0 1 0 1 9M20 3v5h-5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
} as const

export type IconName = keyof typeof paths

export default function Icon({ name, size = 20, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className={className} style={style}>{paths[name]}</svg>
}
