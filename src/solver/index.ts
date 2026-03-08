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
 * Choose the next direction for a snake based on the given strategy.
 *
 * Stagnation-aware: when the snake hasn't painted a new cell for many turns,
 * the epsilon (random move probability) increases, forcing loop-breaking.
 *
 * @param stagnation - consecutive turns without painting a new cell (0 = just painted)
 */
export function chooseDirection(
  snake: Snake,
  grid: Grid,
  strategy: Strategy,
  opponentPos?: Position,
  stagnation: number = 0
): Direction | null {
  const validMoves = getValidMoves(snake, grid);

  if (validMoves.length === 0) return null;

  // Epsilon-greedy: probability of random move increases with stagnation
  // Base: 1%, at 10 turns stagnation: ~16%, at 20+: 25%
  const baseEpsilon = 0.01;
  const stagnationEpsilon = Math.min(0.25, stagnation * 0.015);
  const epsilon = baseEpsilon + stagnationEpsilon;

  if (Math.random() < epsilon) {
    return randomStrategy(validMoves);
  }

  // Also detect position loops: if snake visited the same 4 positions in order
  // twice in the last 20 positions, force a random move
  if (detectLoop(snake)) {
    return randomStrategy(validMoves);
  }

  switch (strategy) {
    case "random":
      return randomStrategy(validMoves);
    case "aggressive":
      return aggressiveStrategy(snake, grid, validMoves, opponentPos);
    case "balanced":
      return balancedStrategy(snake, grid, validMoves, opponentPos);
    default:
      return aggressiveStrategy(snake, grid, validMoves, opponentPos);
  }
}

/**
 * Detect if the snake is in a position loop by checking for repeated
 * subsequences in the last 20 trail positions.
 */
function detectLoop(snake: Snake): boolean {
  const trail = snake.trail;
  if (trail.length < 8) return false;

  // Check for period-2, period-3, period-4 loops in the last 20 positions
  const lookback = Math.min(trail.length, 20);
  const recent = trail.slice(trail.length - lookback);

  for (const period of [2, 3, 4]) {
    if (recent.length < period * 2) continue;
    let isLoop = true;
    for (let i = 0; i < period; i++) {
      const a = recent[recent.length - 1 - i];
      const b = recent[recent.length - 1 - i - period];
      if (a.x !== b.x || a.y !== b.y) {
        isLoop = false;
        break;
      }
    }
    if (isLoop) return true;
  }
  return false;
}

/**
 * Random strategy: pick a random valid move
 */
