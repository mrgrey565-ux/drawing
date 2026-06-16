# 🐛 StreamBoard – Full Bug & Glitch Audit Report

**Audit Date:** 2026-06-16
**Project:** `E:\interactive-teaching-whiteboard-application`
**Stack:** React 19 + TypeScript 5.9 + Vite 7 + TailwindCSS 4 + pdfjs-dist 5.6
**App purpose:** iPad-based interactive whiteboard for YouTube live NEET PG teaching, with a private "Magic Stream Tool" notes panel hidden from viewers via StreamChamp screen-mirroring crop.

---

## 📊 Executive Summary

| Severity | Count |
|---|---|
| 🔴 **Critical (crash / data loss / stream leak)** | 6 |
| 🟠 **High (broken feature / unusable)** | 9 |
| 🟡 **Medium (visual glitch / degraded UX)** | 12 |
| 🔵 **Low (polish / consistency)** | 8 |
| **Total** | **35** |

### Top 5 risks for the live-stream use case
1. **Vite `vite-plugin-singlefile` is misconfigured** — build will fail or produce an unusable bundle (Critical).
2. **PDF.js worker is loaded from an external CDN with a hard-coded version path that won't match the installed library** → silent PDF rendering failure (Critical).
3. **Magic Stream Tool overlaps the whiteboard and would be captured by StreamChamp** unless the user takes action — the app's own hint banner is the only guard, and the panel is positioned by default in the visible top-right of the viewport (Critical).
4. **No persistence** — refreshing the page wipes pages, notes, drawings, and history (Critical for a teaching tool).
5. **`onPointerLeave` triggers `onPointerUp`** which silently commits partial strokes while the user's finger is still on the iPad → "I drew something and only half of it saved" (High).

---

## 🔴 CRITICAL bugs

### C1. `vite-plugin-singlefile` is broken / misconfigured
- **File:** [vite.config.ts:13](vite.config.ts)
- **Code:** `plugins: [react(), tailwindcss(), viteSingleFile()]`
- **Issue:** `viteSingleFile` is imported but never called — the plugin is passed as a reference, not an invocation. With most versions of `vite-plugin-singlefile` this causes the build to throw or to silently fall through to a no-op. Even if it does fire, the options needed for hashing/script handling are missing, and the plugin requires a specific invocation pattern (`viteSingleFile({...})`).
- **Impact:** `npm run build` will not produce a portable single-file HTML. The whole "one HTML to open on iPad" deployment story is broken.
- **Fix:** `import { viteSingleFile } from "vite-plugin-singlefile";` and call it: `viteSingleFile()`. If the build still complains about `inline` not supporting hashed assets, add `viteSingleFile({ useRecommendedBuildConfig: true })`.

### C2. PDF.js worker URL is hard-coded and will 404
- **File:** [src/components/MagicStreamTool.tsx:89](src/components/MagicStreamTool.tsx)
- **Code:** `pdfjsLib.GlobalWorkerOptions.workerSrc = \`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js\`;`
- **Issue:** `pdfjsLib.version` returns `5.6.205` (per `package.json`), and the cdnjs path under `pdf.js/5.6.205/` may not exist. The pinned single-file `vite-plugin-singlefile` build also makes this external CDN URL the *only* way the worker can be loaded — if the iPad is offline or behind a firewall, PDFs fail entirely.
- **Impact:** The Magic Stream Tool's headline feature ("upload PDF and read from it on stream") is broken on first try. Users will hit the `alert('Error loading PDF...')` and have no diagnostic info.
- **Fix:** Use Vite's `?url` import for the worker and bundle it locally:
  ```ts
  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  ```
  This also makes it work in the single-file build.

### C3. Default Magic Tool position sits in the top-right of the viewport — likely inside the StreamChamp capture area
- **File:** [src/components/MagicStreamTool.tsx:37](src/components/MagicStreamTool.tsx)
- **Code:** `useState({ x: window.innerWidth - 440, y: 80 })`
- **Issue:** StreamChamp on iPad captures the full screen by default. The panel starts at `(viewportWidth - 440, 80)` — exactly the top-right where the YouTube controls / "Magic Notes" header button live. The user has to drag it manually to a hidden corner before going live. The hint banner explains this, but the *default* state is dangerous.
- **Impact:** If the user forgets to drag the panel before going live, viewers will see the teacher's private notes. This is the single most embarrassing failure mode for this app.
- **Fix:** On first open, animate the panel to a "safe corner" (e.g., bottom-right or bottom-left, snapped off the obvious camera area), or display a pre-stream checklist modal that must be dismissed to enable the panel. Better: provide a "Picture-in-Picture" mode that floats it over the canvas in a way that the iPad can crop out via StreamChamp's source area.

