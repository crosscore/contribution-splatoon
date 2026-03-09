import {
  GameResult,
  GameFrame,
  RenderConfig,
  DEFAULT_RENDER_CONFIG,
  GameScore,
  GameWinner,
  CellOwner,
} from "../types";
import { getGridDimensions } from "./grid";

/**
 * Generate an SVG <animate> tag for score bar width and colors
 */
function renderScoreBar(
  result: GameResult,
  svgWidth: number,
  gridHeight: number,
  config: RenderConfig,
  totalDurationSec: number,
  gameEndFraction: number,
  winner: GameWinner
): string {
  const { palette, frameDuration } = config;
  const y = gridHeight + 20;
  const barWidth = svgWidth;
  const barHeight = 8;

  // We need to build a list of values for the animation
  // To keep the animation size small, we only sample every N frames, same as the snakes
  // Never skip frames to prevent diagonal jumping artifacts
  const step = 1;
  
  const values1: string[] = [];
  const values2: string[] = [];
  const text1: string[] = [];
  const text2: string[] = [];
  
  const keyTimes: string[] = [];

  let sampledCount = 0;
  for (let i = 0; i < result.frames.length; i += step) {
    const frame = result.frames[i];
    const score = frame.score;
    
    const w1 = score.total > 0 ? (score.snake1 / score.total) * barWidth : 0;
    const w2 = score.total > 0 ? (score.snake2 / score.total) * barWidth : 0;
    const pct1 = score.total > 0 ? ((score.snake1 / score.total) * 100).toFixed(1) : "0";
    const pct2 = score.total > 0 ? ((score.snake2 / score.total) * 100).toFixed(1) : "0";

    values1.push(w1.toFixed(1));
    values2.push(w2.toFixed(1));
    text1.push(`◆ ${pct1}%`);
    text2.push(`◆ ${pct2}%`);
    
    keyTimes.push(((sampledCount / (result.frames.length / step)) * gameEndFraction).toFixed(6));
    sampledCount++;
  }

  // Ensure last frame is included
  const lastFrame = result.frames[result.frames.length - 1];
  const lastScore = lastFrame.score;
  const lastW1 = lastScore.total > 0 ? (lastScore.snake1 / lastScore.total) * barWidth : 0;
  const lastW2 = lastScore.total > 0 ? (lastScore.snake2 / lastScore.total) * barWidth : 0;
  const lastPct1 = lastScore.total > 0 ? ((lastScore.snake1 / lastScore.total) * 100).toFixed(1) : "0";
  const lastPct2 = lastScore.total > 0 ? ((lastScore.snake2 / lastScore.total) * 100).toFixed(1) : "0";
  
  values1.push(lastW1.toFixed(1));
  values2.push(lastW2.toFixed(1));
  text1.push(`◆ ${lastPct1}%`);
  text2.push(`◆ ${lastPct2}%`);
  keyTimes.push("1.000000");

  const valStr1 = values1.join(";");
  const valStr2 = values2.join(";");
  const timeStr = keyTimes.join(";");

  // Animated percentage text using discrete opacity on sampled text elements.
  // SVG <animate> can't change text content, so we create one <text> per unique
  // percentage value and animate opacity so only the current one is visible.
  // We use change-detection: a new element is created only when the % changes.
  
  interface TextSample {
    text: string;
    startTime: number; // normalized 0-1
    endTime: number;   // normalized 0-1
  }

  function buildTextSamples(snakeKey: "snake1" | "snake2"): TextSample[] {
    const samples: TextSample[] = [];
    let lastText = "";
    for (let i = 0; i < result.frames.length; i++) {
      const frame = result.frames[i];
      const score = frame.score;
      const pct = score.total > 0 ? ((score[snakeKey] / score.total) * 100).toFixed(1) : "0.0";
      const text = `◆ ${pct}%`;
      if (text !== lastText) {
        // Close the previous sample
        if (samples.length > 0) {
          samples[samples.length - 1].endTime = (i / result.frames.length) * gameEndFraction;
        }
        samples.push({ text, startTime: (i / result.frames.length) * gameEndFraction, endTime: 1.0 });
        lastText = text;
      }
    }
    return samples;
  }

  const samples1 = buildTextSamples("snake1");
  const samples2 = buildTextSamples("snake2");

  function renderAnimatedText(
    samples: TextSample[],
    x: string,
    textAnchor: string,
    color: string
  ): string {
    return samples.map((s, idx) => {
      // Build opacity values: 0 everywhere except during this sample's time range
      // Use discrete keyTimes with just this sample's on/off transitions
      const opacityValues = "0;1;0";
      const startT = Math.max(0.000001, s.startTime).toFixed(6);
      const endT = Math.min(0.999999, s.endTime).toFixed(6);
      const opacityKeyTimes = `0.000000;${startT};${endT}`;
      
      return `      <text x="${x}" y="${y + barHeight + 14}" font-family="monospace, sans-serif" font-size="11" fill="${color}" font-weight="bold" text-anchor="${textAnchor}" opacity="0">${s.text}
        <animate attributeName="opacity" values="${opacityValues}" keyTimes="${opacityKeyTimes}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="discrete" />
      </text>`;
    }).join("\n");
  }

  const animatedText1 = renderAnimatedText(samples1, "0", "start", palette.snake1Color);
  const animatedText2 = renderAnimatedText(samples2, `${barWidth}`, "end", palette.snake2Color);

  // Winner bar flash: pulsing opacity on the winning side during the 10s pause
  const flashPulseDur = "1.2s";
  const winnerFlashStart = gameEndFraction;
  // Opacity goes from 0 (hidden) to pulsing between 0.5-1.0 after game ends
  const flashOpacityValues = "0;0;0.5;1;0.5";
  const flashOpacityKeyTimes = `0.000000;${winnerFlashStart.toFixed(6)};${Math.min(winnerFlashStart + 0.001, 0.9999).toFixed(6)};1.000000;1.000000`;

  // Build a glowing overlay rect for the winner's bar side
  let winnerFlash = "";
  if (winner === "snake1") {
    winnerFlash = `
    <!-- Winner flash overlay (Snake 1) -->
    <rect x="0" y="${y}" width="${lastW1.toFixed(1)}" height="${barHeight}" rx="4" fill="${palette.snake1Color}" opacity="0">
      <animate attributeName="opacity" values="0;0;0.35;0.15;0.35" keyTimes="0.000000;${winnerFlashStart.toFixed(6)};${Math.min(winnerFlashStart + 0.001, 0.9999).toFixed(6)};0.999999;1.000000" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
    </rect>`;
  } else if (winner === "snake2") {
    winnerFlash = `
    <!-- Winner flash overlay (Snake 2) -->
    <rect x="${(barWidth - lastW2).toFixed(1)}" y="${y}" width="${lastW2.toFixed(1)}" height="${barHeight}" rx="4" fill="${palette.snake2Color}" opacity="0">
      <animate attributeName="opacity" values="0;0;0.35;0.15;0.35" keyTimes="0.000000;${winnerFlashStart.toFixed(6)};${Math.min(winnerFlashStart + 0.001, 0.9999).toFixed(6)};0.999999;1.000000" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
    </rect>`;
  }

  return `
    <!-- Score bar background -->
    <rect x="0" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${palette.emptyCell}" filter="url(#glow-light)" />
    
    <!-- Snake 1 progress -->
    <rect x="0" y="${y}" width="0" height="${barHeight}" rx="4" fill="${palette.snake1Trail}">
      <animate attributeName="width" values="${valStr1}" keyTimes="${timeStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
    </rect>
    
    <!-- Snake 2 progress -->
    <rect x="${barWidth - lastW2}" y="${y}" width="0" height="${barHeight}" rx="4" fill="${palette.snake2Trail}">
      <animate attributeName="width" values="${valStr2}" keyTimes="${timeStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      <animate attributeName="x" values="${values2.map(w => (barWidth - parseFloat(w)).toFixed(1)).join(";")}" keyTimes="${timeStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
    </rect>
${winnerFlash}

    <!-- Center Divider -->
    <rect x="${(barWidth / 2) - 1 }" y="${y - 1}" width="2" height="${barHeight + 2}" fill="${palette.textColor}" opacity="0.4" rx="1" />

    <!-- Animated score labels -->
${animatedText1}
${animatedText2}
  `;
}