function randomStrategy(validMoves: Direction[]): Direction {
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

/**
 * Aggressive strategy — v3 with anti-chase-loop design:
 *
 * Core insight: The old algorithm valued enemy cells 3x and unpainted 1x, which
 * made snakes chase behind the enemy instead of seeking fresh territory. The fix:
 *
 * 1. **Unpainted cells are king**: CellOwner.None cells score MUCH higher (3x)
 *    than enemy cells (1x). This pulls the snake toward unexplored territory.
 *
 * 2. **Nearest-unpainted directional bonus**: Compute direction toward the
 *    nearest cluster of unpainted cells and give a strong bonus for heading
 *    that way. This provides a "global compass" beyond the BFS horizon.
 *
 * 3. **Anti-chase**: If the immediate next cell is an enemy cell but there are
 *    unpainted cells reachable in other directions, penalize the enemy-chase.
 *
 * 4. **Recently-visited and own-territory penalties** to prevent cycling.
 *
 * 5. **Escape route check** to avoid dead-ends.
 */
function aggressiveStrategy(
  snake: Snake,
  grid: Grid,
  validMoves: Direction[],
  opponentPos?: Position
): Direction {
  let bestScore = -Infinity;
  let bestDir = validMoves[0];

  const heading = getHeading(snake);

  // Pre-compute a sample BFS to determine if we're in "nav mode"
  // (surrounded by own territory with no nearby paintable cells)
  const samplePaintable = countReachableWeighted(snake.position, grid, snake.id);
  const inNavMode = samplePaintable < 1.0;

  // In nav mode, extend the recently-visited window to avoid revisiting
  const recentWindow = inNavMode ? 30 : 15;
  const recentSet = new Set<string>();
  const recentLen = Math.min(snake.trail.length, recentWindow);
  for (let i = snake.trail.length - recentLen; i < snake.trail.length; i++) {
    if (i >= 0) recentSet.add(`${snake.trail[i].x},${snake.trail[i].y}`);
  }

  // Compute direction toward nearest unpainted cluster (global compass)
  const unpaintedDir = findUnpaintedDirection(snake.position, grid, snake.id);

  // Long-range navigation: find shortest path to nearest target cell
  const navDirection = inNavMode
    ? findNearestTargetDirection(snake.position, grid, snake.id)
    : null;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const nextCell = grid.cells[nextPos.x][nextPos.y];

    // 1. Distance-decayed BFS score (unpainted >> enemy >> own)
    const paintableScore = countReachableWeighted(nextPos, grid, snake.id);

    // 2. Immediate cell value — ONLY unpainted cells are rewarded
    let frontierBonus = 0;
    if (nextCell.owner === CellOwner.None) {
      frontierBonus = 15; // strong bonus for painting fresh ground
    } else if (nextCell.owner !== snake.id) {
      frontierBonus = -2; // enemy cells: slight penalty to prevent chasing
    } else {
      frontierBonus = -5; // own territory: penalty for retracing
    }

    // 3. Global compass: bonus for heading toward unpainted regions
    let compassBonus = 0;
    if (unpaintedDir && dir === unpaintedDir) {
      compassBonus = 10;
    }

    // 4. Recently-visited penalty (stronger in nav mode)
    let recentPenalty = 0;
    if (recentSet.has(`${nextPos.x},${nextPos.y}`)) {
      recentPenalty = inNavMode ? -15 : -8;
    }

    // 5. Escape route check
    const escapeCount = countReachableShort(nextPos, grid, 5);
    let escapePenalty = 0;
    if (escapeCount < 3) {
      escapePenalty = -20;
    } else if (escapeCount < 6) {
      escapePenalty = -5;
    }

    // 6. Sweep direction bonus
    let sweepBonus = 0;
    if (heading && dir === heading) {
      sweepBonus = 2;
    }

    // 7. Edge avoidance
    let edgePenalty = 0;
    if (
      nextPos.x === 0 ||
      nextPos.x === grid.width - 1 ||
      nextPos.y === 0 ||
      nextPos.y === grid.height - 1
    ) {
      edgePenalty = -1;
    }

    // 8. Opponent avoidance: if near the opponent, strongly prefer moving away
    let opponentBonus = 0;
    if (opponentPos) {
      const currentDist = Math.abs(snake.position.x - opponentPos.x) + Math.abs(snake.position.y - opponentPos.y);
      if (currentDist <= 5) {
        const nextDist = Math.abs(nextPos.x - opponentPos.x) + Math.abs(nextPos.y - opponentPos.y);
        if (nextDist > currentDist) {
          opponentBonus = 10; // move away from opponent
        } else if (nextDist < currentDist) {
          opponentBonus = -8; // penalize moving toward opponent
        }
      }
    }

    // 9. Long-range navigation: strong bonus for heading toward nearest target
    let navBonus = 0;
    if (inNavMode && navDirection) {
      navBonus = dir === navDirection ? 30 : -10;
    }

    const score =
      paintableScore +
      frontierBonus +
      compassBonus +
      recentPenalty +
      escapePenalty +
      sweepBonus +
      edgePenalty +
      opponentBonus +
      navBonus +
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
  validMoves: Direction[],
  opponentPos?: Position
): Direction {
  let bestScore = -Infinity;
  let bestDir = validMoves[0];

  const centerX = grid.width / 2;
  const centerY = grid.height / 2;
  const maxDist = centerX + centerY;

  const heading = getHeading(snake);

  // Pre-compute nav mode detection
  const samplePaintable = countReachableWeighted(snake.position, grid, snake.id);
  const inNavMode = samplePaintable < 1.0;

  const recentWindow = inNavMode ? 30 : 15;
  const recentSet = new Set<string>();
  const recentLen = Math.min(snake.trail.length, recentWindow);
  for (let i = snake.trail.length - recentLen; i < snake.trail.length; i++) {
    if (i >= 0) recentSet.add(`${snake.trail[i].x},${snake.trail[i].y}`);
  }

  const unpaintedDir = findUnpaintedDirection(snake.position, grid, snake.id);
  const navDirection = inNavMode
    ? findNearestTargetDirection(snake.position, grid, snake.id)
    : null;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(snake.position, dir);
    const nextCell = grid.cells[nextPos.x][nextPos.y];
    const paintable = countReachableWeighted(nextPos, grid, snake.id);

    const distFromCenter =
      Math.abs(nextPos.x - centerX) + Math.abs(nextPos.y - centerY);
    const centerBonus = ((maxDist - distFromCenter) / maxDist) * 8;

    let frontierBonus = 0;
    if (nextCell.owner === CellOwner.None) {
      frontierBonus = 12;
    } else if (nextCell.owner !== snake.id) {
      frontierBonus = -2;
    } else {
      frontierBonus = -4;
    }

    let compassBonus = 0;
    if (unpaintedDir && dir === unpaintedDir) {
      compassBonus = 8;
    }

    let recentPenalty = 0;
    if (recentSet.has(`${nextPos.x},${nextPos.y}`)) {
      recentPenalty = inNavMode ? -12 : -6;
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

    let opponentBonus = 0;
    if (opponentPos) {
      const currentDist = Math.abs(snake.position.x - opponentPos.x) + Math.abs(snake.position.y - opponentPos.y);
      if (currentDist <= 5) {
        const nextDist = Math.abs(nextPos.x - opponentPos.x) + Math.abs(nextPos.y - opponentPos.y);
        if (nextDist > currentDist) {
          opponentBonus = 8;
        } else if (nextDist < currentDist) {
          opponentBonus = -6;
        }
      }
    }

    // Long-range navigation bonus
    let navBonus = 0;
    if (inNavMode && navDirection) {
      navBonus = dir === navDirection ? 25 : -8;
    }

    const score =
      paintable +
      centerBonus +
      frontierBonus +
      compassBonus +
      recentPenalty +
      escapePenalty +
      sweepBonus +
      opponentBonus +
      navBonus +
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
 * Find the direction toward the nearest cluster of unpainted (CellOwner.None) cells.
 *
 * Scans the grid to find the center of mass of unpainted cells within a
 * reasonable radius, then returns the cardinal direction that best moves
 * toward that center. This gives the snake a "global compass" so it heads
 * toward fresh territory even when the local BFS can't see it.
 */
function findUnpaintedDirection(
  pos: Position,
  grid: Grid,
  snakeId: CellOwner.Snake1 | CellOwner.Snake2
): Direction | null {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  // Scan the entire grid for unpainted cells
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      if (grid.cells[x][y].owner === CellOwner.None) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count === 0) return null;

  const avgX = sumX / count;
  const avgY = sumY / count;

  const dx = avgX - pos.x;
  const dy = avgY - pos.y;

  // Return the direction with the larger component
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.Right : Direction.Left;
  } else if (Math.abs(dy) > 0) {
    return dy > 0 ? Direction.Down : Direction.Up;
  }
  return null;
}

/**
 * Find the direction of the first step on the shortest path to the nearest
 * unpainted or enemy cell. Used in "nav mode" when the snake is surrounded
 * by its own territory and needs to march purposefully toward a target
 * rather than wandering aimlessly.
 *
 * Uses BFS from the snake's current position, tracking the first step taken
 * to reach each cell. Returns the direction of that first step for the
 * nearest target cell found.
 */
function findNearestTargetDirection(
  pos: Position,
  grid: Grid,
  snakeId: CellOwner.Snake1 | CellOwner.Snake2
): Direction | null {
  const visited = new Set<string>();
  // Each entry tracks position, depth, and the direction of the FIRST step
  const queue: { pos: Position; depth: number; firstDir: Direction }[] = [];
  let queueHead = 0;

  visited.add(`${pos.x},${pos.y}`);

  const directions = [
    Direction.Up,
    Direction.Down,
    Direction.Left,
    Direction.Right,
  ];

  // Seed the queue with the 4 immediate neighbors
  for (const dir of directions) {
    const next = getNextPosition(pos, dir);
    if (!isInBounds(next, grid)) continue;
    const key = `${next.x},${next.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const owner = grid.cells[next.x][next.y].owner;
    // Found a target immediately adjacent
    if (owner !== snakeId) {
      return dir;
    }

    queue.push({ pos: next, depth: 1, firstDir: dir });
  }

  // BFS outward — search entire grid if needed
  while (queueHead < queue.length) {
    const { pos: current, depth, firstDir } = queue[queueHead++];

    for (const dir of directions) {
      const next = getNextPosition(current, dir);
      const key = `${next.x},${next.y}`;

      if (!isInBounds(next, grid) || visited.has(key)) continue;
      visited.add(key);

      const owner = grid.cells[next.x][next.y].owner;
      // Found a target: return the first step direction that led here
      if (owner !== snakeId) {
        return firstDir;
      }

      queue.push({ pos: next, depth: depth + 1, firstDir });
    }
  }

  return null;
}

/**
 * BFS with distance decay to count paintable cells weighted by proximity.
 *
 * KEY CHANGE (v3): Unpainted cells (CellOwner.None) score 3x, enemy cells
 * only 1x. This REVERSES the old priority and prevents chase-loops where
 * the snake follows behind the enemy instead of seeking fresh ground.
 *
 * Own cells are walkable but score 0.
 */
function countReachableWeighted(
  start: Position,
  grid: Grid,
  snakeId: CellOwner.Snake1 | CellOwner.Snake2
): number {
  const maxDepth = 30;
  const visited = new Set<string>();
  const queue: { pos: Position; depth: number }[] = [];
  let queueHead = 0;
  let score = 0;

  visited.add(`${start.x},${start.y}`);
  queue.push({ pos: start, depth: 0 });

  // Score the starting cell — only unpainted cells count
  const startOwner = grid.cells[start.x][start.y].owner;
  if (startOwner === CellOwner.None) {
    score += 3;
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

      // Distance-decayed scoring: ONLY unpainted cells contribute
      // Enemy and own cells score 0 — this prevents chase-loops entirely
      const weight = (maxDepth - (depth + 1)) / maxDepth;
      if (owner === CellOwner.None) {
        score += 3 * weight;
      }
      // Enemy & own: 0 points, but still walkable for traversal

      queue.push({ pos: next, depth: depth + 1 });
    }
  }

  return score;
}

/**
 * Quick BFS to count total reachable cells within a short depth.
 * Used for escape-route detection.
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
