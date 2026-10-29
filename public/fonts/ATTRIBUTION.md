# JET SPRINT interface fonts / v0.15.1

All current fonts are served locally. There are no external font-service requests.

- **Racing Sans One Regular** — Copyright (c) 2012 Pablo Impallari and Rodrigo Fuenzalida, reserved font name “Racing Sans”. SIL Open Font License 1.1; full notice in `RacingSansOne-OFL.txt`. Used for titles, race headings and venue sign headings. The slant is part of the original design; no synthetic italic or bold is requested.
- **Rajdhani SemiBold (600) / Bold (700)** — Copyright (c) 2014 Indian Type Foundry. SIL Open Font License 1.1; full notice in `Rajdhani-OFL.txt`. Used for HUD, menus, labels, buttons, inputs, numeric readouts, results and canvas instrumentation. This font has proportional figures; live HUD digits use fixed-width glyph cells to prevent timer/speed jitter while retaining Rajdhani.

Sources: https://github.com/google/fonts/tree/main/ofl/racingsansone and https://github.com/google/fonts/tree/main/ofl/rajdhani, retrieved October 29, 2026. Unmodified TTF outlines were losslessly compressed to WOFF2 with fontTools; no glyphs were edited or subsetted. Font loading completes before canvas signs are baked; a bounded fallback and late repaint handle unavailable or slow fonts.

The previous Barlow/IBM Plex files were removed from the active build. Original UI artwork remains project artwork.
