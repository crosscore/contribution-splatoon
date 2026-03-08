import { CellOwner, Direction, Grid, Position, Snake } from "../types";

/**
 * Create a new snake at the given position
 */
export function createSnake(
  id: CellOwner.Snake1 | CellOwner.Snake2,
  position: Position
): Snake {
  return {
    id,
    position: { ...position },
    trail: [{ ...position }],
    alive: true,
  };
}

/**
 * Get the next position given current position and direction
 */
export function getNextPosition(pos: Position, dir: Direction): Position {
  switch (dir) {
    case Direction.Up:
      return { x: pos.x, y: pos.y - 1 };
    case Direction.Down:
      return { x: pos.x, y: pos.y + 1 };
    case Direction.Left:
      return { x: pos.x - 1, y: pos.y };
    case Direction.Right:
      return { x: pos.x + 1, y: pos.y };
  }
}

/**
 * Check if a position is within the grid boundaries
 */
export function isInBounds(pos: Position, grid: Grid): boolean {
  return pos.x >= 0 && pos.x < grid.width && pos.y >= 0 && pos.y < grid.height;
}

export function getValidMoves(snake: Snake, grid: Grid): Direction[] {
  if (!snake.alive) return [];

  const directions = [
    Direction.Up,
    Direction.Down,
    Direction.Left,
    Direction.Right,
  ];

  return directions.filter((dir) => {
    const next = getNextPosition(snake.position, dir);
    if (!isInBounds(next, grid)) return false;

    // 直近の数歩（例：過去3歩分）には戻れないようにする
    // これにより、2〜3マスを無限に往復してスタックするバグを防ぐ
    const blockLength = Math.min(snake.trail.length, 3);
    for (let i = 1; i <= blockLength; i++) {
      const prevPos = snake.trail[snake.trail.length - i];
      if (prevPos && next.x === prevPos.x && next.y === prevPos.y) {
        return false;
      }
    }

    return true; // 壁抜けや直前のセルでなければ、どこでも（自分の色・相手の色・未塗装）OK
  });
}

export function moveSnake(
  snake: Snake,
  dir: Direction,
  grid: Grid
): void {
  const next = getNextPosition(snake.position, dir);

  if (!isInBounds(next, grid)) {
    snake.alive = false;
    return;
  }

  const cell = grid.cells[next.x][next.y];

  // Paint the cell (相手のセルまたは未塗装なら上書きになる)
  // すでに自分の色なら再塗装はしない
  if (cell.owner !== snake.id) {
    cell.owner = snake.id;
  }

  // Move snake
  snake.position = next;
  snake.trail.push({ ...next });
}
