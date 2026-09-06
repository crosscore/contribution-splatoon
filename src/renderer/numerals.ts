import fonts from "./fonts/numerals.json";

export type NumeralFont = "outfit" | "inter" | "space" | "mono";
export const DEFAULT_NUMERAL_FONT: NumeralFont = "inter";

/** Only bundled families can be selected by an embed URL. */
export function resolveNumeralFont(value: string | null): NumeralFont {
  return value === "outfit" || value === "inter" || value === "space" || value === "mono"
    ? value : DEFAULT_NUMERAL_FONT;
}

export function numeralLicense(font: NumeralFont): string {
  return font === "mono" ? "" : fonts[font].license;
}

export function numeralCss(font: NumeralFont): string {
  if (font === "mono") {
    return ".number{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-weight:500;letter-spacing:-1px;font-variant-numeric:tabular-nums}";
  }
  const { family, data } = fonts[font];
  return `@font-face{font-family:'Gallery ${family}';font-style:normal;font-weight:500;src:url(data:font/ttf;base64,${data}) format('truetype')}
    .number,.numeric-detail{font-family:'Gallery ${family}',sans-serif;font-weight:500;font-variant-numeric:tabular-nums lining-nums}
    .number{letter-spacing:-.02em}`;
}
