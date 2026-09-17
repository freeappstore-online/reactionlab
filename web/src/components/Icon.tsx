export type IconName =
  | 'home'
  | 'history'
  | 'settings'
  | 'info'
  | 'bolt'
  | 'target'
  | 'hand'
  | 'crosshair'
  | 'flame'
  | 'trophy'
  | 'trash'
  | 'download'
  | 'play'
  | 'repeat'
  | 'chevron';

/** Single-path 24x24 stroke icons — no icon dependency, no runtime cost. */
const PATHS: Readonly<Record<IconName, string>> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3.5 2',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15h-.3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.5 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3 1z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.6v.1',
  bolt: 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  hand: 'M6 11V6.5a1.5 1.5 0 0 1 3 0V11m0 0V4.5a1.5 1.5 0 0 1 3 0V11m0 0V5.5a1.5 1.5 0 0 1 3 0V11m0 0V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2.5a1.5 1.5 0 0 1 3 0',
  crosshair: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 2v4M12 18v4M2 12h4M18 12h4',
  flame: 'M12 22c3.9 0 6.5-2.6 6.5-6.2 0-4.4-4-6-4.5-10.8-2 1.4-3.2 3.4-3.2 5.4 0 1.3-.8 2-1.6 2-.9 0-1.4-.7-1.4-1.8C6.4 12.2 5.5 13.6 5.5 16c0 3.5 2.6 6 6.5 6z',
  trophy:
    'M8 4h8v5a4 4 0 1 1-8 0zM8 5H5.5a2.5 2.5 0 0 0 2.5 5M16 5h2.5a2.5 2.5 0 0 1-2.5 5M12 13v4M9 21h6M10 21v-2.5c0-.8.7-1.5 1.5-1.5h1c.8 0 1.5.7 1.5 1.5V21',
  trash: 'M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v5M14 11v5',
  download: 'M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19h16',
  play: 'M7 4.5 19 12 7 19.5z',
  repeat: 'M4 9a7 7 0 0 1 12-4M20 15a7 7 0 0 1-12 4M4 5v4h4M20 19v-4h-4',
  chevron: 'm9 6 6 6-6 6',
};

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({ name, size = 20 }: IconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
