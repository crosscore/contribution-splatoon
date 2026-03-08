import {
  GameResult,
  GameFrame,
  RenderConfig,
  DEFAULT_RENDER_CONFIG,
  GameScore,
  CellOwner,
} from "../types";
import { renderGridCells, getGridDimensions } from "./grid";
import { renderSnakeHead, renderSnakeEyes } from "./snake";

/**
 * Render the score display
 */
function renderScoreBar(
  score: GameScore,
  svgWidth: number,
  gridHeight: number,
  config: RenderConfig
): string {
  const { palette } = config;
  const y = gridHeight + 20;

  const pct1 =
    score.total > 0 ? ((score.snake1 / score.total) * 100).toFixed(1) : "0";
  const pct2 =
    score.total > 0 ? ((score.snake2 / score.total) * 100).toFixed(1) : "0";

  // Score bar background
  const barWidth = svgWidth;
  const barHeight = 6;
  const snake1Width = score.total > 0 ? (score.snake1 / score.total) * barWidth : 0;
  const snake2Width = score.total > 0 ? (score.snake2 / score.total) * barWidth : 0;

  return `
    <!-- Score bar -->
    <rect x="0" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="${palette.emptyCell}" />
    <rect x="0" y="${y}" width="${snake1Width}" height="${barHeight}" rx="3" fill="${palette.snake1Trail}" />
    <rect x="${barWidth - snake2Width}" y="${y}" width="${snake2Width}" height="${barHeight}" rx="3" fill="${palette.snake2Trail}" />

    <!-- Score labels -->
    <text x="0" y="${y + barHeight + 14}" font-family="monospace, sans-serif" font-size="11" fill="${palette.snake1Color}" font-weight="bold">🐍 ${pct1}%</text>
    <text x="${barWidth}" y="${y + barHeight + 14}" font-family="monospace, sans-serif" font-size="11" fill="${palette.snake2Color}" font-weight="bold" text-anchor="end">🐍 ${pct2}%</text>
  `;
}

/**
 * Generate a single SVG frame
 */
function renderFrame(
  frame: GameFrame,
  config: RenderConfig,
  svgWidth: number,
  gridHeight: number
): string {
  const gridCells = renderGridCells(frame.grid, config);
  const snake1Head = renderSnakeHead(frame.snakes[0], config);
  const snake1Eyes = renderSnakeEyes(frame.snakes[0], config);
  const snake2Head = renderSnakeHead(frame.snakes[1], config);
  const snake2Eyes = renderSnakeEyes(frame.snakes[1], config);
  const scoreBar = renderScoreBar(frame.score, svgWidth, gridHeight, config);

  return `
    <!-- Grid cells -->
    ${gridCells}
    <!-- Snake heads -->
    ${snake1Head}
    ${snake1Eyes}
    ${snake2Head}
    ${snake2Eyes}
    ${scoreBar}
  `;
}

/**
 * Generate the full animated SVG from a game result
 */
export function renderAnimatedSVG(
  result: GameResult,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  const firstFrame = result.frames[0];
  const { width: gridWidthPx, height: gridHeightPx } = getGridDimensions(
    firstFrame.grid,
    config
  );

  // Extra space for score bar
  const totalHeight = gridHeightPx + 46;
  const totalWidth = gridWidthPx;

  // Sample frames to keep animation manageable
  // Take every Nth frame to keep total under ~200 frames
  const maxFrames = 200;
  const step = Math.max(1, Math.floor(result.frames.length / maxFrames));
  const sampledFrames: GameFrame[] = [];
  for (let i = 0; i < result.frames.length; i += step) {
    sampledFrames.push(result.frames[i]);
  }
  // Always include last frame
  const lastFrame = result.frames[result.frames.length - 1];
  if (sampledFrames[sampledFrames.length - 1] !== lastFrame) {
    sampledFrames.push(lastFrame);
  }

  const totalDuration = sampledFrames.length * config.frameDuration;
  const totalDurationSec = totalDuration / 1000;

  // Generate CSS keyframes
  const keyframes = sampledFrames
    .map((_, i) => {
      const pctStart = ((i / sampledFrames.length) * 100).toFixed(2);
      const pctEnd = (((i + 1) / sampledFrames.length) * 100).toFixed(2);
      return `${pctStart}%, ${
        i === sampledFrames.length - 1 ? "100" : pctEnd
      }% { visibility: ${i === 0 ? "visible" : "hidden"}; }`;
    })
    .join("\n      ");

  // Generate frame groups
  const frameGroups = sampledFrames
    .map((frame, i) => {
      const content = renderFrame(frame, config, totalWidth, gridHeightPx);
      const pctStart = ((i / sampledFrames.length) * 100).toFixed(2);
      const pctEnd = (
        ((i + 0.99) / sampledFrames.length) *
        100
      ).toFixed(2);

      return `<g class="frame" style="animation-delay: ${
        (i * config.frameDuration) / 1000
      }s;">
      ${content}
    </g>`;
    })
    .join("\n  ");

  // Use a different animation approach: each frame is visible for its slice of time
  const frameCSS = sampledFrames
    .map((_, i) => {
      const showStart = ((i / sampledFrames.length) * 100).toFixed(2);
      const showEnd = (((i + 1) / sampledFrames.length) * 100).toFixed(2);
      return `.frame:nth-child(${i + 1}) { animation: frame${
        i + 1
      } ${totalDurationSec}s steps(1) infinite; }
      @keyframes frame${i + 1} {
        0%, ${showEnd}%, 100% { visibility: hidden; }
        ${showStart}% { visibility: visible; }
      }`;
    })
    .join("\n      ");

  // Pause on last frame for a bit longer
  const lastPauseFrames = Math.min(30, Math.floor(sampledFrames.length * 0.15));
  const pauseDuration = lastPauseFrames * config.frameDuration;

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}"
  height="${totalHeight}"
  viewBox="0 0 ${totalWidth} ${totalHeight}"
>
  <style>
    svg { background: ${config.palette.background}; }
    .frame { visibility: hidden; }
    ${frameCSS}
  </style>
  ${frameGroups}
</svg>`;
}

/**
 * Generate a static SVG (final frame only) — useful for open graph images
 */
export function renderStaticSVG(
  result: GameResult,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  const lastFrame = result.frames[result.frames.length - 1];
  const { width: gridWidthPx, height: gridHeightPx } = getGridDimensions(
    lastFrame.grid,
    config
  );

  const totalHeight = gridHeightPx + 46;
  const totalWidth = gridWidthPx;

  const content = renderFrame(lastFrame, config, totalWidth, gridHeightPx);

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}"
  height="${totalHeight}"
  viewBox="0 0 ${totalWidth} ${totalHeight}"
>
  <style>
    svg { background: ${config.palette.background}; }
  </style>
  ${content}
</svg>`;
}