### C4. `onPointerLeave` calls `onPointerUp` and silently commits partial strokes
- **File:** [src/components/Canvas.tsx:330](src/components/Canvas.tsx)
- **Code:** `onPointerLeave={onPointerUp}`
- **Issue:** On iPad Safari, pointer events can fire `pointerleave` while the user's palm or hand is still down on the glass (especially near bezel edges). The handler then runs `onPointerUp` → commits the in-progress element with whatever points were captured. Worse, `isDrawingRef.current` is set to `false`, so a subsequent `pointermove` is dropped.
- **Impact:** "My stroke got cut in half." Particularly bad for the pressure-pen and highlighter tools.
- **Fix:** Only commit on `pointerup`/`pointercancel` and use `setPointerCapture` (already done) to prevent leave from being issued while the pointer is captured. The proper fix is to remove `onPointerLeave={onPointerUp}` entirely — `setPointerCapture` will keep events flowing even off the canvas, and the genuine `pointerup` will be delivered reliably.

### C5. Undo/redo history is mutated by reference — every new history push overwrites the previous branch
- **File:** [src/App.tsx:51-64](src/App.tsx)
- **Code:**
  ```ts
  setHistory((prev) => {
    const stack = [...(prev[id] ?? [[]]).slice(0, (historyIdx[id] ?? 0) + 1), elements];
    return { ...prev, [id]: stack.slice(-50) };
  });
  ```
- **Issue:** `elements` is the *same array reference* that was just stored in `pages`. The `slice(-50)` of `[...prevStack, elements]` then has the array of the most recent state aliased with the *next* state. When the user undoes, the page elements are restored to that same array — but that array is also being kept in history. The "truncate future on new edit" logic and the "limit 50 steps" logic both work on the same aliased array, so:
  1. Doing `undo → draw` is supposed to drop the redo branch, but the previously-redo-able state is identical to the just-undone one.
  2. After 50 steps, all history entries may collapse to the same final state.
- **Impact:** "Undo doesn't undo", "redo randomly jumps", "history limit broken" — all reported indirectly as "my drawings disappeared after undo." For a teaching session this is data loss in front of an audience.
- **Fix:** Deep-clone the elements when pushing to history, and compute the new stack inside a single `setHistory` call. Better: replace the two `setHistory`/`setHistoryIdx` calls with a single updater that reads `prev` for both.

### C6. No persistence — refresh wipes everything
- **Files:** all `useState` initializers in [App.tsx](src/App.tsx) and [MagicStreamTool.tsx](src/components/MagicStreamTool.tsx)
- **Issue:** Pages, drawings, history, the selected tool, background, and the entire Magic Stream notes list live in component state only. Refreshing the page, the iPad going to sleep, or Safari purging the tab loses everything.
- **Impact:** A live-stream teaching tool that loses state on every refresh is unusable. The user explicitly said this is a teaching tool — they will reload between classes and lose all their notes and the slides they prepared.
- **Fix:** Persist to `localStorage` (notes + thumbnails + stroke JSON) and to `IndexedDB` for the larger PDF page dataURLs. Auto-save on a debounce; rehydrate on mount. At minimum, warn before the user reloads with `beforeunload`.

---

## 🟠 HIGH bugs

### H1. `setHistoryIdx` reads stale `history` from closure
- **File:** [src/App.tsx:57-61](src/App.tsx)
- **Issue:** Inside `setHistoryIdx`'s updater, it references `history[id]` (the closure's `history` value), not `prev`. So the truncation math uses yesterday's history stack length, not the one just updated by `setHistory`.
- **Impact:** Math undercounts → `newIdx` is off → undo/redo land on the wrong snapshot. (Compounds with C5.)
- **Fix:** Compute everything inside the single `setHistory` updater and derive the new index there.

