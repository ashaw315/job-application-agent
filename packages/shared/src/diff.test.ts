import { describe, it, expect } from 'vitest';
import { computeWordDiff } from './diff';

describe('computeWordDiff', () => {
  it('returns unchanged for identical texts', () => {
    const result = computeWordDiff('Hello world', 'Hello world');

    expect(result).toEqual([
      { type: 'unchanged', value: 'Hello' },
      { type: 'unchanged', value: ' ' },
      { type: 'unchanged', value: 'world' },
    ]);
  });

  it('detects word additions', () => {
    const result = computeWordDiff('Hello world', 'Hello beautiful world');

    expect(result).toContainEqual({ type: 'added', value: 'beautiful' });
    expect(result).toContainEqual({ type: 'unchanged', value: 'Hello' });
    expect(result).toContainEqual({ type: 'unchanged', value: 'world' });
  });

  it('detects word removals', () => {
    const result = computeWordDiff('Hello beautiful world', 'Hello world');

    expect(result).toContainEqual({ type: 'removed', value: 'beautiful' });
    expect(result).toContainEqual({ type: 'unchanged', value: 'Hello' });
    expect(result).toContainEqual({ type: 'unchanged', value: 'world' });
  });

  it('detects word replacements', () => {
    const result = computeWordDiff('Hello world', 'Hello universe');

    expect(result).toContainEqual({ type: 'unchanged', value: 'Hello' });
    expect(result).toContainEqual({ type: 'removed', value: 'world' });
    expect(result).toContainEqual({ type: 'added', value: 'universe' });
  });

  it('handles empty original text', () => {
    const result = computeWordDiff('', 'Hello world');

    expect(result).toEqual([
      { type: 'added', value: 'Hello' },
      { type: 'added', value: ' ' },
      { type: 'added', value: 'world' },
    ]);
  });

  it('handles empty modified text', () => {
    const result = computeWordDiff('Hello world', '');

    expect(result).toEqual([
      { type: 'removed', value: 'Hello' },
      { type: 'removed', value: ' ' },
      { type: 'removed', value: 'world' },
    ]);
  });

  it('preserves whitespace in diff', () => {
    const result = computeWordDiff('Hello  world', 'Hello world');

    // Should detect the change in whitespace
    expect(result.some((r) => r.type === 'removed' || r.type === 'added')).toBe(
      true
    );
  });
});
