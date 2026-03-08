#!/usr/bin/env python3
"""
ASCII Art Alignment Checker

Checks that all lines within a fenced code block (```) have consistent
display width, accounting for Unicode East Asian Width (full-width chars
like ε, box-drawing chars ┌─┐, arrows ▶, etc.).

Only checks blocks that contain box-drawing characters (┌ ─ ┐ │ └ ┘ ├ ┤
┬ ┴ ┼ ▶ ▷), since those are the blocks where alignment matters.
Regular code blocks (formulas, pseudocode, etc.) are skipped.

Usage:
    python scripts/check_ascii_align.py [FILE]

    FILE defaults to docs/ALGORITHM.md

Examples:
    python scripts/check_ascii_align.py
    python scripts/check_ascii_align.py docs/ALGORITHM.md
    python scripts/check_ascii_align.py README.md
"""

import sys
import unicodedata

# Box-drawing and related characters that indicate an ASCII art block
BOX_CHARS = set("┌┐└┘│─├┤┬┴┼▶▷╔╗╚╝║═╠╣╦╩╬")


def display_width(s: str) -> int:
    """Calculate the display width of a string in a monospace terminal.

    Full-width characters (CJK, some symbols) count as 2 columns.
    All other characters count as 1 column.
    """
    width = 0
    for c in s:
        eaw = unicodedata.east_asian_width(c)
        if eaw in ("F", "W"):
            width += 2
        else:
            width += 1
    return width


def has_box_chars(lines: list[tuple[int, str, int]]) -> bool:
    """Check if any line in a block contains box-drawing characters."""
    for _, content, _ in lines:
        if any(c in BOX_CHARS for c in content):
            return True
    return False


def check_file(filepath: str) -> bool:
    """Check all ASCII art code blocks in a file for alignment issues.

    Returns True if all blocks are aligned, False otherwise.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_block = False
    block_start = 0
    block_lines: list[tuple[int, str, int]] = []  # (line_num, content, width)
    all_ok = True
    checked_count = 0
    skipped_count = 0

    for i, raw_line in enumerate(lines):
        line = raw_line.rstrip("\n")

        if line.strip().startswith("```"):
            if not in_block:
                # Entering a code block
                in_block = True
                block_start = i + 1
                block_lines = []
            else:
                # Exiting a code block — check alignment
                in_block = False

                if not block_lines or not has_box_chars(block_lines):
                    skipped_count += 1
                    continue

                checked_count += 1

                # Find the most common width (the "intended" width)
                widths = [w for _, _, w in block_lines]
                target = max(set(widths), key=widths.count)

                misaligned = [(ln, content, w) for ln, content, w in block_lines if w != target]

                if misaligned:
                    all_ok = False
                    print(f"\n⚠  Code block at line {block_start + 1} (target width: {target})")
                    for ln, content, w in block_lines:
                        flag = "  ✗" if w != target else "  ✓"
                        diff = w - target
                        diff_str = f" ({'+' if diff > 0 else ''}{diff})" if diff != 0 else ""
                        print(f"  L{ln:4d} w={w:3d}{diff_str:>5s} {flag}  {content}")
                else:
                    print(f"✓  Code block at line {block_start + 1}: all {len(block_lines)} lines aligned (w={target})")
        elif in_block:
            w = display_width(line)
            block_lines.append((i + 1, line, w))

    if checked_count == 0:
        print("No ASCII art code blocks found.")
        if skipped_count > 0:
            print(f"  ({skipped_count} non-diagram code block(s) skipped)")
        return True

    if skipped_count > 0:
        print(f"\n  ({skipped_count} non-diagram code block(s) skipped)")

    if all_ok:
        print(f"\n✅ All {checked_count} ASCII art block(s) are perfectly aligned!")
    else:
        print(f"\n❌ Some blocks have alignment issues. Fix the lines marked with ✗.")

    return all_ok


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "docs/ALGORITHM.md"

    try:
        ok = check_file(filepath)
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
