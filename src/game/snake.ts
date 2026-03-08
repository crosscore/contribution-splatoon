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

/**
 * Get all valid directions a snake can move
 * (in bounds + not already owned by any snake)
 */
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
    // Can move to unowned cells or cells owned by self (but prefer unowned)
    const cell = grid.cells[next.x][next.y];
    return cell.owner === CellOwner.None;
  });
}

/**
 * Move a snake in a direction. Mutates the snake and grid.
 */
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
  if (cell.owner !== CellOwner.None) {
    snake.alive = false;
    return;
  }

  // Paint the cell
  cell.owner = snake.id;

  // Move snake
  snake.position = next;
  snake.trail.push({ ...next });
}
