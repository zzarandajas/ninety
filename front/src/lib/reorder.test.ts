import { describe, expect, it } from 'vitest';
import { reorderIds } from './reorder';

describe('reorderIds', () => {
  it('moves the active id to the position of the over id (moving down the list)', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves the active id to the position of the over id (moving up the list)', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same array reference-equal content when active and over are the same', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original list unchanged when activeId is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'missing', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original list unchanged when overId is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'missing')).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    reorderIds(input, 'a', 'c');
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
