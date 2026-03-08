import { Snake, RenderConfig, DEFAULT_RENDER_CONFIG, CellOwner } from "../types";

/**
 * Render a snake head as a circle SVG element
 */
export function renderSnakeHead(
  snake: Snake,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  if (!snake.alive && snake.trail.length === 0) return "";

  const { cellSize, cellGap, palette } = config;
  const headPos = snake.position;

  const cx = headPos.x * (cellSize + cellGap) + cellSize / 2;
  const cy = headPos.y * (cellSize + cellGap) + cellSize / 2;
  const r = cellSize / 2 + 1;

  const color =
    snake.id === CellOwner.Snake1 ? palette.snake1Color : palette.snake2Color;

  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
}

/**
 * Render snake eyes (two small white dots)
 */
export function renderSnakeEyes(
  snake: Snake,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  const { cellSize, cellGap } = config;
  const headPos = snake.position;

  const cx = headPos.x * (cellSize + cellGap) + cellSize / 2;
  const cy = headPos.y * (cellSize + cellGap) + cellSize / 2;
  const eyeR = 1.5;
  const eyeOffset = 2.5;

  return [
    `<circle cx="${cx - eyeOffset}" cy="${cy - eyeOffset}" r="${eyeR}" fill="white" />`,
    `<circle cx="${cx + eyeOffset}" cy="${cy - eyeOffset}" r="${eyeR}" fill="white" />`,
  ].join("\n    ");
}
