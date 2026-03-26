interface TokenizerWarning {
  message: string;
  line: number;
  severity?: 'error' | 'warning';
}

interface TokenizedInput {
  messageBlock?: string;
  title: string;
  cellLines: LogicalLine[];
  surfaceLines: LogicalLine[];
  dataLines: LogicalLine[];
  warnings: TokenizerWarning[];
  blockCount: number;
  hasBrokenBlockStructure: boolean;
}

export interface LogicalLine {
  text: string;              // Joined text, comments stripped
  startLine: number;         // Original file line number (0-based)
  endLine: number;           // Last physical line of this logical line
  originalLines: string[];   // Unmodified physical lines (for position mapping)
  originalLineNumbers?: number[];  // File line number for each entry in originalLines
}

/**
 * Returns true if the line is a full-line comment:
 * starts with 'c' or 'C' in column 1, and column 2 is a blank (space/tab)
 * or the line is just "c"/"C" with nothing after.
 */
function isCommentLine(line: string): boolean {
  if (line.length === 0) return false;
  if (line[0].toLowerCase() !== 'c') return false;
  if (line.length === 1) return true;
  // Column 2 must be a blank
  return line[1] === ' ' || line[1] === '\t';
}

/**
 * Strips inline dollar-sign comments from a line.
 * Everything from the first '$' onward is removed.
 */
function stripInlineComment(line: string): string {
  const idx = line.indexOf('$');
  if (idx === -1) return line;
  return line.substring(0, idx);
}

/**
 * Returns true if columns 1-5 (indices 0-4) are all spaces,
 * meaning this is a continuation line (5-blank-column indent).
 */
function isContinuationByIndent(line: string): boolean {
  if (line.length < 5) return false;
  for (let i = 0; i < 5; i++) {
    if (line[i] !== ' ') return false;
  }
  return true;
}

/**
 * Returns true if the line is blank (empty or only whitespace).
 */
function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Tokenize an MCNP input file into its logical structure.
 */
