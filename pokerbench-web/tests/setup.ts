import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver which is not available in JSDOM
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

// Mock next/router or other global dependencies if needed
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '',
}));

// Suppress React Three Fiber warnings in JSDOM/RTL tests
// These tags are valid in R3F but unknown to React DOM
const suppressedWarnings = [
  'incorrect casing',
  'unrecognized in this browser',
  'non-boolean attribute',
  'PascalCase',
];

const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && suppressedWarnings.some(w => args[0].includes(w))) return;
  originalError(...args);
};

console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && suppressedWarnings.some(w => args[0].includes(w))) return;
  originalWarn(...args);
};