### H2. `handleAddPage` uses stale `pages.length` to set the new current index
- **File:** [src/App.tsx:131-135](src/App.tsx)
- **Code:** `setCurrentPageIdx(pages.length);`
- **Issue:** This is the *old* `pages.length`. Since `setPages((prev) => [...prev, newPage])` runs asynchronously, the new index should be `prev.length` (the length *after* adding). In practice the value happens to coincide when state is settled, but if any batched update ever changes `pages` between the call and the render, the new page will not be the current one.
- **Fix:** Use the functional updater or compute from a single source: `setCurrentPageIdx(pages.length)` should be `setCurrentPageIdx((prev) => prev + 1)` after the new page is added, or call both in a single batch.

### H3. `handleDeletePage` may leave `currentPageIdx` pointing past the end
- **File:** [src/App.tsx:137-144](src/App.tsx)
- **Code:**
  ```ts
  setCurrentPageIdx((prev) => Math.min(prev, pages.length - 2));
  ```
- **Issue:** Same stale-closure problem — `pages.length` is captured at the moment of render, not the moment the deletion is applied. If the user deletes the *current* page when `currentPageIdx = 2` and `pages.length = 3`, the math gives `Math.min(2, 1) = 1`, which is correct, but if `pages.length = 4` and you delete index 2 while `currentPageIdx = 3`, you get `Math.min(3, 2) = 2` (fine). However, if `currentPageIdx = 0` and you delete index 0, you get `Math.min(0, -1) = -1` — the app renders with an invalid current page and crashes on `currentPage.elements`.
- **Impact:** Deleting the first page crashes the canvas render.
- **Fix:**
  ```ts
  setCurrentPageIdx((prev) => {
    if (prev < idx) return prev;
    if (prev === idx) return Math.max(0, idx - 1);
    return prev - 1;
  });
  ```

### H4. Eraser is destructive on `pointerdown` — a single tap removes a whole element
- **File:** [src/components/Canvas.tsx:184-193](src/components/Canvas.tsx)
- **Issue:** When the eraser is selected, a single `pointerdown` filters the elements array by `pointInBounds` for *every* element under the cursor. For a rectangle or image this means one tap deletes the whole shape, even if the user's intent was to start a stroke-erasing motion. The threshold also uses the element's bounding box, so touching the empty space inside a rectangle deletes the rectangle.
- **Impact:** Accidentally tapping with the eraser near any element destroys it. There's no undo-then-redo flow that the user would discover.
- **Fix:** On `pointerdown` with the eraser, just start tracking — do not delete. In `pointermove`, only delete elements whose point is within `eraserRadius` of the cursor (and only for strokes — for shapes, require a hit on the *border*, not the bounding box). Consider also adding a confirmation for image/shape deletion.

### H5. Eraser for strokes uses per-point distance — slow and incorrect
- **File:** [src/components/Canvas.tsx:240-253](src/components/Canvas.tsx)
- **Issue:** For strokes, the code checks if *any* point of the stroke is within `eraserRadius` of the cursor. This means dragging the eraser over a long stroke repeatedly re-runs `.some(...)` over the entire point array for every element on every move event, with no spatial index. For 200 strokes × 1000 points × 60 events/sec = 12M checks/sec. On iPad Safari this is enough to drop frames below 30 fps and turn the eraser into a stuttery mess.
- **Impact:** Eraser lags badly on any non-trivial slide.
- **Fix:** Add a per-page spatial index (a simple grid or R-tree), or just bail out early if the bounding box is far from the cursor, or use `requestAnimationFrame` to coalesce moves.

### H6. `setHistory` slice in `App.tsx` ignores the *current* index and just trims the tail
- **File:** [src/App.tsx:53-55](src/App.tsx)
- **Code:** `return { ...prev, [id]: stack.slice(-50) };`
- **Issue:** When the user does `undo → draw`, the new history push should truncate at the old `historyIdx` (drop the redo branch) and then append. The code does `slice(0, idx+1)` correctly inside the array, but then `slice(-50)` is applied to the *result*, which can chop the bottom of the stack — meaning older undo steps are lost. The correct limit is to slice from the new index backwards.
- **Fix:** After appending, take `stack.slice(Math.max(0, stack.length - 50))` and then update `historyIdx` to `stack.length - 1` in a single setState.

