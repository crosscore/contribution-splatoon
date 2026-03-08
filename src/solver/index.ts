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
 * Aggressive strategy — improved version with multiple heuristics:
 *
 * 1. **Distance-decayed BFS**: Closer paintable cells contribute more to the
 *    score, encouraging the snake to paint nearby cells efficiently rather
 *    than wandering toward distant areas.
 *
 * 2. **Frontier bonus**: If we're moving from own territory into unpainted/enemy
 *    territory, we get a bonus. This pushes the snake to advance the frontier
 *    rather than retrace its own area.
 *
 * 3. **Escape route penalty**: If a direction leads to a dead-end (very few
 *    reachable cells within a short radius), it gets penalized. This prevents
 *    the snake from getting cornered.
 *
 * 4. **Sweep direction bias**: A slight bias toward continuing in the same
 *    general direction (if the previous heading is known from trail), which
 *    produces cleaner, more efficient sweep patterns instead of zig-zagging.
 */
function aggressiveStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[]
): Direction {
  let bestScore = -Infinity;
  let bestDir = validMoves[0];

  // Determine "heading" from the last 2 trail positions
  const heading = getHeading(snake);

  // Build a set of recently-visited positions (last 10) to penalize cycling
  const recentSet = new Set<string>();
  const recentLen = Math.min(snake.trail.length, 10);
  for (let i = snake.trail.length - recentLen; i < snake.trail.length; i++) {
    if (i >= 0) recentSet.add(`${snake.trail[i].x},${snake.trail[i].y}`);
  }

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const nextCell = grid.cells[nextPos.x][nextPos.y];

    // 1. Distance-decayed reachable paintable score
    const paintableScore = countReachableWeighted(nextPos, grid, snake.id);

    // 2. Frontier bonus: strong incentive to paint new cells
    let frontierBonus = 0;
    if (nextCell.owner !== snake.id) {
      frontierBonus = nextCell.owner === CellOwner.None ? 8 : 12;
    } else {
      // Own territory: penalty for retracing
      frontierBonus = -3;
    }

    // 3. Recently-visited penalty: discourage cycling through same cells
    let recentPenalty = 0;
    if (recentSet.has(`${nextPos.x},${nextPos.y}`)) {
      recentPenalty = -6;
    }

    // 4. Escape route check: count reachable cells in short range (depth=5)
    const escapeCount = countReachableShort(nextPos, grid, 5);
    let escapePenalty = 0;
    if (escapeCount < 3) {
      escapePenalty = -20;
    } else if (escapeCount < 6) {
      escapePenalty = -5;
    }

    // 5. Sweep direction bonus: slight preference for continuing same heading
    let sweepBonus = 0;
    if (heading && dir === heading) {
      sweepBonus = 2;
    }

    // 6. Wall-hugging avoidance
    let edgePenalty = 0;
    if (
      nextPos.x === 0 ||
      nextPos.x === grid.width - 1 ||
      nextPos.y === 0 ||
      nextPos.y === grid.height - 1
    ) {
      edgePenalty = -1;
    }

    const score =
      paintableScore +
      frontierBonus +
      recentPenalty +
      escapePenalty +
      sweepBonus +
      edgePenalty +
      Math.random() * 0.5;

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

  const heading = getHeading(snake);

  const recentSet = new Set<string>();
  const recentLen = Math.min(snake.trail.length, 10);
  for (let i = snake.trail.length - recentLen; i < snake.trail.length; i++) {
    if (i >= 0) recentSet.add(`${snake.trail[i].x},${snake.trail[i].y}`);
  }

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const nextCell = grid.cells[nextPos.x][nextPos.y];
    const paintable = countReachableWeighted(nextPos, grid, snake.id);

    const distFromCenter =
      Math.abs(nextPos.x - centerX) + Math.abs(nextPos.y - centerY);
    const centerBonus = ((maxDist - distFromCenter) / maxDist) * 10;

    let frontierBonus = 0;
    if (nextCell.owner !== snake.id) {
      frontierBonus = nextCell.owner === CellOwner.None ? 6 : 10;
    } else {
      frontierBonus = -2;
    }

    let recentPenalty = 0;
    if (recentSet.has(`${nextPos.x},${nextPos.y}`)) {
      recentPenalty = -5;
    }

    const escapeCount = countReachableShort(nextPos, grid, 5);
    let escapePenalty = 0;
    if (escapeCount < 3) {
      escapePenalty = -15;
    }

    let sweepBonus = 0;
    if (heading && dir === heading) {
      sweepBonus = 1.5;
    }

    const score =
      paintable +
      centerBonus +
      frontierBonus +
      recentPenalty +
      escapePenalty +
      sweepBonus +
      Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * Determine the snake's current heading from its last 2 trail positions.
 * Returns null if trail is too short.
 */
function getHeading(snake: Snake): Direction | null {
  if (snake.trail.length < 2) return null;
  const prev = snake.trail[snake.trail.length - 2];
  const curr = snake.trail[snake.trail.length - 1];
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;

  if (dx === 1) return Direction.Right;
  if (dx === -1) return Direction.Left;
  if (dy === 1) return Direction.Down;
  if (dy === -1) return Direction.Up;
  return null;
}

/**
 * BFS with distance decay to count paintable cells weighted by proximity.
 *
 * Closer cells matter much more than distant cells. This produces a score
 * that encourages efficient local sweeping.
 *
 * Weight formula: (maxDepth - depth) / maxDepth
 *   - depth 0 (next cell):  weight ~1.0
 *   - depth 20 (far cell):  weight ~0.36
 *   - depth 30:             weight ~0.14
 *
 * Own cells are walkable but score 0. Enemy cells score 3x. Unpainted = 1x.
 */
function countReachableWeighted(
  start: Position,
  grid: Grid,
  snakeId: CellOwner.Snake1 | CellOwner.Snake2
): number {
  const maxDepth = 35;
  const visited = new Set<string>();
  // Use a simple array with index pointer instead of shift() for O(1) dequeue
  const queue: { pos: Position; depth: number }[] = [];
  let queueHead = 0;
  let score = 0;

  visited.add(`${start.x},${start.y}`);
  queue.push({ pos: start, depth: 0 });

  // Score the starting cell
  const startOwner = grid.cells[start.x][start.y].owner;
  if (startOwner !== snakeId) {
    const base = startOwner === CellOwner.None ? 1 : 3;
    score += base; // depth 0 = full weight
  }

  const directions = [
    Direction.Up,
    Direction.Down,
    Direction.Left,
    Direction.Right,
  ];

  while (queueHead < queue.length) {
    const { pos, depth } = queue[queueHead++];

    if (depth >= maxDepth) continue;

    for (const dir of directions) {
      const next = getNextPosition(pos, dir);
      const key = `${next.x},${next.y}`;

      if (!isInBounds(next, grid) || visited.has(key)) continue;

      visited.add(key);
      const owner = grid.cells[next.x][next.y].owner;

      // Distance-decayed scoring
      if (owner !== snakeId) {
        const base = owner === CellOwner.None ? 1 : 3;
        const weight = (maxDepth - (depth + 1)) / maxDepth;
        score += base * weight;
      }

      // All cells are walkable (including own territory)
      queue.push({ pos: next, depth: depth + 1 });
    }
  }

  return score;
}

/**
 * Quick BFS to count total reachable cells within a short depth.
 * Used for escape-route detection — if very few cells are reachable
 * in ~5 steps, we're approaching a dead-end.
 */
function countReachableShort(
  start: Position,
  grid: Grid,
  maxDepth: number
): number {
  const visited = new Set<string>();
  const queue: { pos: Position; depth: number }[] = [];
  let queueHead = 0;
  let count = 0;

  visited.add(`${start.x},${start.y}`);
  queue.push({ pos: start, depth: 0 });

  const directions = [
    Direction.Up,
    Direction.Down,
    Direction.Left,
    Direction.Right,
  ];

  while (queueHead < queue.length) {
    const { pos, depth } = queue[queueHead++];

    if (depth >= maxDepth) continue;

    for (const dir of directions) {
      const next = getNextPosition(pos, dir);
      const key = `${next.x},${next.y}`;

      if (!isInBounds(next, grid) || visited.has(key)) continue;

      visited.add(key);
      count++;
      queue.push({ pos: next, depth: depth + 1 });
    }
  }

  return count;
}
