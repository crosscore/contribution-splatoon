import {
  CellOwner,
  Cell,
  Grid,
  Snake,
  GameFrame,
  GameResult,
  GameConfig,
  GameWinner,
  DEFAULT_GAME_CONFIG,
} from "../types";
import { createSnake, moveSnake, getValidMoves } from "./snake";
import { calculateScore, countUnpainted } from "./territory";
import { chooseDirection } from "../solver";

/**
 * Deep clone a grid (for snapshotting each frame)
 */
function cloneGrid(grid: Grid): Grid {
  const cells: Cell[][] = [];
  for (let x = 0; x < grid.width; x++) {
    cells[x] = [];
    for (let y = 0; y < grid.height; y++) {
      cells[x][y] = { ...grid.cells[x][y] };
    }
  }
  return { cells, width: grid.width, height: grid.height };
}

/**
 * Deep clone a snake
 */
function cloneSnake(snake: Snake): Snake {
  return {
    ...snake,
    position: { ...snake.position },
    trail: snake.trail.map((p) => ({ ...p })),
  };
}

/**
 * Run the full game simulation on the given grid
 */
export function runGame(
  grid: Grid,
  config: GameConfig = DEFAULT_GAME_CONFIG
): GameResult {
  // Create snakes at opposite corners
  const snake1 = createSnake(CellOwner.Snake1, { x: 0, y: 0 });
  const snake2 = createSnake(CellOwner.Snake2, {
    x: grid.width - 1,
    y: grid.height - 1,
  });

  // Paint starting cells
  grid.cells[snake1.position.x][snake1.position.y].owner = CellOwner.Snake1;
  grid.cells[snake2.position.x][snake2.position.y].owner = CellOwner.Snake2;

  const frames: GameFrame[] = [];

  // Record initial frame
  frames.push({
    turn: 0,
    grid: cloneGrid(grid),
    snakes: [cloneSnake(snake1), cloneSnake(snake2)],
    score: calculateScore(grid),
  });

  let turn = 0;
  // 3000 turns at 100ms/turn = 300s (5 minutes)
  const maxTurns = 3000;

  // Stagnation counters: track how many turns since each snake painted a NEW cell
  let s1Stagnation = 0;
  let s2Stagnation = 0;

  while (turn < maxTurns) {
    turn++;

    const snake1CanMove = getValidMoves(snake1, grid).length > 0;
    const snake2CanMove = getValidMoves(snake2, grid).length > 0;

    // If neither snake can move, game over
    if (!snake1CanMove && !snake2CanMove) {
      snake1.alive = false;
      snake2.alive = false;
      break;
    }

    // Snake 1 moves
    if (snake1.alive && snake1CanMove) {
      const prevOwner1 = grid.cells[snake1.position.x]?.[snake1.position.y]?.owner;
      const dir1 = chooseDirection(snake1, grid, config.strategy, snake2.position, s1Stagnation);
      if (dir1) {
        const nextCell1Owner = grid.cells[
          snake1.position.x + (dir1 === "right" ? 1 : dir1 === "left" ? -1 : 0)
        ]?.[
          snake1.position.y + (dir1 === "down" ? 1 : dir1 === "up" ? -1 : 0)
        ]?.owner;
        const willPaintNew = nextCell1Owner !== undefined && nextCell1Owner !== snake1.id;
        moveSnake(snake1, dir1, grid);
        if (willPaintNew) {
          s1Stagnation = 0;
        } else {
          s1Stagnation++;
        }
      } else {
        snake1.alive = false;
      }
    }

    // Snake 2 moves
    if (snake2.alive && snake2CanMove) {
      const dir2 = chooseDirection(snake2, grid, config.strategy, snake1.position, s2Stagnation);
      if (dir2) {
        const nextCell2Owner = grid.cells[
          snake2.position.x + (dir2 === "right" ? 1 : dir2 === "left" ? -1 : 0)
        ]?.[
          snake2.position.y + (dir2 === "down" ? 1 : dir2 === "up" ? -1 : 0)
        ]?.owner;
        const willPaintNew = nextCell2Owner !== undefined && nextCell2Owner !== snake2.id;
        moveSnake(snake2, dir2, grid);
        if (willPaintNew) {
          s2Stagnation = 0;
        } else {
          s2Stagnation++;
        }
      } else {
        snake2.alive = false;
      }
    }

    // Record frame
    const currentScore = calculateScore(grid);
    frames.push({
      turn,
      grid: cloneGrid(grid),
      snakes: [cloneSnake(snake1), cloneSnake(snake2)],
      score: currentScore,
    });

    // End the game when all unpainted cells have been covered
    if (countUnpainted(grid) === 0) {
      break;
    }
  }

  const finalScore = calculateScore(grid);
  const winner: GameWinner =
    finalScore.snake1 > finalScore.snake2
      ? "snake1"
      : finalScore.snake2 > finalScore.snake1
        ? "snake2"
        : "draw";

  return {
    frames,
    finalScore,
    winner,
  };
}