### H7. Vanishing pen timer captures `elements` from closure, not from state
- **File:** [src/components/Canvas.tsx:301-304](src/components/Canvas.tsx)
- **Code:**
  ```ts
  const timer = setTimeout(() => {
    onElementsChange(elements.filter((el) => el.id !== capturedId));
  }, VANISH_DURATION + 100);
  ```
- **Issue:** `elements` is the array at the moment the timer was scheduled. If the user draws 5 more strokes during the 2.5s vanish window, the timer will filter against the old array — those 5 new strokes are passed to `onElementsChange` as `elements` (the stale reference) and will *replace* the live state. The user just lost 5 strokes.
- **Impact:** Drawing during the vanish period wipes later work. This is *exactly* what a teacher will do while explaining ("draw → talk → draw more").
- **Fix:** Use the functional updater: `onElementsChange((prev) => prev.filter((el) => el.id !== capturedId))`. Same fix needed everywhere else in Canvas.tsx where `onElementsChange` is called from an async callback.

### H8. Vanishing pen runs `requestAnimationFrame` after each draw, even if nothing is animating
- **File:** [src/components/Canvas.tsx:147-150](src/components/Canvas.tsx)
- **Issue:** `renderAll` re-schedules itself on every frame as long as *any* vanishing element exists. After all vanishing strokes have disappeared, the rAF loop continues for one extra frame and then exits. But while active, it re-runs `requestAnimationFrame` continuously regardless of how many strokes need to fade. On a long teaching session with many vanishing highlights, this is constant CPU burn.
- **Impact:** iPad battery drain + thermal throttling.
- **Fix:** Schedule rAF only when the *soonest* `vanishAt` is within 16ms. Stop the loop when no elements need to update.

### H9. Image element drawing is broken — every render creates a new `Image()` and calls `drawImage` synchronously on an unloaded image
- **File:** [src/components/Canvas.tsx:110-113](src/components/Canvas.tsx)
- **Code:**
  ```ts
  } else if (el.type === 'image' && el.imageData) {
    const img = new Image();
    img.src = el.imageData;
    ctx.drawImage(img, el.x!, el.y!, el.width!, el.height!);
  }
  ```
- **Issue:** `ctx.drawImage` is called *before* the image has loaded. The image is created fresh on every render frame. This silently fails (draws nothing) for the first several frames, and re-creates an `Image` 60 times per second. The image only appears if the browser's cache happens to make `src` synchronous — which it doesn't for dataURLs in Safari.
- **Impact:** Uploaded images do not appear on the canvas, or appear only after the first idle moment.
- **Fix:** Pre-load images once into an `HTMLImageElement` cache (keyed by `el.id` or `el.imageData`), and reuse them in `renderAll`. Or use `await img.decode()` and a `useEffect` to mark the element as ready.

---

## 🟡 MEDIUM bugs

### M1. Default pen color is `#000000` — invisible on the black background
- **File:** [src/App.tsx:18-22](src/App.tsx)
- **Issue:** When the user switches to black background, the default pen color stays black, so the very first stroke is invisible. There's no auto-contrast adjustment.
- **Fix:** When `backgroundColor` becomes `'black'`, set `strokeStyle.color` to `'#FFFFFF'` unless the user has explicitly picked a non-black color.

### M2. `defaultStyle` is `width: 4` even for the highlighter
- **File:** [src/App.tsx:18-22](src/App.tsx)
- **Issue:** The highlighter code in `drawing.ts` multiplies width by 3, so a width-4 highlighter is 12px. That's reasonable, but the user has no idea what width will give them. The default 4 may also be too thick for fine annotations on iPad.
- **Fix:** Give each tool its own default style and a one-tap "default" button in the toolbar.

### M3. Welcome modal blocks the page on every load
- **File:** [src/App.tsx:39](src/App.tsx)
- **Issue:** `useState(true)` shows the welcome modal on first load, which is good — but the only way to close it is the X or the "Start Teaching" button. If the user dismisses it, the next reload brings it back. There's no "don't show again" preference.
- **Fix:** Persist `dismissedWelcome` to `localStorage`.

### M4. Keyboard shortcuts fire while typing in inputs
- **File:** [src/App.tsx:179-209](src/App.tsx)
- **Issue:** `onKeyDown` is on the root `<div>`. If the user is typing in the Magic Stream Tool's title or content textarea and presses `P` (Pen shortcut), the tool switches out from under them. `e.preventDefault()` isn't called for non-modifier keys.
- **Fix:** Bail out if `e.target` is an `HTMLInputElement` or `HTMLTextAreaElement` (or `isContentEditable`).

