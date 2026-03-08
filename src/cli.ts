import * as fs from "fs";
import * as path from "path";
import { fetchContributions, createMockGrid } from "./fetcher";
import { runGame } from "./game/engine";
import { renderAnimatedSVG } from "./renderer/animation";
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_DARK_PALETTE,
  RenderConfig,
  GameConfig,
  Strategy,
} from "./types";

/**
 * CLI entry point for local development and testing
 *
 * Usage:
 *   npx tsx src/cli.ts --user <github_username> [options]
 *   npx tsx src/cli.ts --mock [options]
 *
 * Options:
 *   --user <name>          GitHub username
 *   --mock                 Use mock data (no API call)
 *   --output <path>        Output file path (default: output.svg)
 *   --dark                 Use dark mode palette
 *   --strategy <strategy>  AI strategy: aggressive|balanced|random (default: aggressive)
 *   --token <token>        GitHub token for API access
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const hasFlag = (flag: string): boolean => args.includes(flag);

  const username = getArg("--user");
  const useMock = hasFlag("--mock");
  const outputPath = getArg("--output") || "output.svg";
  const isDark = hasFlag("--dark");
  const strategy = (getArg("--strategy") || "aggressive") as Strategy;
  const token = getArg("--token") || process.env.GITHUB_TOKEN;

  if (!username && !useMock) {
    console.error("Usage: npx tsx src/cli.ts --user <username> [--output output.svg] [--dark] [--strategy aggressive]");
    console.error("       npx tsx src/cli.ts --mock [--output output.svg] [--dark]");
    process.exit(1);
  }

  console.log("🦑 contribution-splatoon CLI");
  console.log("──────────────────────────────");

  // Fetch or generate grid
  let grid;
  if (useMock) {
    console.log("📊 Using mock contribution data...");
    grid = createMockGrid();
  } else {
    console.log(`📊 Fetching contributions for ${username}...`);
    grid = await fetchContributions(username!, token);
  }

  console.log(`   Grid: ${grid.width}×${grid.height} (${grid.width * grid.height} cells)`);

  // Run game
  const gameConfig: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    strategy,
  };

  console.log(`🎮 Running game (strategy: ${strategy})...`);
  const result = runGame(grid, gameConfig);
  console.log(`✅ Finished in ${result.frames.length} turns`);
  console.log(
    `   Score: Snake1 ${result.finalScore.snake1} (${((result.finalScore.snake1 / result.finalScore.total) * 100).toFixed(1)}%) vs Snake2 ${result.finalScore.snake2} (${((result.finalScore.snake2 / result.finalScore.total) * 100).toFixed(1)}%)`
  );

  // Render
  const renderConfig: RenderConfig = {
    ...DEFAULT_RENDER_CONFIG,
    darkMode: isDark,
    palette: isDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE,
  };

  console.log(`🎨 Rendering ${isDark ? "dark" : "light"} mode SVG...`);
  const svg = renderAnimatedSVG(result, renderConfig);

  // Write output
  const dir = path.dirname(outputPath);
  if (dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, svg, "utf-8");
  console.log(`📁 Saved: ${outputPath} (${(svg.length / 1024).toFixed(1)} KB)`);
  console.log("🎉 Done! Open the SVG in a browser to see the animation.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
