import { describe, expect, it } from 'vitest';
import { isHtmlEmpty, sanitizeHtml, stripHtml } from './richText';

describe('richText', () => {
  describe('sanitizeHtml', () => {
    it('keeps allowed formatting tags', () => {
      expect(sanitizeHtml('<p><strong>Hola</strong> <em>mundo</em></p>')).toBe(
        '<p><strong>Hola</strong> <em>mundo</em></p>'
      );
    });

    it('keeps inline color/background styles', () => {
      const html = '<p><span style="color: rgb(255, 0, 0);">rojo</span></p>';
      expect(sanitizeHtml(html)).toContain('color: rgb(255, 0, 0)');
    });

    it('strips script tags and event handlers', () => {
      const html = '<p onclick="alert(1)">hola<script>alert(1)</script></p>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onclick');
    });

    it('returns empty string for null/undefined', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('removes all tags leaving plain text', () => {
      expect(stripHtml('<p><strong>Hola</strong> mundo</p>')).toBe('Hola mundo');
    });
  });

  describe('isHtmlEmpty', () => {
    it('treats Quill empty content as empty', () => {
      expect(isHtmlEmpty('<p><br></p>')).toBe(true);
    });

    it('treats null/undefined as empty', () => {
      expect(isHtmlEmpty(null)).toBe(true);
      expect(isHtmlEmpty(undefined)).toBe(true);
    });

    it('treats real content as non-empty', () => {
      expect(isHtmlEmpty('<p>Hola</p>')).toBe(false);
    });
  });
});
