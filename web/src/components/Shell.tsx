import { MODE_META } from '../modes';
import { TEST_MODES } from '../types';
import { pathFor } from '../hooks/useRoute';
import type { Route } from '../hooks/useRoute';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { TestMode } from '../types';

export const MODE_ICON: Readonly<Record<TestMode, IconName>> = {
  simple: 'bolt',
  choice: 'target',
  gonogo: 'hand',
  aim: 'crosshair',
};

interface NavItem {
  readonly route: Route;
  readonly label: string;
  readonly icon: IconName;
}

const PRIMARY_NAV: readonly NavItem[] = [
  { route: { name: 'home' }, label: 'Home', icon: 'home' },
  { route: { name: 'history' }, label: 'History', icon: 'history' },
  { route: { name: 'settings' }, label: 'Settings', icon: 'settings' },
  { route: { name: 'about' }, label: 'About', icon: 'info' },
];

function isCurrent(route: Route, target: Route): boolean {
  if (route.name !== target.name) return false;
  if (route.name === 'test' && target.name === 'test') return route.mode === target.mode;
  return true;
}

interface ShellProps {
  readonly route: Route;
  readonly children: React.ReactNode;
}

export function Shell({ route, children }: ShellProps): React.ReactElement {
  return (
    <div className="app">
      <header className="appbar">
        <span className="appbar__mark">
          <Mark />
          ReactionLab
        </span>
        <span className="appbar__spacer" />
        <span className="badge">{routeTitle(route)}</span>
      </header>

      <aside className="sidebar">
        <span className="sidebar__mark">
          <Mark />
          ReactionLab
        </span>

        <nav className="sidebar__group" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <a
              key={item.label}
              className="sidebar__link"
              href={pathFor(item.route)}
              aria-current={isCurrent(route, item.route) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </a>
          ))}
        </nav>

        <nav className="sidebar__group" aria-label="Tests">
          <span className="sidebar__label">Tests</span>
          {TEST_MODES.map((mode) => (
            <a
              key={mode}
              className="sidebar__link"
              href={pathFor({ name: 'test', mode })}
              aria-current={isCurrent(route, { name: 'test', mode }) ? 'page' : undefined}
            >
              <Icon name={MODE_ICON[mode]} size={18} />
              {MODE_META[mode].name}
            </a>
          ))}
        </nav>

        <p className="sidebar__foot">
          Everything you record stays in this browser. No accounts, no network, no tracking.
          <br />
          <a href="https://freeappstore.online" rel="noopener noreferrer">
            Built for freeappstore.online
          </a>
        </p>
      </aside>

      <main className="main">{children}</main>

      <nav className="dock" aria-label="Main">
        {PRIMARY_NAV.map((item) => (
          <a
            key={item.label}
            className="dock__link"
            href={pathFor(item.route)}
            aria-current={isCurrent(route, item.route) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function routeTitle(route: Route): string {
  switch (route.name) {
    case 'home':
      return 'Tests';
    case 'test':
      return MODE_META[route.mode].name;
    case 'history':
      return 'History';
    case 'settings':
      return 'Settings';
    case 'about':
      return 'About';
  }
}

function Mark(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.3" />
      <path d="M35 12 22 35h9l-3 17 14-24h-9z" fill="var(--accent)" />
    </svg>
  );
}
