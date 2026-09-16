import DOMPurify from 'dompurify';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'span', 'ol', 'ul', 'li'],
  ALLOWED_ATTR: ['style', 'class'],
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
}

export function isHtmlEmpty(html: string | null | undefined): boolean {
  return stripHtml(html).length === 0;
}
