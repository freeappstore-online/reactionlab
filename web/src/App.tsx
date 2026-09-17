import { useEffect } from 'react';
import { Shell } from './components/Shell';
import { useRoute } from './hooks/useRoute';
import { HomeView } from './views/HomeView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';
import { TestView } from './views/TestView';

export function App(): React.ReactElement {
  const [route, navigate] = useRoute();

  // Each screen is its own page as far as the reader is concerned.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <Shell route={route}>
      {route.name === 'home' && (
        <HomeView
          onOpenTest={(mode) => {
            navigate({ name: 'test', mode });
          }}
        />
      )}

      {route.name === 'test' && (
        <TestView
          key={route.mode}
          mode={route.mode}
          onHome={() => {
            navigate({ name: 'home' });
          }}
          onHistory={() => {
            navigate({ name: 'history' });
          }}
        />
      )}

      {route.name === 'history' && <HistoryView />}
      {route.name === 'settings' && <SettingsView />}
      {route.name === 'about' && <AboutView />}
    </Shell>
  );
}
