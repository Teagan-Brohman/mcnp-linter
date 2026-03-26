/** Normalize line endings and split text into lines. */
export function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}
