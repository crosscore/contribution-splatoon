import { CellOwner, Grid, GameScore } from "../types";

/**
 * Calculate territory scores for both snakes
 */
export function calculateScore(grid: Grid): GameScore {
  let snake1 = 0;
  let snake2 = 0;
  let total = 0;

  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      total++;
      const owner = grid.cells[x][y].owner;
      if (owner === CellOwner.Snake1) snake1++;
      else if (owner === CellOwner.Snake2) snake2++;
    }
  }

  return { snake1, snake2, total };
}

/**
 * Count remaining unpainted cells
 */
export function countUnpainted(grid: Grid): number {
  let count = 0;
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      if (grid.cells[x][y].owner === CellOwner.None) {
        count++;
      }
    }
  }
  return count;
}
