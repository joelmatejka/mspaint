# Verification and fidelity

This is a functional recreation, **not verified as pixel-identical or behavior-identical to any Microsoft Paint release**. The three appearances share one engine. Passing the app's regression tests establishes the tested behavior of this implementation; it does not establish parity with original Windows binaries.

## Audit coverage

Latest completed run: **117 passed, 0 failed**. The separate headless desktop startup test also passed. Real browser pointer checks confirmed rectangle drawing, enclosed fill, selection movement, and hue/luminosity picking. These results apply to the current local implementation.

| Area | Verification |
| --- | --- |
| Classic drawing tools | Real canvas pixel checks for pencil, Shift constraint, right-button colors, eraser, selective color eraser, fill, picker, magnifier, brush nibs, airbrush, lines, shapes, curves, and polygons |
| Windows 7 brushes | Every offered brush produces pixels; texture algorithms are approximate |
| Selection | Rectangle/free-form masking, movement, resizing, transparency, complementary selection, cut/paste/delete, crop, and recovery composition |
| History | Undo/redo across pixels and dimensions; unchanged selections preserve Redo |
| Image transformations | Flip, all three right-angle rotations, scale, skew, selection-only transforms, inversion, and threshold monochrome |
| Text | Dragged text box, rasterization, font controls, text bold shortcut, and zoom positioning |
| Export | PNG/JPEG decode round trips; 24-bit BMP header, BGR pixels, padding; app Save As filenames/types |
| Save confirmation | Cancel, discard, Save → New with fallback Save As, and canceling the nested Save As |
| Dialogs | Attributes and unit conversion, resize/aspect ratio, rotation, color field synchronization, custom palette, custom zoom, and opening/closing informational dialogs |
| Appearance | Switching eras preserves pixels/history; every classic tool has pixel-grid artwork; all offered icons have artwork |
| Layout | 98/XP/7 at 360×600, 640×480, 1024×768, and 1440×900; visible workspace, reachable toolbars, horizontal ribbon scrolling, and on-screen dialog actions |
| Desktop | Headless Electron startup, local protocol, renderer initialization, and native bridge; screenshots at desktop and narrow widths |
| Offline | Asset existence and manifest/service-worker source checks; actual offline installation needs a supported browser/host |

Run the browser suite for the current pass/fail count. Its individual results are displayed, including failures. Screenshots are generated in `artifacts/` by `tests/screenshots.cjs`.

## Corrections made during this audit

- Included floating selection pixels in recovery saves and scheduled recovery after selection movement/transforms.
- Preserved Redo when an unchanged selection is placed back on the picture.
- Implemented click-and-drag text boxes and corrected Shift stroke coordinates.
- Fixed the 25% zoom setting and slider indices.
- Prevented oversized paste/selection allocations before canvas creation.
- Fixed nested Save → New cancellation caused by a stale close event on the shared dialog.
- Made curve control points draggable as well as clickable.
- Added the missing Windows 7 selection menu and brush choices.
- Replaced smooth classic toolbox icons with 16-pixel artwork and added separate ribbon icons.
- Tightened the Windows 7 ribbon and added a quick-access toolbar.
- Added scrolling for tall tool options, menus, and dialogs; bounded the floating text toolbar on narrow screens.
- Replaced the large native color swatch with an interactive hue/saturation map and luminosity bar.

## Remaining differences and verification limits

| Original behavior | This implementation |
| --- | --- |
| Windows GDI pixel/shape rasterization | HTML Canvas rasterization; some edges, ellipse pixels, and text differ. No original binary pixel-diff has been run. |
| Original Microsoft icon resources | Independently drawn icons inspired by references; not copies of the original resource files. |
| Era-specific history/zoom limits and quirks | Shared engine with bounded multi-step history, 25–1600% zoom, and recovery; intentionally more capable than some old releases. |
| Exact Windows 7 brush simulation and textured shape outline/fill effects | Nine approximate brush choices and basic outline/fill modes; Microsoft's original texture engine is not reproduced. |
| Editable Windows 7 shapes after placement | Shapes become bitmap pixels on release; use a selection to move/resize afterward. |
| Original rich text/font metrics | A single-style editable text box, then rasterized text. Fonts depend on those installed on the current device. |
| Windows Explorer and printer dialogs | Browser-provided dialogs, plus themed configuration dialogs. Electron adds native Save dialogs. Actual printer output and every OS dialog have not been visually verified. |
| All original export variants | PNG, JPEG, and 24-bit BMP. GIF/TIFF and indexed/monochrome BMP export are not implemented. Import depends on browser decoding. |
| Scanner acquisition and OS wallpaper changes | Explicit import/download alternatives. No direct scanner control or wallpaper modification. |
| Full Windows page setup and pagination | Fit-to-one-page printing, paper/orientation, uniform margin, and horizontal centering. |
| Desktop window controls inside browser chrome | Browser-specific install, full-screen, and help controls. The Electron window has real operating-system window controls. |
| Native keyboard shortcuts in every browser | Browsers reserve some combinations, including Ctrl+N/Ctrl+T/Ctrl+W; menus always provide the commands. Electron handles key commands inside its own window. |
| All undocumented stamp/trail modes and exact legacy selection quirks | Not fully reproduced or certified. |
| Signed installable desktop distribution | Electron launcher supplied; packaged/signed Windows/macOS installers are not supplied. |

## Visual references

- [Classic Paint toolbox and layout](https://www.formettic.be/tutoriel_paint/)
- [Windows 7 Paint ribbon reference](https://www.keicode.com/windows/ribbon-framework-overview.php)

These references guided the visual audit. They are not a substitute for running and comparing the original Windows releases.