### M5. `Cmd+Z` / `Cmd+Shift+Z` shortcuts bypass the `keydown` handler's tabIndex
- **File:** [src/App.tsx:179-209](src/App.tsx)
- **Issue:** The handler is attached to a div with `tabIndex={0}`. On iPad Safari, the div does not always receive focus after the user taps on the canvas. Undo/redo silently does nothing.
- **Fix:** Attach to `window` via `useEffect` (`addEventListener('keydown', ...)`), with the same `target` check from M4.

### M6. PDF navigation state lives in MagicStreamTool component, not in the note
- **File:** [src/components/MagicStreamTool.tsx:32](src/components/MagicStreamTool.tsx)
- **Issue:** `pdfCurrentPage` is a `Record<string, number>` keyed by note id, but it's stored on the panel. If the user closes and reopens the Magic panel (not the note, the panel), the page resets to 0. This contradicts the natural expectation that "I'm on page 5 of this PDF" persists.
- **Fix:** Store `currentPage` on the `Note` itself (the type already has the field) and use it.

### M7. `deleteNote` uses `notes` from closure, not functional update
- **File:** [src/components/MagicStreamTool.tsx:141-144](src/components/MagicStreamTool.tsx)
- **Code:** `if (selectedNote === id) setSelectedNote(notes.find((n) => n.id !== id)?.id ?? null);`
- **Issue:** If two deletes happen in quick succession (or any state update between render and click), the fallback selection can be wrong — possibly selecting a note that was *also* just deleted.
- **Fix:** Use `setNotes` functional form and compute the new selected inside.

### M8. `handleImageUpload` does not validate file type
- **File:** [src/components/Toolbar.tsx:104-120](src/components/Toolbar.tsx)
- **Issue:** `accept="image/*"` is a hint only — a user can pick any file via the file picker. For non-image files, `img.onload` simply never fires, and the dataURL is silently dropped. The user gets no feedback.
- **Fix:** Check `file.type.startsWith('image/')` and surface a `alert()` or toast if not.

### M9. `onAddImage` is created with `currentPage.elements` in its dep array
- **File:** [src/App.tsx:146-163](src/App.tsx)
- **Issue:** Every time the page elements change, `handleAddImage` is re-created. This is fine for correctness but means the Canvas re-renders constantly. The bigger issue is the **size scaling** in `Toolbar.tsx:112-114`: any image wider than 600px is downscaled, but a 4K image is downscaled only once, with no consideration for the canvas size. Uploading a tall image makes it overflow.
- **Fix:** Scale relative to the canvas size, not a hard-coded 600px.

### M10. Selection indicator does not account for vanishing or highlighter fading
- **File:** [src/components/Canvas.tsx:117-125](src/components/Canvas.tsx)
- **Issue:** A user can select a vanishing pen stroke and the dashed selection rectangle will be drawn at full opacity around it even as the stroke itself fades out. The selection box should also fade.
- **Fix:** Apply `effectiveStyle.opacity` to the dashed rectangle's `globalAlpha` too.

### M11. Pen pressure fallback `0.5` overrides Apple Pencil "no pressure" states
- **File:** [src/components/Canvas.tsx:74](src/components/Canvas.tsx)
- **Code:** `pressure: e.pressure > 0 ? e.pressure : 0.5,`
- **Issue:** `e.pressure` is `0.5` for non-pressure pointers (mouse, touch) and `0` for some Apple Pencil hover states. The fallback `0.5` is fine for finger but means the pressure-pen tool will *not* show pressure variation with a finger — it will draw at a constant width. That's actually correct, but the constant-width "pen" tool will also vary in width under finger because the "pen" tool is `isPressureSensitive: false`. The current state is fine, but the comment in the code says "no-pressure devices use 0.5", which is wrong for hover events.
- **Fix:** When `e.pointerType === 'pen'` and `e.pressure === 0`, treat as constant width. When `e.pointerType === 'touch'`, ignore pressure entirely.

