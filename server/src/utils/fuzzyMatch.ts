/** Compute Levenshtein edit distance between two strings (case-insensitive). */
function levenshtein(a: string, b: string): number {
  a = a.toUpperCase();
  b = b.toUpperCase();
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Return the closest candidate to `input` if within `maxDistance` (default 2).
 * Case-insensitive. On ties, returns the first alphabetically.
 */
export function suggestMatch(
  input: string,
  candidates: Iterable<string>,
  maxDistance = 2,
): string | undefined {
  let best: string | undefined;
  let bestDist = maxDistance + 1;
  for (const c of candidates) {
    const d = levenshtein(input, c);
    if (d < bestDist || (d === bestDist && best !== undefined && c.toUpperCase() < best.toUpperCase())) {
      best = c;
      bestDist = d;
    }
  }
  return bestDist <= maxDistance ? best : undefined;
}