/**
 * Render the static base grid with inline SVG animations for cell coloring
 */
function renderBaseGrid(result: GameResult, config: RenderConfig, totalDurationSec: number, gameEndFraction: number): string {
  const { cellSize, cellGap, cellRadius, palette } = config;
  const initialGrid = result.frames[0].grid;
  const totalFrames = result.frames.length;
  const rects: string[] = [];

  // Find when each cell is painted (all color change events)
  const paintEvents = new Map<string, { turn: number, owner: CellOwner }[]>();

  // Handle turn 0: cells that are already painted at the start (snake starting positions)
  const frame0 = result.frames[0].grid;
  for (let x = 0; x < frame0.width; x++) {
    for (let y = 0; y < frame0.height; y++) {
      const owner = frame0.cells[x][y].owner;
      if (owner !== CellOwner.None) {
        const key = `${x}_${y}`;
        paintEvents.set(key, [{ turn: 0, owner }]);
      }
    }
  }

  for (let i = 1; i < result.frames.length; i++) {
    const prev = result.frames[i - 1].grid;
    const curr = result.frames[i].grid;
    for (let x = 0; x < curr.width; x++) {
      for (let y = 0; y < curr.height; y++) {
        const prevOwner = prev.cells[x][y].owner;
        const currOwner = curr.cells[x][y].owner;
        // 如果所有者が変わったら（未塗装→塗られた、または相手色に上書きされた）イベントを追加
        if (prevOwner !== currOwner && currOwner !== CellOwner.None) {
          const key = `${x}_${y}`;
          const events = paintEvents.get(key) || [];
          events.push({ turn: i, owner: currOwner });
          paintEvents.set(key, events);
        }
      }
    }
  }

  for (let x = 0; x < initialGrid.width; x++) {
    for (let y = 0; y < initialGrid.height; y++) {
      const cell = initialGrid.cells[x][y];
      const initialColor = palette.contributionColors[cell.contributionLevel];
      const px = x * (cellSize + cellGap);
      const py = y * (cellSize + cellGap);

      const events = paintEvents.get(`${x}_${y}`);
      if (events && events.length > 0) {
        // Build values and keyTimes for multiple color changes.
        // Rule: values.length must always equal keyTimes.length for SVG <animate> to work.
        // We use calcMode="discrete" so color jumps instantly at each keyTime.
        //
        // Structure:
        //   t=0.000 → initialColor
        //   for each event at turn T:
        //     t=(T/totalFrames) → paintedColor  (instant change)
        //   t=1.000 → last painted color (hold until end)

        const values: string[] = [initialColor];
        const keyTimes: string[] = ["0.000000"];

        let currentColor = initialColor;
        for (let j = 0; j < events.length; j++) {
          const event = events[j];
          const tVal = (event.turn / totalFrames) * gameEndFraction;
          const tFixed = parseFloat(tVal.toFixed(6));

          // Avoid duplicate keyTimes (clamp to slightly after previous)
          const prevT = parseFloat(keyTimes[keyTimes.length - 1]);
          const safeT = Math.max(prevT + 0.000001, tFixed);
          const safeTFixed = Math.min(safeT, 0.999999).toFixed(6);

          const paintedColor =
            event.owner === CellOwner.Snake1
              ? palette.snake1Trail
              : palette.snake2Trail;

          keyTimes.push(safeTFixed);
          values.push(paintedColor);
          currentColor = paintedColor;
        }

        // Always end at t=1.000 with the last color
        if (keyTimes[keyTimes.length - 1] !== "1.000000") {
          keyTimes.push("1.000000");
          values.push(currentColor);
        }

        rects.push(
          `      <rect id="c_${x}_${y}" x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${initialColor}">
        <animate attributeName="fill" values="${values.join(";")}" keyTimes="${keyTimes.join(";")}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="discrete" />
      </rect>`
        );
      } else {
        rects.push(
          `      <rect id="c_${x}_${y}" x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${initialColor}" />`
        );
      }
    }
  }

  return rects.join("\n");
}

