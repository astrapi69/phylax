import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './features/theme';
// Side-effect import: initializes i18next synchronously with DE
// preloaded. EN resources lazy-load via the i18next backend and
// `import.meta.glob` defined in i18n/config.ts.
import i18n, { loadLanguageBundle, type SupportedLanguage } from './i18n/config';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element with id "root" not found. Check index.html.');
}

/**
 * Bootstrap: ensure the detected initial language has its namespaces
 * resolved before mounting React. For DE (preloaded) this is a no-op
 * micro-task; for EN this awaits a single parallel round of chunk
 * fetches so the first paint shows translated strings instead of raw
 * keys. Service worker precaches the chunks on first install, so
 * subsequent loads are instant.
 */
async function bootstrap(root: HTMLElement): Promise<void> {
  const detected = i18n.language as SupportedLanguage;
  if (detected !== 'de') {
    await loadLanguageBundle(detected);
  }
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ThemeProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );
}

void bootstrap(rootElement);
