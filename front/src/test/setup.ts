import '@testing-library/jest-dom/vitest';
import { createElement, type ChangeEvent } from 'react';
import { vi } from 'vitest';

// react-quill-new renders into a contentEditable div driven by the Quill
// engine, which jsdom cannot emulate faithfully (no selection/range APIs).
// Tests only care about the value/onChange/onBlur contract our
// RichTextEditor wrapper exposes, so swap in a plain textarea everywhere.
interface MockQuillProps {
  id?: string;
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: (previousSelection: null, source: 'user', editor: unknown) => void;
  placeholder?: string;
  readOnly?: boolean;
}

vi.mock('react-quill-new', () => ({
  default: ({ id, value, onChange, onBlur, placeholder, readOnly }: MockQuillProps) =>
    createElement('textarea', {
      id,
      value: value ?? '',
      onChange: (e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
      onBlur: () => onBlur?.(null, 'user', {}),
      placeholder,
      disabled: readOnly,
    }),
}));

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

// jsdom does not implement scrollIntoView. The L10 sidebar agenda nav calls
// it after switching sections, so any test that clicks through it needs this.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
