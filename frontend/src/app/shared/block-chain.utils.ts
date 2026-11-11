import { BlockExtended } from '@interfaces/node-api.interface';

// How `blocks` compare with the blocks known at their heights, which `known` gives the id of, if any:
// `replaced`, the lowest height at which they hold another block (Infinity if there is none), and
// `same`, the highest height below it at which they hold the same block (-1 if there is none). A
// block's ancestors are on its chain, so up to `same`, both chains hold the same blocks.
export function compareBlocks(blocks: BlockExtended[], known: (height: number) => string | undefined): { replaced: number, same: number } {
  const replaced = Math.min(...blocks.filter((block) => {
    const id = known(block.height);
    return id !== undefined && id !== block.id;
  }).map((block) => block.height));
  const same = Math.max(-1, ...blocks.filter((block) => block.height < replaced && known(block.height) === block.id).map((block) => block.height));
  return { replaced, same };
}
