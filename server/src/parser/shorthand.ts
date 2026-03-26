export function expandShorthand(tokens: string[]): number[] {
  const result: number[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i].toUpperCase();
    const match = token.match(/^(\d+)([RIMJ])$/);
    if (!match) {
      result.push(parseFloat(tokens[i]));
      i++;
      continue;
    }
    const n = parseInt(match[1], 10);
    const op = match[2];
    if (op === 'R') {
      const prev = result.length > 0 ? result[result.length - 1] : NaN;
      for (let k = 0; k < n; k++) result.push(prev);
      i++;
    } else if (op === 'I') {
      const prev = result.length > 0 ? result[result.length - 1] : 0;
      const next = i + 1 < tokens.length ? parseFloat(tokens[i + 1]) : prev;
      const step = (next - prev) / (n + 1);
      for (let k = 1; k <= n; k++) {
        result.push(prev + step * k);
      }
      i++;
    } else if (op === 'M') {
      const prev = result.length > 0 ? result[result.length - 1] : 1;
      const next = i + 1 < tokens.length ? parseFloat(tokens[i + 1]) : prev;
      const ratio = Math.pow(next / prev, 1 / (n + 1));
      for (let k = 1; k <= n; k++) {
        result.push(prev * Math.pow(ratio, k));
      }
      i++;
    } else {
      // op === 'J': fill with default (0)
      for (let k = 0; k < n; k++) result.push(0);
      i++;
    }
  }
  return result;
}
