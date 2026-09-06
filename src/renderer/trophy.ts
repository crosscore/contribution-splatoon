import { UserStats } from "../types";
import { CARD_WIDTH, cardSvg, galleryTheme, number, numberSize } from "./theme";

const RANKS = ["SSS", "SS", "S", "AAA", "AA", "A", "B", "C"] as const;
const TROPHY = [".1111111.", "2.11111.2", ".2111112.", "..11111..", "....1....", "...111...", "..11111.."];

interface Category { title: string; value: number; thresholds: number[]; }

function categories(stats: UserStats): Category[] {
  return [
    { title: "Commits", value: stats.commits, thresholds: [4000, 2000, 1000, 500, 200, 100, 50, 1] },
    { title: "Followers", value: stats.followers, thresholds: [800, 400, 200, 100, 50, 25, 10, 1] },
    { title: "Stars", value: stats.stars, thresholds: [2000, 700, 200, 100, 50, 30, 10, 1] },
    { title: "Repos", value: stats.repos, thresholds: [150, 100, 50, 30, 20, 10, 5, 1] },
    { title: "Pull requests", value: stats.pullRequests, thresholds: [1000, 500, 200, 100, 50, 25, 10, 1] },
    { title: "Issues", value: stats.issues, thresholds: [500, 300, 150, 80, 40, 20, 8, 1] },
    { title: "Reviews", value: stats.reviews, thresholds: [500, 300, 150, 80, 40, 20, 8, 1] },
  ];
}

/** Pixel trophies retain their color and glint, with more space around each badge. */
export function renderTrophySVG(stats: UserStats, dark: boolean): string {
  const theme = galleryTheme(dark);
  const cats = categories(stats);
  const badges = cats.map((cat, i) => {
    const rank = cat.thresholds.findIndex(threshold => cat.value >= threshold);
    const label = rank < 0 ? "—" : RANKS[rank];
    const color = rank < 0 ? theme.muted : rank <= 2 ? theme.warm : rank <= 5 ? theme.cool : rank === 6 ? dark ? '#70c9ff' : '#0969da' : theme.accent;
    const center = 24 + (i + .5) * (705 / 7);
    const cup = TROPHY.flatMap((row, y) => [...row].map((cell, x) => cell === "." ? "" :
      `<rect x="${center - 19.75 + x * 4.5}" y="${49 + y * 4.5}" width="3.5" height="3.5" rx=".9" fill="${color}"${cell === "2" ? ' opacity=".5"' : ""}/>
      ${rank >= 0 ? `<rect class="trophy-glint" x="${center - 19.75 + x * 4.5}" y="${49 + y * 4.5}" width="3.5" height="3.5" rx=".9" fill="#ffffff" style="animation-delay:-${(i * .7 + x * .09 + y * .025).toFixed(3)}s"/>` : ""}`
    )).join("");
    const value = number(cat.value);
    return `<g><title>${cat.title}: ${value}, rank ${rank < 0 ? "unranked" : label}</title>
      ${i > 0 ? `<path d="M${center - 50.36} 62V153" stroke="${theme.border}"/>` : ""}
      ${cup}
      ${rank >= 0 && rank <= 2 ? `<path class="sparkle" d="M${center - 26} 49v6m-3-3h6M${center + 26} 71v5m-2.5-2.5h5" stroke="${color}" stroke-linecap="round" style="animation-delay:-${i * .4}s"/>` : ""}
      <text x="${center}" y="98" text-anchor="middle" font-size="10" font-weight="600" letter-spacing="1" fill="${color}">${label}</text>
      <text class="number" x="${center}" y="126" text-anchor="middle" font-size="${numberSize(value, 21, 86)}">${value}</text>
      <text class="detail" x="${center}" y="146" text-anchor="middle">${cat.title}</text>
    </g>`;
  }).join("\n");

  return cardSvg("GitHub milestones", cats.map(cat => {
    const rank = cat.thresholds.findIndex(t => cat.value >= t);
    return `${cat.title}: ${number(cat.value)}, ${RANKS[rank] ?? "unranked"}`;
  }).join(". "), CARD_WIDTH, 169, theme, `
    <text class="eyebrow" x="24" y="30">MILESTONES</text>
    <text class="detail" x="729" y="30" text-anchor="end">Seven milestones. Always growing.</text>
    ${badges}`, `.trophy-glint{opacity:0;animation:trophy-glint 7s linear infinite}@keyframes trophy-glint{0%,6%,15%,100%{opacity:0}10%{opacity:.65}}
      .sparkle{animation:sparkle 3.6s ease-in-out infinite}@keyframes sparkle{0%,100%{opacity:.12}50%{opacity:.9}}
      @media(prefers-reduced-motion:reduce){.trophy-glint{display:none}.sparkle{animation:none;opacity:.5}}`);
}
