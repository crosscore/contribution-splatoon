import { NumeralFont, numeralCss, numeralLicense } from "./numerals";

/** Shared visual language for self-contained GitHub profile SVGs. */
export const CARD_WIDTH = 753;
export const HALF_WIDTH = 375;
export const HALF_HEIGHT = 256;

export interface GalleryTheme {
  background: string; inset: string; border: string; text: string;
  muted: string; accent: string; accentSoft: string; warm: string; cool: string;
}

export function galleryTheme(dark: boolean): GalleryTheme {
  return dark
    ? {
        background: "#0d1117", inset: "#161f2b", border: "#293344",
        text: "#e6edf3", muted: "#9caec4", accent: "#56e0bd",
        accentSoft: "#132c2b", warm: "#fbc65b", cool: "#b6a0ff",
      }
    : {
        background: "#ffffff", inset: "#f2f6f7", border: "#dce5e8",
        text: "#253640", muted: "#5d707c", accent: "#16765f",
        accentSoft: "#edf7f3", warm: "#866526", cool: "#4d6f99",
      };
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function number(value: number): string {
  return value.toLocaleString("en-US");
}

/** Keep unusually large totals inside their column without losing precision. */
export function numberSize(value: string, preferred: number, width: number): number {
  return Math.min(preferred, width / (value.length * 0.63));
}

export function galleryCss(theme: GalleryTheme, font: NumeralFont = "mono"): string {
  return `text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
    .eyebrow{font-size:10px;font-weight:600;letter-spacing:1.7px;fill:${theme.muted}}
    .heading{font-size:18px;font-weight:600;letter-spacing:-.4px;fill:${theme.text}}
    .label{font-size:12px;fill:${theme.muted}}
    .detail{font-size:10.5px;fill:${theme.muted}}
    ${numeralCss(font)}
    .number{fill:${theme.text}}
    .motion{animation:shimmer 7s ease-in-out infinite}
    @keyframes shimmer{0%,100%{opacity:.65}50%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.motion{animation:none}}`;
}

export function cardSurface(width: number, height: number, theme: GalleryTheme): string {
  return `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="14" fill="${theme.background}" stroke="${theme.border}"/>`;
}

export function cardSvg(title: string, description: string, width: number, height: number,
  theme: GalleryTheme, body: string, css = "", font: NumeralFont = "mono"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" data-design="gallery-v2" data-numeral-font="${font}">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${escapeXml(description)}</desc>
  ${font === "mono" ? "" : `<metadata id="font-license">${escapeXml(numeralLicense(font))}</metadata>`}
  <style>${galleryCss(theme, font)}${css}</style>
  ${cardSurface(width, height, theme)}
  ${body}
</svg>\n`;
}

/** A quiet echo of the contribution graph, used as the gallery signature. */
export function pixelMark(x: number, y: number, theme: GalleryTheme): string {
  return [2, 3, 1, 4].map((height, col) =>
    Array.from({ length: height }, (_, row) =>
      `<rect x="${x + col * 7}" y="${y + (3 - row) * 7}" width="4.5" height="4.5" rx="1.2" fill="${theme.accent}" opacity="${0.4 + row * 0.18}"/>`
    ).join("")
  ).join("");
}
