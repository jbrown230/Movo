// Preparación de las pruebas de interfaz: lo que el navegador real tiene y jsdom no.
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

window.scrollTo = vi.fn();
window.matchMedia ??= (query) => ({
  matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
});
