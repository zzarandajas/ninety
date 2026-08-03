import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia. AntD's Grid/useBreakpoint (used by
// Row/Col, which Form.Item renders internally) calls it on mount, so every
// test that renders an AntD Form-based page needs this polyfill.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom does not implement URL.createObjectURL/revokeObjectURL either.
// AvatarUploader uses createObjectURL to preview the picked file before the
// upload request resolves, so tests that select a file need this polyfill.
if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-url';
}
if (typeof URL !== 'undefined' && !URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// jsdom does not implement ResizeObserver. @xyflow/react (org chart canvas)
// observes its container size on mount, so any test rendering it needs this.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
