/**
 * Diff utilities for comparing text versions
 * Pure functions with no framework dependencies
 */

export interface DiffResult {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

/**
 * Compute word-level diff between two texts
 * Returns array of diff segments for visualization
 *
 * Simple implementation for v0: splits on whitespace and compares words
 */
export function computeWordDiff(
  original: string,
  modified: string
): DiffResult[] {
  // Handle empty strings
  const originalWords = original ? original.split(/(\s+)/) : [];
  const modifiedWords = modified ? modified.split(/(\s+)/) : [];

  const result: DiffResult[] = [];
  let i = 0;
  let j = 0;

  while (i < originalWords.length || j < modifiedWords.length) {
    if (i >= originalWords.length) {
      // Remaining words are additions
      result.push({ type: 'added', value: modifiedWords[j] });
      j++;
    } else if (j >= modifiedWords.length) {
      // Remaining words are removals
      result.push({ type: 'removed', value: originalWords[i] });
      i++;
    } else if (originalWords[i] === modifiedWords[j]) {
      // Words match
      result.push({ type: 'unchanged', value: originalWords[i] });
      i++;
      j++;
    } else {
      // Words differ - simple heuristic: check if next words match
      const originalNextIndex = modifiedWords.indexOf(
        originalWords[i],
        j + 1
      );
      const modifiedNextIndex = originalWords.indexOf(
        modifiedWords[j],
        i + 1
      );

      if (
        modifiedNextIndex !== -1 &&
        (originalNextIndex === -1 ||
          modifiedNextIndex - i < originalNextIndex - j)
      ) {
        // Original word appears later in modified - this is a removal
        result.push({ type: 'removed', value: originalWords[i] });
        i++;
      } else if (originalNextIndex !== -1) {
        // Modified word appears later in original - this is an addition
        result.push({ type: 'added', value: modifiedWords[j] });
        j++;
      } else {
        // Neither word appears later - treat as replacement
        result.push({ type: 'removed', value: originalWords[i] });
        result.push({ type: 'added', value: modifiedWords[j] });
        i++;
        j++;
      }
    }
  }

  return result;
}
