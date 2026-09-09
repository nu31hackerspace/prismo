# Bundled fonts

These TTF files are read at request time by `src/lib/pdf/render.ts` (embedded and
subset into the PDF) and served to the browser by `/api/fonts/[id]` so the live
preview measures text with the same file the PDF is built from.

Every family here covers Latin, Latin Extended and Cyrillic, including the
Ukrainian `ї є і ґ`, in both Regular and Bold.

| Family           | Files                                                    | Licence                                        |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Liberation Sans  | `LiberationSans-Regular.ttf`, `LiberationSans-Bold.ttf`   | SIL OFL 1.1 — `licenses/Liberation-copyright.txt` |
| Liberation Serif | `LiberationSerif-Regular.ttf`, `LiberationSerif-Bold.ttf` | SIL OFL 1.1 — `licenses/Liberation-copyright.txt` |
| DejaVu Sans      | `DejaVuSans-Regular.ttf`, `DejaVuSans-Bold.ttf`           | DejaVu / Bitstream Vera — `licenses/DejaVu-copyright.txt` |
| Lora             | `Lora-Regular.ttf`, `Lora-Bold.ttf`                       | SIL OFL 1.1 — `licenses/Lora-OFL.txt`          |
| JetBrains Mono   | `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf`     | SIL OFL 1.1 — `licenses/JetBrainsMono-OFL.txt` |
| IBM Plex Mono    | `IBMPlexMono-Regular.ttf`, `IBMPlexMono-Bold.ttf`         | SIL OFL 1.1 — `licenses/IBMPlexMono-OFL.txt`   |

## Adding a font

1. Drop `Family-Regular.ttf` and `Family-Bold.ttf` here, with its licence file in
   `licenses/`.
2. Add an entry to `FONTS` in `src/lib/fonts.ts`.
3. Add a row to the table above.

Check Cyrillic coverage before adding one — several popular Google fonts (Work
Sans, Outfit, Instrument Sans) are Latin only and would silently drop characters.
