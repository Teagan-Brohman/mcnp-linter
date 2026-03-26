import { BlockNode, CardNode } from '../cst/types';

/** Group consecutive CardNode children of a block into runs, splitting at non-card nodes. */
export function getConsecutiveCardRuns(block: BlockNode): CardNode[][] {
	const runs: CardNode[][] = [];
	let currentRun: CardNode[] = [];

	for (const child of block.children) {
		if (child.type === 'card') {
			currentRun.push(child);
		} else {
			if (currentRun.length > 0) {
				runs.push(currentRun);
				currentRun = [];
			}
		}
	}
	if (currentRun.length > 0) {
		runs.push(currentRun);
	}

	return runs;
}
