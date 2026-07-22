import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { registerAuthWithApiClient, registerCrossTabAuth } from '@/modules/auth';

import { App } from './App';

import '@/styles/global.css';

// Wires the auth store into the shared apiClient (token attach + silent
// refresh + forced logout) before any request can fire.
registerAuthWithApiClient();

// Lets this tab hand off its session to a freshly opened sibling tab (and
// vice versa) over BroadcastChannel, and mirrors an explicit logout across
// tabs — see `authTabSync.ts`. Tokens still never touch localStorage.
registerCrossTabAuth();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element (#root) not found — check index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
