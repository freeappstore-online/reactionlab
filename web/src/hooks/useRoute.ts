import { useCallback, useEffect, useState } from 'react';
import { isTestMode } from '../modes';
import type { TestMode } from '../types';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'test'; readonly mode: TestMode }
  | { readonly name: 'history' }
  | { readonly name: 'settings' }
  | { readonly name: 'about' };

export const HOME_PATH = '#/';

/** Hash routing keeps the app a single static file — no server rewrite rules. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  if (path === '') return { name: 'home' };

  const segments = path.split('/');
  const [head, tail] = segments;

  if (head === 'test' && tail !== undefined && isTestMode(tail)) {
    return { name: 'test', mode: tail };
  }
  if (head === 'history') return { name: 'history' };
  if (head === 'settings') return { name: 'settings' };
  if (head === 'about') return { name: 'about' };

  return { name: 'home' };
}

export function pathFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return HOME_PATH;
    case 'test':
      return `#/test/${route.mode}`;
    case 'history':
      return '#/history';
    case 'settings':
      return '#/settings';
    case 'about':
      return '#/about';
  }
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = (): void => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  const navigate = useCallback((next: Route) => {
    const target = pathFor(next);
    if (window.location.hash === target) {
      // Same hash: no `hashchange` will fire, so update directly.
      setRoute(next);
      return;
    }
    window.location.hash = target;
  }, []);

  return [route, navigate];
}