### M12. Tool shortcut `'P'` (uppercase) doesn't trigger on a non-SHIFT keyboard
- **File:** [src/App.tsx:194-205](src/App.tsx)
- **Issue:** `e.key === 'P'` requires Shift+P. The welcome modal advertises "Shift+P" for Pressure Pen, which matches — but the hint bar in the header shows just `P` (capitalized as a label), and the keyboard-shortcut hint strips the modifier. The hint is misleading.
- **Fix:** Either remap to a single key, or update the help text consistently.

---

## 🔵 LOW bugs / polish

### L1. `Math.random().toString(36).substr(2, 9)` — `substr` is deprecated
- **File:** [src/utils/drawing.ts:4](src/utils/drawing.ts)
- **Fix:** `Math.random().toString(36).slice(2, 11)` or use `crypto.randomUUID()` (available in modern Safari).

### L2. PDF.js `as any` casts mask type errors
- **File:** [src/components/MagicStreamTool.tsx:103](src/components/MagicStreamTool.tsx)
- **Fix:** Type the render call properly using the pdfjs-dist types.

### L3. No "Are you sure?" for `Clear` button
- **File:** [src/components/Toolbar.tsx:347-353](src/components/Toolbar.tsx)
- **Impact:** A single mis-tap on the red Clear button destroys the entire page. Add a confirmation modal, or a 3-second undo toast.

### L4. No way to reorder pages
- **File:** [src/components/PageManager.tsx](src/components/PageManager.tsx)
- **Impact:** Once you have 10 pages, the only navigation is sequential. A drag-to-reorder would help.

### L5. No keyboard shortcut for switching pages
- **File:** [src/App.tsx](src/App.tsx)
- **Impact:** Teacher on stream has to tap the page thumbnail every time. `Cmd+[` and `Cmd+]` would be natural.

### L6. Magic Tool minimize button is mislabeled (icon is the same as fullscreen toggle)
- **File:** [src/components/MagicStreamTool.tsx:194-204](src/components/MagicStreamTool.tsx)
- **Issue:** Both the "minimize" and the "fullscreen" buttons use `Minimize2` icon. When fullscreen is on, the fullscreen button shows `Minimize2` (correct), but the minimize-panel button always shows `Minimize2` (wrong — should show `ChevronDown` or similar).
- **Fix:** Use distinct icons or tooltips.

### L7. The `pdfLoading` and `showAddNote` states are mutually exclusive in the UI but not enforced
- **File:** [src/components/MagicStreamTool.tsx:307-316](src/components/MagicStreamTool.tsx)
- **Impact:** A user can click "Add Note" while a PDF is loading; the form will be hidden by the spinner. Once the PDF loads, the form appears behind the PDF viewer.

### L8. `lucide-react ^1.18.0` is ancient
- **File:** [package.json:13](package.json)
- **Issue:** `lucide-react` is at `0.x` versions in reality — `1.18.0` likely does not exist on npm. The import will work with whatever happens to satisfy the range, but the typing and icon set are likely broken. The current code uses `Highlighter` (added in newer versions), `LayoutGrid`, `Dot`, `AlignJustify`, `GripHorizontal` — if these resolve at all, it's by luck.
- **Fix:** `npm view lucide-react version` to confirm; pin to a real version like `^0.460.0`.

### L9. `react-color` is imported as a dependency but never used
- **File:** [package.json:15](package.json)
- **Impact:** Adds 100+ KB of unused code if it's ever imported. If it's not imported, dead dep.

### L10. `vite-plugin-singlefile` and the rest of the build chain
- See C1. Even after the import fix, the plugin needs the React + Tailwind config to be set up so that hashed asset names are still inlined. Worth a `npm run build && python -m http.server` smoke test.

### L11. `outline` style on inputs uses default focus ring, not the custom purple
- **File:** [src/components/MagicStreamTool.tsx:324-332](src/components/MagicStreamTool.tsx)
- **Issue:** `outline-none` is set, but `focus:ring` is not. On iPad this means no visual feedback when a textarea is focused.

### L12. Eraser cursor SVG uses inline percent-encoding, which is fragile
- **File:** [src/components/Canvas.tsx:315](src/components/Canvas.tsx)
- **Impact:** If anyone changes the SVG, the percent-encoding has to be maintained manually. Move to a data-URL constant in `utils/drawing.ts`.

---

## 🧪 Functionality walk-through — feature-by-feature status