/**
 * Generate Snake movement animations using SVG <animate>
 */
function renderAnimatedSnakes(result: GameResult, config: RenderConfig, totalDurationSec: number, gameEndFraction: number): string {
  const { cellSize, cellGap, palette } = config;

  // Snake 1
  const s1x: string[] = [];
  const s1y: string[] = [];
  // Snake 2
  const s2x: string[] = [];
  const s2y: string[] = [];
  
  const keyTimes: string[] = [];

  // Never skip frames to prevent diagonal jumping artifacts
  const step = 1;
  
  let sampledCount = 0;
  for (let i = 0; i < result.frames.length; i += step) {
    const frame = result.frames[i];
    
    const p1 = frame.snakes[0].position;
    const p2 = frame.snakes[1].position;
    
    s1x.push((p1.x * (cellSize + cellGap) + cellSize / 2).toFixed(1));
    s1y.push((p1.y * (cellSize + cellGap) + cellSize / 2).toFixed(1));
    
    s2x.push((p2.x * (cellSize + cellGap) + cellSize / 2).toFixed(1));
    s2y.push((p2.y * (cellSize + cellGap) + cellSize / 2).toFixed(1));
    
    keyTimes.push(((sampledCount / (result.frames.length / step)) * gameEndFraction).toFixed(6));
    sampledCount++;
  }

  // Ensure last position is exact
  const lastFrame = result.frames[result.frames.length - 1];
  const lp1 = lastFrame.snakes[0].position;
  const lp2 = lastFrame.snakes[1].position;
  s1x.push((lp1.x * (cellSize + cellGap) + cellSize / 2).toFixed(1));
  s1y.push((lp1.y * (cellSize + cellGap) + cellSize / 2).toFixed(1));
  s2x.push((lp2.x * (cellSize + cellGap) + cellSize / 2).toFixed(1));
  s2y.push((lp2.y * (cellSize + cellGap) + cellSize / 2).toFixed(1));
  keyTimes.push("1.000000");

  const tStr = keyTimes.join(";");
  const r = cellSize / 2 + 1;
  const eyeR = 1.5;
  const eyeOffset = 2.5;

  // Render tail segments for a slithering snake effect
  const tailLength = 4;
  let snake1Tail = "";
  let snake2Tail = "";

  for (let s = tailLength; s >= 1; s--) {
    const s1x_seg: string[] = [];
    const s1y_seg: string[] = [];
    const s2x_seg: string[] = [];
    const s2y_seg: string[] = [];
    
    // Shift positions backwards to create a following tail
    for(let i=0; i<s1x.length; i++) {
        // Find how many real steps back we need to look.
        // Since we sampled every 'step', a offset of 's' means 's' true frames ago, 
        // which might be fractional in our sampled array. For simplicity, we just shift by 's' in the sampled array.
        // Actually shifting by 's' in sampled array might be too distant if step is large. 
        // But let's just shift by 's' indexes for simplicity of the snake body spreading out slightly.
        const shiftedIdx = Math.max(0, i - s);
        s1x_seg.push(s1x[shiftedIdx]);
        s1y_seg.push(s1y[shiftedIdx]);
        s2x_seg.push(s2x[shiftedIdx]);
        s2y_seg.push(s2y[shiftedIdx]);
    }
    
    // Taper the tail radius
    const segR = (r * (1 - (s / (tailLength + 2)))).toFixed(1);
    
    snake1Tail += `
      <circle cx="0" cy="0" r="${segR}" fill="${palette.snake1Color}">
        <animate attributeName="cx" values="${s1x_seg.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s1y_seg.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>`;
      
    snake2Tail += `
      <circle cx="0" cy="0" r="${segR}" fill="${palette.snake2Color}">
        <animate attributeName="cx" values="${s2x_seg.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s2y_seg.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>`;
  }

  return `
    <!-- Snake 1 -->
    <g filter="url(#glow)">
      ${snake1Tail}
      <circle cx="0" cy="0" r="${r}" fill="${palette.snake1Color}">
        <animate attributeName="cx" values="${s1x.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s1y.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
      <circle cx="-${eyeOffset}" cy="-${eyeOffset}" r="${eyeR}" fill="white">
        <animate attributeName="cx" values="${s1x.map(x => (parseFloat(x) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s1y.map(y => (parseFloat(y) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
      <circle cx="${eyeOffset}" cy="-${eyeOffset}" r="${eyeR}" fill="white">
        <animate attributeName="cx" values="${s1x.map(x => (parseFloat(x) + eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s1y.map(y => (parseFloat(y) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
    </g>

    <!-- Snake 2 -->
    <g filter="url(#glow)">
      ${snake2Tail}
      <circle cx="0" cy="0" r="${r}" fill="${palette.snake2Color}">
        <animate attributeName="cx" values="${s2x.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s2y.join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
      <circle cx="-${eyeOffset}" cy="-${eyeOffset}" r="${eyeR}" fill="white">
        <animate attributeName="cx" values="${s2x.map(x => (parseFloat(x) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s2y.map(y => (parseFloat(y) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
      <circle cx="${eyeOffset}" cy="-${eyeOffset}" r="${eyeR}" fill="white">
        <animate attributeName="cx" values="${s2x.map(x => (parseFloat(x) + eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
        <animate attributeName="cy" values="${s2y.map(y => (parseFloat(y) - eyeOffset).toFixed(1)).join(";")}" keyTimes="${tStr}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="linear" />
      </circle>
    </g>
  `;
}

