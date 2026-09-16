import type { CSSProperties } from 'react';
import { sanitizeHtml } from '../lib/richText';

export interface RichTextViewProps {
  html: string | null | undefined;
  lineClamp?: number;
  style?: CSSProperties;
  className?: string;
}

export function RichTextView({ html, lineClamp, style, className }: RichTextViewProps) {
  return (
    <div
      className={`rich-text-view${className ? ` ${className}` : ''}`}
      style={{
        ...(lineClamp
          ? {
              display: '-webkit-box',
              WebkitLineClamp: lineClamp,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }
          : {}),
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
