import { UserStats } from "../types";
import { DEFAULT_NUMERAL_FONT, NumeralFont } from "./numerals";
import { CARD_WIDTH, cardSvg, galleryTheme, number, numberSize } from "./theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FLAME = ["...1...", "..11...", "..111..", ".1111..", ".11211.", ".12221.", "1122211", ".12221."];

function dateLabel(date: string, withYear = false): string {
  const [year, month, day] = date.split("-");
  if (!year || !MONTHS[Number(month) - 1] || !Number(day)) return "—";
  return `${MONTHS[Number(month) - 1]} ${Number(day)}${withYear ? `, ${year}` : ""}`;
}

function range(start: string, end: string, currentYear: string): string {
  const crossYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${dateLabel(start, crossYear)} – ${dateLabel(end, crossYear || end.slice(0, 4) !== currentYear)}`;
}

/** A living pixel flame is the focal point; the numbers themselves stay steady. */
export function renderStreakSVG(stats: UserStats, dark: boolean, font: NumeralFont = DEFAULT_NUMERAL_FONT): string {
  const theme = galleryTheme(dark);
  const year = stats.generatedAt.slice(0, 4);
  const current = stats.currentStreak.days;
  const flame = FLAME.flatMap((row, y) => [...row].map((cell, x) => cell === "." ? "" :
    `<rect${current > 0 ? ' class="flame-cell"' : ""} x="${359.5 + x * 5}" y="${43 + y * 5}" width="4" height="4" rx="1.1" fill="${current > 0 ? cell === "2" ? '#ffe182' : '#ff9854' : theme.muted}" style="animation-delay:-${((y * .37 + x * .53) % 2.8).toFixed(2)}s"/>`
  )).join("");
  const embers = current > 0 ? [0, 1, 2].map(i =>
    `<rect class="ember" x="${366 + i * 9}" y="${49 + (i % 2) * 8}" width="2.5" height="2.5" rx=".7" fill="#ffd073" style="animation-delay:-${i * 1.1}s"/>`
  ).join("") : "";
  const columns = [
    { x: 125.5, value: stats.totalContributions, label: "Total Contributions", detail: stats.firstContribution ? `Since ${dateLabel(stats.firstContribution, true)}` : "All time" },
    { x: 376.5, value: current, label: "Current Streak", detail: current > 0 ? range(stats.currentStreak.start, stats.currentStreak.end, year) : "A fresh start awaits" },
    { x: 627.5, value: stats.longestStreak.days, label: "Longest Streak", detail: stats.longestStreak.days > 0 ? range(stats.longestStreak.start, stats.longestStreak.end, year) : "No streak recorded yet" },
  ];
  const ramps = dark ? [["#a1f6b7", "#39d3a2"], ["#ffe18a", "#ff9854"], ["#d7b5ff", "#a78bfa"]]
    : [["#238636", "#16765f"], ["#ac6700", "#b84d13"], ["#8250df", "#6639ba"]];
  const gradients = ramps.map((colors, i) =>
    `<linearGradient id="streak-${i}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`
  ).join("");
  const metrics = columns.map((col, i) => {
    const value = number(col.value);
    return `<g text-anchor="middle">
      <text class="number" x="${col.x}" y="125" font-size="${numberSize(value, i === 1 ? 44 : 35, 204)}" style="fill:url(#streak-${i})">${value}</text>
      <text class="label" x="${col.x}" y="149" style="fill:${i === 1 ? dark ? '#ffd084' : '#995610' : theme.text};font-weight:500">${col.label}</text>
      <text class="detail" x="${col.x}" y="173">${col.detail}</text>
    </g>`;
  }).join("\n");
  const separators = [251, 502].flatMap(x => Array.from({ length: 7 }, (_, i) =>
    `<rect x="${x}" y="${92 + i * 8}" width="3" height="3" rx="1" fill="${theme.cool}" opacity="${.22 + (3 - Math.abs(3 - i)) * .1}"/>`
  )).join("");

  return cardSvg("Contribution streaks", `${number(stats.totalContributions)} total contributions. Current streak: ${current} days. Longest streak: ${stats.longestStreak.days} days.`,
    CARD_WIDTH, 195, theme, `
    <defs>${gradients}<radialGradient id="flame-glow"><stop stop-color="#ff9955" stop-opacity="${current > 0 ? '.14' : '0'}"/><stop offset="1" stop-color="#ff9955" stop-opacity="0"/></radialGradient></defs>
    <text class="eyebrow" x="24" y="30">CONSISTENCY</text>
    <text class="detail" x="729" y="30" text-anchor="end">Streaks, measured in days</text>
    <ellipse cx="377" cy="89" rx="102" ry="75" fill="url(#flame-glow)"/>
    ${separators}${flame}${embers}${metrics}`,
    `.flame-cell{animation:flame-light 2.8s ease-in-out infinite}@keyframes flame-light{0%,100%{opacity:1}50%{opacity:.6}}
    .ember{animation:ember-rise 3.3s ease-out infinite;opacity:0}@keyframes ember-rise{0%{opacity:0;transform:translateY(0)}25%{opacity:.8}100%{opacity:0;transform:translateY(-19px)}}
    @media(prefers-reduced-motion:reduce){.flame-cell{animation:none}.ember{display:none}}`, font);
}