export function tokenizeInput(input: string): TokenizedInput {
  const physicalLines = input.split('\n').map(l => l.endsWith('\r') ? l.slice(0, -1) : l);
  // Remove trailing empty line from split if input ends with newline
  if (physicalLines.length > 0 && physicalLines[physicalLines.length - 1] === '') {
    physicalLines.pop();
  }

  let lineIndex = 0;
  let messageBlock: string | undefined;

  // Step 1: Check for optional message block
  if (physicalLines.length > 0 && physicalLines[0].toLowerCase().startsWith('message:')) {
    const messageLines: string[] = [];
    while (lineIndex < physicalLines.length && !isBlankLine(physicalLines[lineIndex])) {
      messageLines.push(physicalLines[lineIndex]);
      lineIndex++;
    }
    messageBlock = messageLines.join('\n');
    // Skip the blank line that terminates the message block
    if (lineIndex < physicalLines.length && isBlankLine(physicalLines[lineIndex])) {
      lineIndex++;
    }
  }

  // Step 2: Title card — first line after message block
  const title = lineIndex < physicalLines.length ? physicalLines[lineIndex] : '';
  lineIndex++;

  // Step 3: Read remaining lines and split into blocks by blank lines
  const blocks: { lines: string[]; lineNumbers: number[] }[] = [];
  let currentBlock: { lines: string[]; lineNumbers: number[] } = { lines: [], lineNumbers: [] };
  const blankLinePositions: number[] = [];

  while (lineIndex < physicalLines.length) {
    const line = physicalLines[lineIndex];
    if (isBlankLine(line)) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
        currentBlock = { lines: [], lineNumbers: [] };
      }
      blankLinePositions.push(lineIndex);
      lineIndex++;
      continue;
    }
    currentBlock.lines.push(line);
    currentBlock.lineNumbers.push(lineIndex);
    lineIndex++;
  }
  // Push the last block if it has content
  if (currentBlock.lines.length > 0) {
    blocks.push(currentBlock);
  }

  // Step 4: Generate warnings for blank line issues
  const warnings: TokenizerWarning[] = [];

  // Warn about consecutive blank lines
  for (let i = 1; i < blankLinePositions.length; i++) {
    if (blankLinePositions[i] === blankLinePositions[i - 1] + 1) {
      warnings.push({
        message: 'Extra blank line — MCNP uses each blank line as a block separator',
        line: blankLinePositions[i],
      });
    }
  }

  // Check for blank lines beyond the 2 expected separators (cells/surfaces/data).
  // Per MCNP manual §4.4 (p.247): "A final (optional) blank line at the end of the
  // data block signals the end of the input file... This region following the blank
  // line terminator can be used by the user for problem documentation."
  //
  // Strategy: MCNP expects exactly 2 blank-line separators. If there are more,
  // we need to find which ones are "extra" (splitting a block) vs which are the
  // valid end-of-input terminator. We flag every separator beyond the 2 expected
  // ones, but ONLY if there is non-comment card content somewhere after the last
  // blank line (meaning cards are being silently lost). The error goes on ALL
  // extra separators so the user can find the stray blank line wherever it is.
  let brokenStructure = false;
  if (blocks.length > 3) {
    // Check if any block beyond block 3 contains actual card content
    const hasCardContentAfter = blocks.slice(3).some(b =>
      b.lines.some(l => !isCommentLine(l) && !isBlankLine(l))
    );
    brokenStructure = hasCardContentAfter;

    if (hasCardContentAfter) {
      // Cards are being silently lost because a stray blank line splits a block.
      // We can't tell which separator is "stray" vs "real" (e.g., the stray one
      // might be separator #2, pushing the real cells/data boundary to #3).
      // Flag all separators so the user can find the accidental one.
      const extraCount = blocks.length - 3;
      for (const pos of blankLinePositions) {
        warnings.push({
          message: `${extraCount} unexpected blank line separator(s) — MCNP expects exactly 2 (cells/surfaces/data). One of these blank lines is misplaced, causing cards to be silently ignored.`,
          line: pos,
          severity: 'error',
        });
      }
    }
    // else: only comments/blanks after the last separator — valid end-of-input per manual
  }

  // Step 5: Convert each block's physical lines to logical lines
  const emptyBlock = { lines: [] as string[], lineNumbers: [] as number[] };
  const cellBlock = blocks.length > 0 ? blocks[0] : emptyBlock;
  const surfaceBlock = blocks.length > 1 ? blocks[1] : emptyBlock;
  const dataBlock = blocks.length > 2 ? blocks[2] : emptyBlock;

  return {
    messageBlock,
    title,
    cellLines: buildLogicalLines(cellBlock.lines, cellBlock.lineNumbers),
    surfaceLines: buildLogicalLines(surfaceBlock.lines, surfaceBlock.lineNumbers),
    dataLines: buildLogicalLines(dataBlock.lines, dataBlock.lineNumbers),
    warnings,
    blockCount: blocks.length,
    hasBrokenBlockStructure: brokenStructure,
  };
}

/**
 * Convert physical lines (with their original line numbers) into logical lines,
 * handling comments and continuations.
 */
function buildLogicalLines(lines: string[], lineNumbers: number[]): LogicalLine[] {
  const result: LogicalLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const lineNum = lineNumbers[i];

    // Skip full-line comments
    if (isCommentLine(line)) {
      i++;
      continue;
    }

    // Start a new logical line
    const originalLines: string[] = [line];
    const originalLineNumbers: number[] = [lineNum];
    let startLine = lineNum;
    let endLine = lineNum;

    // Strip inline comment and check for ampersand continuation
    let stripped = stripInlineComment(line).trimEnd();
    let hasAmpersand = stripped.endsWith('&');
    if (hasAmpersand) {
      stripped = stripped.substring(0, stripped.length - 1).trimEnd();
    }

    const textParts: string[] = [stripped];
    i++;

    // Gather continuation lines
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextLineNum = lineNumbers[i];

      // Skip comment lines within continuations
      if (isCommentLine(nextLine)) {
        i++;
        continue;
      }

      const isContinuation = hasAmpersand || isContinuationByIndent(nextLine);
      if (!isContinuation) break;

      originalLines.push(nextLine);
      originalLineNumbers.push(nextLineNum);
      endLine = nextLineNum;

      let nextStripped = stripInlineComment(nextLine).trimEnd();

      // For indent continuations, keep the content after the indent
      // For ampersand continuations, use the whole line
      hasAmpersand = nextStripped.endsWith('&');
      if (hasAmpersand) {
        nextStripped = nextStripped.substring(0, nextStripped.length - 1).trimEnd();
      }

      textParts.push(nextStripped);
      i++;
    }

    const text = textParts.join(' ');

    result.push({
      text,
      startLine,
      endLine,
      originalLines,
      originalLineNumbers,
    });
  }

  return result;
}
