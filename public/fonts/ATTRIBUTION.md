# MARINE-87 interface fonts / v0.16.0

All fonts are bundled locally; the game makes no third-party font requests.

- **Russo One Regular (400)** — Copyright 2011–2012 Jovanny Lemonad. Used for titles, timer/lap instruments, prominent numbers and canvas sign headings. SIL Open Font License 1.1; see `RussoOne-OFL.txt` for the complete original notice.
- **Chakra Petch Medium (500) / SemiBold (600)** — Copyright 2018 The Chakra Petch Project Authors. Used for functional UI, menus, buttons, labels, tuning and canvas instrumentation. SIL Open Font License 1.1; see `ChakraPetch-OFL.txt` for the complete original notice.

Sources: https://github.com/google/fonts/tree/main/ofl/russoone and https://github.com/google/fonts/tree/main/ofl/chakrapetch, retrieved October 29, 2026. Unmodified TTF outlines were losslessly compressed to WOFF2 using fontTools. No glyphs were modified or subsetted. Prior Racing Sans One/Rajdhani assets are removed from the active build. CSS fallback fonts support unavailable/slow downloads; canvas text repaints after a late font load.

Development mode exposes `__JET_SPRINT_FONTS__.inspect()` with loaded FontFace statuses and computed font families/weights for actual live components. Production files are covered by `build-info.json` and the deployment's live-file SHA-256 check.
