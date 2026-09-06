import { mkdirSync, writeFileSync } from "node:fs";

// Keep the fonts inside each SVG: GitHub image embeds cannot load remote fonts.
// Only numeric glyphs are needed, so each static font is a few kilobytes.
const sources = [
  { id: "outfit", family: "Outfit", directory: "outfit" },
  { id: "inter", family: "Inter", directory: "inter" },
  { id: "space", family: "Space Grotesk", directory: "spacegrotesk" },
];
const revision = "5e35378e6bda803962ee6fd257e444a7d459660d";
const destination = "src/renderer/fonts";

async function download(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}

async function main() {
  mkdirSync(destination, { recursive: true });
  const fonts: Record<string, { family: string; source: string; data: string; license: string }> = {};
  for (const { id, family, directory } of sources) {
    const cssUrl = new URL("https://fonts.googleapis.com/css2");
    cssUrl.searchParams.set("family", `${family}:wght@500`);
    cssUrl.searchParams.set("text", "0123456789,.%-");
    const css = await (await download(cssUrl.toString())).text();
    const matches = [...css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/g)];
    if (matches.length !== 1) throw new Error(`Expected one static TrueType font for ${family}`);
    const source = matches[0][1];
    const bytes = Buffer.from(await (await download(source)).arrayBuffer());
    if (bytes.readUInt32BE(0) !== 0x00010000) throw new Error(`Invalid TrueType font: ${family}`);
    const license = (await (await download(`https://raw.githubusercontent.com/google/fonts/${revision}/ofl/${directory}/OFL.txt`)).text())
      .replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
    fonts[id] = { family, source, data: bytes.toString("base64"), license };
    writeFileSync(`${destination}/${id}-OFL.txt`, license);
    console.log(`${family}: ${bytes.length} bytes`);
  }
  writeFileSync(`${destination}/numerals.json`, JSON.stringify(fonts, null, 2) + "\n");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