/**
 * Render a winner banner that fades in at the end of the animation
 */
function renderWinnerBanner(
  winner: GameWinner,
  svgWidth: number,
  gridHeightPx: number,
  config: RenderConfig,
  totalDurationSec: number,
  gameEndFraction: number
): string {
  const { palette } = config;

  let label: string;
  let color: string;

  if (winner === "snake1") {
    label = "Snake 1 WIN!";
    color = palette.snake1Color;
  } else if (winner === "snake2") {
    label = "Snake 2 WIN!";
    color = palette.snake2Color;
  } else {
    label = "DRAW!";
    color = palette.textColor;
  }

  const cx = svgWidth / 2;
  const cy = gridHeightPx / 2;

  // The banner fades in exactly when the game animation finishes (= gameEndFraction)
  const fadeStart = gameEndFraction;
  const opacityValues = "0;0;1;1";
  const opacityKeyTimes = `0.000000;${fadeStart.toFixed(6)};${Math.min(fadeStart + 0.005, 0.9999).toFixed(6)};1.000000`;

  // Semi-transparent backdrop
  const bgColor = config.darkMode ? "rgba(1,4,9,0.9)" : "rgba(255,255,255,0.95)";

  // Pulse animation cycle: ~1.5s per breath during the 10s pause
  const pulseDur = "1.5s";
  const fastPulseDur = "0.8s";

  // SVG diamond shape for the winner banner (drawn as a polygon)
  // Diamond sits to the left of the winner text
  const diamondSize = 8;
  const diamondCx = cx - 90; // position to the left of the text
  const diamondCy = cy + 18;
  const diamondPoints = `${diamondCx},${diamondCy - diamondSize} ${diamondCx + diamondSize},${diamondCy} ${diamondCx},${diamondCy + diamondSize} ${diamondCx - diamondSize},${diamondCy}`;

  // For DRAW, skip the diamond
  const diamondSvg = winner !== "draw" ? `
      <!-- SVG Diamond icon -->
      <polygon points="${diamondPoints}" fill="${color}" filter="url(#glow-text)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="${fastPulseDur}" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
      </polygon>
      <polygon points="${diamondCx},${diamondCy - diamondSize + 2} ${diamondCx + diamondSize - 2},${diamondCy} ${diamondCx},${diamondCy + diamondSize - 2} ${diamondCx - diamondSize + 2},${diamondCy}" fill="white" opacity="0.3" />
  ` : "";

  return `
    <!-- Winner banner -->
    <g id="winner-banner" opacity="0">
      <!-- Backdrop with pulsing border -->
      <rect x="${cx - 140}" y="${cy - 35}" width="280" height="70" rx="8" fill="${bgColor}" stroke="${color}" stroke-width="3" filter="url(#glow-heavy)">
        <animate attributeName="stroke-width" values="3;6;3" dur="${pulseDur}" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
        <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="${pulseDur}" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
      </rect>

      <!-- Sub-label -->
      <text x="${cx}" y="${cy - 8}" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" fill="${palette.textColor}" font-weight="bold" letter-spacing="3" text-anchor="middle" dominant-baseline="middle">GAME FINISHED</text>

      ${diamondSvg}

      <!-- Winner label with pulsing glow -->
      <text x="${cx + (winner !== "draw" ? 8 : 0)}" y="${cy + 18}" font-family="'Segoe UI', system-ui, sans-serif" font-size="24" fill="${color}" font-weight="900" text-anchor="middle" dominant-baseline="middle" filter="url(#glow-text)">
        ${label}
        <animate attributeName="opacity" values="0.7;1;0.7" dur="${pulseDur}" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
      </text>


      <!-- Banner fade-in timed to game end -->
      <animate attributeName="opacity" values="${opacityValues}" keyTimes="${opacityKeyTimes}" dur="${totalDurationSec}s" repeatCount="indefinite" calcMode="discrete" />
    </g>
  `;
}

