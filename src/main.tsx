import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { registerAuthWithApiClient } from '@/modules/auth';

import { App } from './App';

import '@/styles/global.css';

// Wires the auth store into the shared apiClient (token attach + silent
// refresh + forced logout) before any request can fire.
registerAuthWithApiClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element (#root) not found — check index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
