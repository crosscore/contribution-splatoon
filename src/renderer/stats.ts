import { UserStats } from "../types";
import { cardSvg, galleryTheme, HALF_HEIGHT, HALF_WIDTH, number, numberSize, pixelMark } from "./theme";

/** One primary metric and four supporting totals; readable even without animation. */
export function renderStatsSVG(stats: UserStats, dark: boolean): string {
  const theme = galleryTheme(dark);
  const commits = number(stats.commits);
  const colors = dark ? ["#fbc65b", "#bc98ff", "#70c9ff", "#f78fba"] : ["#a86b09", "#8250df", "#0969da", "#bf3989"];
  const icons = [
    ["..1..", ".111.", "11111", ".111.", "11.11"],
    ["1...1", "1...1", "1...1", ".1.1.", "..1.."],
    [".111.", "1...1", "1.1.1", "1...1", ".111."],
    [".111.", ".111.", ".....", "11111", "11111"],
  ];
  const rows = [
    { label: "Stars earned", value: stats.stars },
    { label: "Pull requests", value: stats.pullRequests },
    { label: "Issues opened", value: stats.issues },
    { label: "Followers", value: stats.followers },
  ];
  const metrics = rows.map((row, i) => {
    const x = 24 + (i % 2) * 173;
    const y = 174 + Math.floor(i / 2) * 52;
    const value = number(row.value);
    const icon = icons[i].flatMap((line, dy) => [...line].map((cell, dx) => cell === "." ? "" :
      `<rect class="metric-pixel" x="${x + dx * 3.5}" y="${y - 14 + dy * 3.5}" width="2.5" height="2.5" rx=".7" fill="${colors[i]}" style="animation-delay:-${(dy + dx) * .24}s"/>`
    )).join("");
    return `${icon}<text class="number" x="${x + 27}" y="${y}" font-size="${numberSize(value, 23, 122)}" style="fill:${colors[i]}">${value}</text>
    <text class="detail" x="${x + 27}" y="${y + 17}">${row.label}</text>`;
  }).join("\n");

  return cardSvg("GitHub activity", `${stats.login}: ${commits} commits, ${rows.map(r => `${number(r.value)} ${r.label.toLowerCase()}`).join(", ")}. All-time totals.`,
    HALF_WIDTH, HALF_HEIGHT, theme, `
    <text class="eyebrow" x="24" y="29">ALL-TIME ACTIVITY</text>
    <text class="heading" x="24" y="54">GitHub Stats</text>
    ${pixelMark(324, 24, theme)}
    <defs><linearGradient id="commits" x2="1" y2="1"><stop stop-color="${dark ? '#b6f5bb' : '#2da44e'}"/><stop offset="1" stop-color="${dark ? '#56e0bd' : '#16765f'}"/></linearGradient></defs>
    <text class="number" x="22" y="105" font-size="${numberSize(commits, 39, 327)}" style="fill:url(#commits)">${commits}</text>
    <circle cx="28" cy="123" r="3" fill="${theme.accent}"/>
    <text class="label" x="39" y="127">commits · all time</text>
    <path d="M24 144.5H351" stroke="${theme.border}"/>
    ${metrics}`, `.metric-pixel{animation:pixel-glow 4s ease-in-out infinite}@keyframes pixel-glow{0%,100%{opacity:.6}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.metric-pixel{animation:none}}`);
}