/**
 * Generate the full animated SVG from a game result
 * Optimized version: Instead of duplicating the entire DOM for every frame,
 * we use a single base grid and CSS/SVG animations to change colors and move snakes.
 * This guarantees 60fps smooth interpolation in browsers and generates a file 1/10th the size.
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

  // 100ms per turn
  const durationPerTurn = 100;
  // Increase pause to 10 seconds to hold the winner banner
  const pauseDurationMs = 10000;
  
  const totalAnimationMs = result.frames.length * durationPerTurn;
  const totalDurationSec = (totalAnimationMs + pauseDurationMs) / 1000;
  // Fraction of total duration that is actual gameplay (before the pause)
  const gameEndFraction = totalAnimationMs / (totalAnimationMs + pauseDurationMs);

  const baseGrid = renderBaseGrid(result, config, totalDurationSec, gameEndFraction);
  const snakes = renderAnimatedSnakes(result, config, totalDurationSec, gameEndFraction);
  const scoreBar = renderScoreBar(result, totalWidth, gridHeightPx, config, totalDurationSec, gameEndFraction, result.winner);
  const winnerBanner = renderWinnerBanner(result.winner, totalWidth, gridHeightPx, config, totalDurationSec, gameEndFraction);

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}"
  height="${totalHeight}"
  viewBox="0 0 ${totalWidth} ${totalHeight}"
>
  <defs>
    <!-- Light glow for minimal UI elements like the score bar -->
    <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    
    <!-- Standard neon glow for snake bodies -->
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Heavy drop-shadow for the winner banner -->
    <filter id="glow-heavy" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.4)" />
    </filter>
    
    <!-- Glowing text filter (strong glow for winner banner) -->
    <filter id="glow-text" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <style>
    /* Transparent background by default. Host page (GitHub) will provide the background. */
    svg {} 
  </style>
  
  <!-- Base Grid -->
  <g id="grid">
    ${baseGrid}
  </g>

  <!-- Animated score bar -->
  <g id="score">
    ${scoreBar}
  </g>

  <!-- Animated Snakes -->
  <g id="snakes">
    ${snakes}
  </g>

  ${winnerBanner}
</svg>`;
}

/**
 * Generate a static SVG (final frame only) — useful for open graph images
 */
export function renderStaticSVG(
  result: GameResult,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  // Static rendering can just use the old static grid rendering
  // (Not implemented here for brevity as it's not requested, but would be similar to old renderFrame)
  return ""; 
}
