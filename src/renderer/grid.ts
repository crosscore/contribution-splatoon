import { Grid, CellOwner, RenderConfig, DEFAULT_RENDER_CONFIG } from "../types";

/**
 * Render the grid as SVG rect elements for a single frame
 */
export function renderGridCells(
  grid: Grid,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): string {
  const rects: string[] = [];
  const { cellSize, cellGap, cellRadius, palette } = config;

  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const cell = grid.cells[x][y];
      let color: string;

      switch (cell.owner) {
        case CellOwner.Snake1:
          color = palette.snake1Trail;
          break;
        case CellOwner.Snake2:
          color = palette.snake2Trail;
          break;
        case CellOwner.None:
        default:
          color = palette.contributionColors[cell.contributionLevel];
          break;
      }

      const px = x * (cellSize + cellGap);
      const py = y * (cellSize + cellGap);

      rects.push(
        `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${color}" />`
      );
    }
  }

  return rects.join("\n    ");
}

/**
 * Get the SVG dimensions for a grid
 */
export function getGridDimensions(
  grid: Grid,
  config: RenderConfig = DEFAULT_RENDER_CONFIG
): { width: number; height: number } {
  const { cellSize, cellGap } = config;
  return {
    width: grid.width * (cellSize + cellGap) - cellGap,
    height: grid.height * (cellSize + cellGap) - cellGap,
  };
}