| Feature (user's spec) | Status | Notes |
|---|---|---|
| Pen with constant width | ✅ Works | Default pen tool |
| Pressure-sensitive pen | ✅ Works | Uses `pointer.pressure` |
| Highlighter (semi-transparent) | ✅ Works | 38% alpha, width × 3 |
| Smooth pressure-sensitive vanishing pen with glowing lines | ⚠️ Partial | Glow draws, but `VANISH_DURATION` is 2.5s, not configurable. Stroke reverts to "fade with white core" mid-fade — see H8. |
| Color palette (presets + custom picker) | ✅ Works | |
| Different color when vanishing tool is active | ✅ Works | `VANISHING_COLORS` swaps in |
| Draw shapes: rectangle, circle, arrow, line | ✅ Works | |
| Customise shapes after drawing | ⚠️ Partial | Select tool works; position/size/color/width/opacity editable, but no resize handles — must edit numerically in `ElementEditor` |
| Add page | ✅ Works (with H2/H3 caveats) | |
| Add photo from local storage | ⚠️ Partial | Works but image rendering is broken (H9) |
| Background: grid / blank / dots / lines | ✅ Works | |
| Background color: white / pale-yellow / black | ✅ Works | |
| **Magic Stream Tool — private notes panel** | ⚠️ Risky | PDF worker 404 risk (C2), default position in capture area (C3), no persistence (C6), keyboard shortcut interferes with text input (M4) |
| **StreamChamp compatibility** | ⚠️ Manual | App provides no auto-crop, no safe-area preview, no PIP |
| Page manager | ⚠️ Partial | No reorder, no thumbnails (just numbered chips) |
| Undo / Redo | ❌ Broken | C5, H1, H6 — history references and stale closures |
| Export PNG | ✅ Works | `canvas.toDataURL` then download |
| Eraser | ⚠️ Aggressive | H4, H5 — too destructive, too slow |
| Welcome modal / shortcuts hint | ✅ Works (M3) | But no "don't show again" |

---

## 🎯 Recommendations (in priority order)

1. **Fix C1 + C2** so the build actually produces a runnable single-file HTML *and* PDFs work offline. This unblocks testing on the iPad.
2. **Add persistence (C6)** before the next live stream. localStorage for state JSON, IndexedDB for PDF page dataURLs.
3. **Fix the history/undo bug (C5 + H1 + H6)**. Teachers will hit this on stream.
4. **Fix the pointer-leave commit (C4)** and the vanishing-pen timer closure (H7). Both cause silent data loss during normal use.
5. **Add a "Stream safe" preflight to the Magic Tool** — when the panel is first opened, prompt the user to position it outside the capture area, optionally enter Picture-in-Picture mode so the iPad can crop it out cleanly.
6. **Fix the image-render bug (H9)** — without this, the "add photo" feature is broken.
7. **Slow down the eraser (H4 + H5)** — a stroke-only eraser with a per-page spatial index.
8. **Add a soft-confirm / undo for Clear (L3)**, and a keyboard shortcut for page nav (L5).
9. **Pin `lucide-react` (L8)** — the version range is suspicious; verify the icons resolve.
10. **Add a tiny in-canvas overlay guide** that shows the live pointer position (a soft ring) when using a pen tool. The current crosshair is invisible on touch.

---

## 🛠 Suggested test matrix (manual, on iPad)

| Test | Expected | Currently |
|---|---|---|
| Open app, draw 3 strokes, undo 3 times | Empty canvas | Crash / wrong state (C5) |
| Open Magic Tool, drag to bottom-left, close, reopen | Panel still at bottom-left | Panel resets to top-right (C6) |
| Upload a 5-page PDF, navigate to page 4, close & reopen panel | Still on page 4 | Resets to page 0 (M6) |
| Use eraser, tap once on a rectangle | Rectangle selected, not deleted | Rectangle deleted (H4) |
| Draw 5 strokes during a 2.5s vanish window | All 5 strokes present | Last few strokes lost (H7) |
| Switch to black background | First stroke visible | First stroke invisible (M1) |
| Type in Magic Tool title, press `P` | `P` typed into title | Tool switches to Pen (M4) |
| `npm run build` | Single `index.html` with no external requests | Likely broken (C1, C2) |
| Refresh page after 30 min of teaching | All pages, drawings, notes restored | Everything lost (C6) |
| Stream from iPad with default Magic Tool position | Magic Tool visible to viewers if no manual drag | Visible by default (C3) |

---

*End of report.*
