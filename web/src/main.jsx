import { createRoot } from 'react-dom/client';
import { App } from './presentation/App.jsx';
import './presentation/styles/app.css';

// El service worker permite abrir la app sin Internet.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')).render(<App />);
