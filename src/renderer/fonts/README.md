# Numeric fonts

Outfit, Inter, and Space Grotesk (medium, 500) are bundled as static TrueType subsets containing `0123456789,.%-`. Each SVG embeds only the selected family, so the same numerals render on GitHub without an installed font or a remote font request.

`numerals.json` records each downloaded subset's source URL and license. The selected font's copyright notice and full SIL Open Font License also travel with the SVG in its metadata. The adjacent license files cover their respective fonts. Source families: [Outfit](https://github.com/google/fonts/tree/main/ofl/outfit), [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk).

Regenerate intentionally with `npx tsx scripts/update-numeral-fonts.ts`; normal builds use the checked-in subsets and require no font download.
