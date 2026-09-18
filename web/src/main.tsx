import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import { App } from './App';
import { registerServiceWorker } from './registerSW';

const container = document.getElementById('root');
if (container === null) throw new Error('Root container #root is missing from index.html');

container.replaceChildren();
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
