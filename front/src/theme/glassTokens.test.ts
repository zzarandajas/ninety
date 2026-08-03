import { describe, expect, it } from 'vitest';
import { glassThemeConfig } from './glassTokens';

describe('glassThemeConfig', () => {
  it('sets colorBgContainer to the glass primary surface token', () => {
    expect(glassThemeConfig.token?.colorBgContainer).toBe('rgba(255, 255, 255, 0.92)');
  });

  it('sets a border radius consistent with the glass-panel CSS class', () => {
    expect(glassThemeConfig.token?.borderRadius).toBe(12);
  });
});
