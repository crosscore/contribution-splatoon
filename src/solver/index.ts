import {
  CellOwner,
  Direction,
  Grid,
  Position,
  Snake,
  Strategy,
} from "../types";
import { getNextPosition, getValidMoves, isInBounds } from "../game/snake";

/**
 * Choose the next direction for a snake based on the given strategy
 */
export function chooseDirection(
  snake: Snake,
  grid: Grid,
  strategy: Strategy
): Direction | null {
  const validMoves = getValidMoves(snake, grid);

  if (validMoves.length === 0) return null;

  switch (strategy) {
    case "random":
      return randomStrategy(validMoves);
    case "aggressive":
      return aggressiveStrategy(snake, grid, validMoves);
    case "balanced":
      return balancedStrategy(snake, grid, validMoves);
    default:
      return aggressiveStrategy(snake, grid, validMoves);
  }
}

/**
 * Random strategy: pick a random valid move
 */
function randomStrategy(validMoves: Direction[]): Direction {
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

/**
 * Aggressive strategy: move toward the nearest enemy or unpainted cell.
 *
 * Key fixes vs the old version:
 * 1. Own cells are now WALKABLE in BFS (they don't act as walls anymore).
 *    Only unpainted/enemy cells increase the score counter.
 *    This prevents the snake from trapping itself in its own territory.
 * 2. BFS depth increased from 20 → 40 for wider area awareness.
 * 3. Tie-breaking uses a small random jitter so the snake doesn't
 *    cycle in the same corner loop indefinitely.
 */
function aggressiveStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[]
): Direction {
  let bestScore = -Infinity;
  let bestDir = validMoves[0];

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const paintable = countReachablePaintable(nextPos, grid, snake.id);
    // Small random jitter [0, 0.5) breaks ties and prevents cycles
    const score = paintable + Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * Balanced strategy: mix of aggressive pathing and staying near center
 */
function balancedStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[]
): Direction {
  let bestScore = -Infinity;
  let bestDir = validMoves[0];

  const centerX = grid.width / 2;
  const centerY = grid.height / 2;
  const maxDist = centerX + centerY;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const paintable = countReachablePaintable(nextPos, grid, snake.id);

    const distFromCenter =
      Math.abs(nextPos.x - centerX) + Math.abs(nextPos.y - centerY);
    const centerBonus = ((maxDist - distFromCenter) / maxDist) * 10;
    const score = paintable + centerBonus + Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * BFS to count reachable paintable cells from a given position.
 *
 * IMPORTANT: Own cells are traversable (not walls) but do NOT count toward
 * the score. Only unpainted cells (CellOwner.None) and enemy cells score
 * points. Enemy cells score 3× because stealing territory is the goal.
 *
 * This ensures the snake explores THROUGH its own territory rather than
 * bouncing off it and getting stuck in corners.
 */
function countReachablePaintable(
  start: Position,
  grid: Grid,
  snakeId: CellOwner.Snake1 | CellOwner.Snake2
): number {
  const maxDepth = 40;
  const visited = new Set<string>();
  const queue: { pos: Position; depth: number }[] = [
    { pos: start, depth: 0 },
  ];
  let count = 0;

  visited.add(`${start.x},${start.y}`);

  // Count the starting cell if it's paintable
  const startOwner = grid.cells[start.x][start.y].owner;
  if (startOwner !== snakeId) {
    count += startOwner === CellOwner.None ? 1 : 3;
  }

  while (queue.length > 0) {
    const { pos, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const directions = [
      Direction.Up,
      Direction.Down,
      Direction.Left,
      Direction.Right,
    ];

    for (const dir of directions) {
      const next = getNextPosition(pos, dir);
      const key = `${next.x},${next.y}`;

      if (!isInBounds(next, grid) || visited.has(key)) continue;

      visited.add(key);
      const owner = grid.cells[next.x][next.y].owner;

      // Score: enemy cells are 3×, unpainted are 1×, own cells are 0×
      if (owner !== snakeId) {
        count += owner === CellOwner.None ? 1 : 3;
      }

      // All cells (including own) are walkable — this prevents corner trapping
      queue.push({ pos: next, depth: depth + 1 });
    }
  }

  return count;
}
