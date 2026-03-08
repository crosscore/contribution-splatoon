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
 * Aggressive strategy: move toward the nearest unpainted cell using BFS
 * Greedy approach — always picks the direction with the most reachable unpainted cells
 */
function aggressiveStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[]
): Direction {
  let bestDir = validMoves[0];
  let bestScore = -1;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    // Score = number of reachable unpainted cells from this position
    const reachable = countReachableUnpainted(nextPos, grid);

    // Tiebreak: prefer directions that lead to more open space
    if (reachable > bestScore) {
      bestScore = reachable;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * Balanced strategy: mix of aggressive pathing and staying near center
 * Tries to keep options open by avoiding dead-end paths
 */
function balancedStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[]
): Direction {
  let bestDir = validMoves[0];
  let bestScore = -1;

  const centerX = grid.width / 2;
  const centerY = grid.height / 2;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const reachable = countReachableUnpainted(nextPos, grid);

    // Distance from center (lower is better)
    const distFromCenter =
      Math.abs(nextPos.x - centerX) + Math.abs(nextPos.y - centerY);
    const maxDist = centerX + centerY;
    const centerBonus = ((maxDist - distFromCenter) / maxDist) * 10;

    const score = reachable + centerBonus;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * BFS to count reachable unpainted cells from a position
 * Limited depth to keep performance reasonable
 */
function countReachableUnpainted(start: Position, grid: Grid): number {
  const maxDepth = 20;
  const visited = new Set<string>();
  const queue: { pos: Position; depth: number }[] = [
    { pos: start, depth: 0 },
  ];
  let count = 0;

  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const { pos, depth } = queue.shift()!;

    if (grid.cells[pos.x][pos.y].owner === CellOwner.None) {
      count++;
    }

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

      if (
        isInBounds(next, grid) &&
        !visited.has(key) &&
        grid.cells[next.x][next.y].owner === CellOwner.None
      ) {
        visited.add(key);
        queue.push({ pos: next, depth: depth + 1 });
      }
    }
  }

  return count;
}
