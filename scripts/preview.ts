import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { renderAmbientSVG } from "../src/renderer/ambient";
import { renderStatsSVG } from "../src/renderer/stats";
import { renderLangsSVG } from "../src/renderer/langs";
import { renderStreakSVG } from "../src/renderer/streak";
import { renderTrophySVG } from "../src/renderer/trophy";
import { NumeralFont, resolveNumeralFont } from "../src/renderer/numerals";
import { Grid, UserStats, DEFAULT_RENDER_CONFIG, DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE } from "../src/types";

// Use the checked-in snapshot. Previewing and regenerating examples need no token.
const grid: Grid = JSON.parse(readFileSync("docs/grid.json", "utf8"));
const stats: UserStats = JSON.parse(readFileSync("docs/stats.json", "utf8"));
const seed = 20260907;
const config = (dark: boolean) => ({ ...DEFAULT_RENDER_CONFIG, darkMode: dark,
  palette: dark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE });
const renderers: Record<string, (dark: boolean, font?: NumeralFont) => string> = {
  ambient: dark => renderAmbientSVG(grid, config(dark), seed),
  stats: (dark, font) => renderStatsSVG(stats, dark, font),
  langs: (dark, font) => renderLangsSVG(stats, dark, font),
  streak: (dark, font) => renderStreakSVG(stats, dark, font),
  trophy: (dark, font) => renderTrophySVG(stats, dark, font),
};

if (process.argv.includes("--write")) {
  for (const name of ["ambient"]) {
    for (const dark of [false, true]) {
      const path = `docs/${name}${dark ? "-dark" : ""}.svg`;
      writeFileSync(path, renderers[name](dark));
      console.log(`Rendered ${path}`);
    }
  }
} else {
  const port = Number(process.env.PORT ?? 4173);
  createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const dark = url.searchParams.get("theme") !== "light";
    const font = resolveNumeralFont(url.searchParams.get("font"));
    const name = url.pathname.replace("/api/", "");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname.startsWith("/api/") && Object.hasOwnProperty.call(renderers, name)) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.end(renderers[name](dark, font));
      return;
    }
    if (url.pathname !== "/") {
      res.writeHead(404).end("Not found");
      return;
    }
    const mode = dark ? "dark" : "light";
    const img = (name: string) => `<img src="/api/${name}?theme=${mode}&amp;font=${font}" alt="${name} preview">`;
    const choices = [["inter", "Inter"], ["outfit", "Outfit"], ["space", "Space Grotesk"], ["mono", "Original mono"]]
      .map(([id, label]) => `<a href="/?theme=${mode}&amp;font=${id}"${font === id ? ' aria-current="true"' : ""}>${label}</a>`).join("");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contribution gallery · Preview</title>
      <style>:root{color-scheme:${mode}}*{box-sizing:border-box}body{margin:0;background:${dark ? "#0d1117" : "#ffffff"};color:${dark ? "#9aadb9" : "#5d707c"};font:13px system-ui}header{max-width:801px;margin:32px auto 24px;padding:0 24px;display:flex;justify-content:space-between}a{color:inherit;text-decoration:none}nav{display:flex;gap:18px}main{max-width:801px;margin:auto;padding:0 24px 48px}.type-options{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px;font-size:12px}.type-options nav{gap:8px;flex-wrap:wrap}.type-options a{padding:7px 11px;border:1px solid ${dark ? "#293344" : "#dce5e8"};border-radius:7px}.type-options [aria-current]{color:${dark ? "#56e0bd" : "#16765f"};border-color:currentColor}article{display:flex;flex-direction:column;gap:12px}img{display:block;width:100%;height:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}footer{margin:18px 0 32px;text-align:center;font-size:11px}details{margin-top:32px}summary{cursor:pointer;margin-bottom:16px}@media(max-width:540px){header,main{padding-left:16px;padding-right:16px}.pair{grid-template-columns:1fr}}</style></head>
      <body><header><a href="/">CONTRIBUTION GALLERY</a><nav><a href="/?theme=dark&amp;font=${font}">Dark</a><a href="/?theme=light&amp;font=${font}">Light</a></nav></header>
      <main><div class="type-options"><span>Numerals</span><nav aria-label="Numeric font">${choices}</nav></div><article>${img("ambient")}<div class="pair">${img("stats")}${img("langs")}</div>${img("streak")}${img("trophy")}</article>
      <footer>Generated from the repository's saved contribution data.</footer></main></body></html>`);
  }).listen(port, "127.0.0.1", () => console.log(`Gallery preview: http://127.0.0.1:${port}`));
}
