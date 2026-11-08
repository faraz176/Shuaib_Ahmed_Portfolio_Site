# Shuaib Ahmed Network Portfolio

A dependency-free static site. Open `index.html` directly for a local preview, serve this folder over HTTP, or deploy it on Netlify. The site directory is `Shuaib_Ahmed/Shuaib_Ahmed_Network_Portfolio`.

## Site structure

- `index.html`: homepage, credentials, labs, TopoDrawer, and capture archive
- `assets/docs/Shuaib_Ahmed_Resume.pdf`: sole resume, updated November 1, 2026
- `assets/photos/`: existing full field photographs, with EXIF stripped
- `assets/archive/full/`: 157 sanitized networking screenshots and 8 hardware photographs in WebP format
- `assets/archive/thumbs/`: 201 compact WebP thumbnails
- `assets/archive/shine/`: 176 generated letter-shape masks for the photo-viewer light pass
- `assets/js/archive-data.js`: capture titles, categories, paths, dimensions, and dates
- `assets/js/network-space.js`: camera movement, grouping, and bubble collision physics
- `assets/js/site.js`: glass textures, space rendering, controls, list, and image viewer
- `assets/js/photo-shine.js` and `photo-shine-data.js`: one-shot light pass and its mask index
- `assets/js/particle-portrait.js` and `crt-portrait-data.js`: interactive hero point cloud and its published luminance grid
- `assets/img/crt-portrait.webp`: still portrait shown before and instead of the animation
- `assets/js/evidence-dither.js`: natural-color report sources and optional phosphor homepage thumbnails
- `tools/`: local mask and portrait generators; not needed to serve the site
- `assets/video/preferred.mp4`: TopoDrawer walkthrough (channel 1 of the TopoDrawer TV; channels 2-18 are YouTube uploads from @feather1x, listed in `assets/js/topodrawer-tv.js` and embedded via youtube-nocookie.com)
- `labs/`: technical lab and anonymized field reports

## Capture archive

The archive combines 44 field/hardware photographs and 157 networking screenshots in one three-dimensional network. Photos wrap across curved, translucent glass surfaces against a pitch-black background, with a world-space starfield, depth sorting, and parallax. The perspective renderer needs no library, external request, WebGL, or build step.

Choose **Enter network** for edge-to-edge exploration. Page scrolling locks until **Esc** or **Exit**. Entering with a mouse click captures the mouse (pointer lock): the cursor hides and stays put, mouse movement turns the view at roughly three times the original drag sensitivity, and the centered ring is the only aim marker. A click opens the bubble inside the ring. The first **Esc** frees the mouse (the network stays open, and a click on the view captures it again); the next **Esc** exits. Opening a photo frees the mouse, and closing it with a click captures it again. Keyboard entry leaves the mouse free and aims with the same ring; touch opens what it taps. Where pointer lock is unavailable, the cursor hides over the view and relative motion still turns it, with the ring aiming. The selected-capture panel and cluster-count strip are removed.

**Wheel up moves forward; wheel down moves backward.** The vertical Travel control also moves along the current viewing direction, not a fixed zoom axis. Reversing the wheel immediately reverses queued movement. The camera pushes bubbles, which collide, deform briefly, and settle toward their clusters. Impact strength varies continuously with normalized wheel distance and cadence. The gentle reference is `space.wheel.baseline = 240` CSS pixels per second, defined in `network-space.js` and tunable there. Lower values make impacts firmer for the same scrolling; higher values keep them softer. The Soft/Firm/Hard readout reports the continuous percentage rather than choosing separate physics modes.

On touch devices, swipe horizontally to look and vertically to travel after entering. Outside exploration, vertical swipes scroll the page normally. With scene focus, Left/Right turns, Up/Down or W/S travels, Shift+Up/Down tilts, PageUp/PageDown travels farther, Home resets, Enter opens the selected capture, and Space toggles ambient floating. Previous/next controls locate captures in newest-first order; month shortcuts work outside exploration.

Connect by **Activity** or **Date proximity**. The date-gradient slider starts at **one hour**, has one-hour precision, and extends through the archive's entire captured-date span. Its upper limit comes from the photo metadata, not the current date or a fixed 30-day cap. Pointer travel is logarithmic so one-, two-, and three-hour settings remain selectable while larger spans are quick to reach. Arrow keys adjust by exactly one hour; Home selects one hour and End selects the full span.

Bubbles regroup live while dragging, without waiting for release or a slow animation. Rapid inputs are coalesced to one regroup per animation frame. Consecutive timestamp gaps determine membership, not fixed calendar buckets; a cluster can span more than one interval. One, two, and three hours currently produce 83, 74, and 66 groups. Six hours still produces 59; seven days produces 14. At the full-span endpoint, all 176 precisely dated captures join one group. The three month-only photographs and 22 undated captures remain in their own groups.

Rim colors always represent capture dates, in both grouping modes: older blue through violet and pink to newer amber. The gradient never depends on scrolling or slider speed. Month-only rims show their possible date range with dashed strokes; undated rims stay gray. The oldest/newest legend stays visible.

The “Browse all” list provides the same 201 captures without spatial picking. The image viewer supports Escape, arrows, and trapped Tab navigation, then restores focus. Inside exploration, the first Escape closes the image and the next exits the network. Reduced motion disables ambient floating and automatic regrouping transitions while preserving manual navigation. Rendering pauses offscreen, in hidden tabs, and while an image is expanded. If canvas is unavailable, list browsing remains available.

Opening a photo plays one prismatic light pass. It enters at the upper-left corner and travels diagonally to the lower-right in about four seconds, lighting only detected lettering: a white leading glint, a violet-to-pink spectrum, then a fading glass sheen. It never loops. Closing, changing photos, hiding the tab, or switching to reduced motion stops it immediately, and reduced motion never starts it. Photos without detected text (25 of 201) stay unchanged. The effect is a decorative `aria-hidden` canvas that ignores pointer input; the displayed photo is always the original file.

Letter shapes come from `assets/archive/shine/<id>.png`: separate alpha masks at each photo's full resolution, about 4 MB in total, loaded only when that photo opens. Regenerate them after adding or replacing captures with `py tools/build-photo-shine.py --work-dir <folder outside the site>`. Windows OCR (`tools/detect-photo-text.ps1`) supplies word boxes only; the mask keeps pixels in each box that contrast with that box's surrounding background. Recognized text is never written. The script refuses a work directory inside the site and verifies that every source photo's hash is unchanged. OCR can miss small or stylized lettering, which then stays unlit, so review new masks.

Thumbnails load near the section. Glass textures are baked and uploaded in independent 128-pixel bands rather than one large blocking composite. Thumbnail bands remain as fallback while high-resolution bands arrive. Up to four large visible bubbles request detail at a time, with six recent detail textures cached. Detail surfaces are 1536 pixels on desktop and 1024 on smaller viewports; canvas pixel ratio is capped at 2 and 1.75 respectively. Resize handling avoids clearing an unchanged canvas. Texture preparation pauses while an image is expanded and resumes when it closes, so background loading cannot interrupt the light pass.

Screenshot dates come from filenames, not EXIF. Added hardware photographs use supported EXIF dates when present; missing dates stay unknown. Field photographs retain recovered capture dates. Three migrated photographs have only a month. Twenty-two captures have no preserved date. The interface preserves those distinctions. Captions describe visible content, not proof that a deployment or lab was completed.

To add a capture, create metadata-stripped, privacy-reviewed full and thumbnail copies, then add an entry to `window.PORTFOLIO_ARCHIVE` in `assets/js/archive-data.js`. Keep entries sorted newest first and leave unknown dates `null`. Update the displayed archive count in `index.html`.

## CRT displays and shared color

All 20 pages share the decorative WebGL signal field, dark readable HTML panels, and a continuous gradient color slider. The default is electric blue. `palette-init.js` applies the saved `sa-palette` / `sa-hue` before first paint; the slider updates `PortfolioColor`, CSS accents, the portrait, certificate phosphor, and background together. The archive's capture-date colors retain their meaning.

The navigation's **Signal** control saves `sa-wave-signal`. It stops the field, portrait, terminal distortion, glass reflection, and border pulse. The decorative background retains its original motion behavior; the particle hero and lemon study respect system reduced motion and Signal off. Hidden tabs and immersive image views pause background rendering. Higher contrast and print suppress decorative effects. The field has one backing pixel per three CSS pixels and a 60 fps cap; page text and layout are never warped.

`physical-tv.css` and `tv-shell.js` place live content behind the transparent curved aperture of `assets/img/crt-tv-housing.png`. The photographic charcoal TV/VCR housing was generated from the user's reference and is decorative. Its provenance is in `tools/crt-tv-housing-prompt.txt`. The glass opening, controls, and accessible HTML remain interactive. Report title panels have a separate curved reflective glass rim with a slow sweep and two brief edge pulses every 8.5 seconds.

The homepage TV cycles every seven seconds between the portrait, router and switch, sampled from the existing local luminance grids. CRT, ordered 1-bit, ASCII, full-screen Waveform and undithered source views share the same data. Waveform draws the face itself as breathing magenta bars with blue edges and small red eye accents. Mode and channel changes morph the same grains through a starburst, blob, diamond and wisp before they reform. Drag the glass to tilt, adjust depth/density, or enable trails, waves and subtle links. SCATTER works without microphone access. ENABLE MIC asks for audio only on that click and uses a local Web Audio analyser to scatter on loud input and reform on quiet. No audio is recorded, played back from the mic, or uploaded. Switching listeners, leaving the view, hiding the page or disabling motion releases the mic. The original selfie is not published. The still WebP remains the fallback.

The lemon study sits directly after the hero and also runs at `smell-test.html`. CUT THE LEMON deconstructs the rind through the same fluid shapes, and coordinates the first visible spray, a short synthesized sound and a 30 ms vibration request on supported devices. Optional mic input triggers the same cut. Reduced motion or Signal off gives the still and response text without audio, scatter or vibration. The default fruit ink is acid yellow; the site's custom COLOR control recolors it. `netlify.toml` allows microphone permission requests from the same origin; camera and geolocation remain disabled.

Run `python tests/sensory-studio.browser.py` with Playwright and local Chrome to check the portrait channels, modes, simulated mic, cue dispatch timing, still mode, mobile bounds and the standalone page. An optional URL checks the deployed version. Browser dispatch times are not measurements of a physical device's audio or haptic latency.

### Lab consoles and sources

Each report now presents one TV with a DOS-style `C:\LABS` directory (`dos-directory.js`). Directory files select the recorded excerpts and reconstructed setup channels described below. Original screenshots and captions remain in the report. **DIR** returns to the directory. **Print** feeds a complete selected transcript from the lower TV slot on textured thermal receipt paper with a torn edge. **Tear off** dismisses it; **Print / Save PDF** opens the browser print dialog with only the full receipt, without the TV or page decoration. Printer paper size and physical stock remain the user's printer settings. `tests/dos-directory.browser.js` checks selection, complete receipt output, and dismissal without opening the system dialog.

Lab report images retain their original colors at rest and link to the original files. Homepage thumbnail previews alone use the optional shared phosphor treatment. No original report image has been edited for the CRT theme.

There are **53 recorded console excerpts** across eight reports and **11 Build & verify guides containing 48 selectable channels**. `lab-terminal-data.js` is generated from `tools/lab-terminal-transcripts.json`; each recorded entry identifies its source hash. `lab-runbooks.js` comes from `tools/lab-runbooks.json`. Recorded REPLAY material and reconstructed SETUP instructions are explicitly separate. Omitted output and environment-specific credentials use visible placeholders. Setup instructions never execute commands, and reconstructed configurations do not claim an additional live validation or failover event.

Commands type line by line with distinct prompt, command, success, and error colors. A bounded SVG screen filter adds broad horizontal tracking bends, fine raster interference, phosphor trails, and a travelling beam. Only visible terminals enable it. **Pause** stops typing and clears distortion for reading; **Replay** restarts; **Show all** fills the complete transcript. Scroll inside the tube for longer or wider output. Signal off fills the transcript and removes movement. The full undistorted transcript remains available to assistive technology. **Original screenshot** expands the unchanged source beneath each recorded replay.

### Credentials

Five TV cards display rendered pages from the existing certificate PDFs. Opening a certificate or verification link displays its certificate in a TV viewer, with a switch between phosphor and original colors. PDF and official issuer links retain their original destinations and open directly from the viewer. The verification channel does not claim to fetch or validate an external issuer's current status. Escape or the physical power control closes the viewer and restores focus. The sideways Azure print preview is rendered upright; the source PDF is unchanged.

### Focused verification

Browser checks covered all 15 reports, 53 replay source hashes, 11 setup guides, three hero channels, custom-color persistence, certificate source links and controls, original image colors, and page bounds at 320, 390, 768, 1024, 1200, and 1440 px. No runtime errors were reported. `tests/terminal-tv.browser.js` verifies animated horizontal tracking, complete accessible transcripts, clear Pause behavior, and glass framing. `tests/evidence-dither.browser.js` now verifies unfiltered report originals. Run either file through Playwright `page.evaluate` on a report containing evidence. The existing portrait/field probes remain available for renderer-specific diagnostics; their historical performance figures are not a guarantee for every device or the combined site.

## Privacy

The new screenshot selection excludes personal/financial/chat material, course and exam pages, answers, flags, and unrelated people. Identifying VM serials, machine/user names, personal paths, SNMP community values, and hardware label codes were masked in 47 captures before export and rechecked with OCR. Browser chrome and desktop taskbars were cropped from added full-screen screenshots. The Desktop/Downloads pass reviewed 460 images and added 57 relevant captures after privacy screening and deduplication. Original Pictures files were not changed. Raw OCR, source paths, and selection manifests are not public assets. Light-pass masks are derived from the published, already-masked images, so they cannot reveal redacted content.

Existing field photographs were previously curated to avoid client-identifying interfaces and serial labels. Review every new capture before publishing. Nothing in the local workflow automatically commits, pushes, or deploys the site.

## Local physics checks

From the site directory, run `node --test tests/network-space.test.js`. The tests use the real archive and cover date precision, grouping boundaries, heading-relative camera travel, collision response, momentum, damping, and layout separation.

`tests/network-input.browser.js` and `tests/network-date.browser.js` are async browser checks, runnable in the rendered local page through Playwright `page.evaluate`. They cover centered aim under pointer lock (simulated in-page, since synthetic events carry no user activation), the Escape sequence, the no-lock fallback, mouse-only look, wheel direction and strength, live hourly grouping, the full-span endpoint, and preservation of all captures.

The older `crt-portrait.browser.js` and `crt-field.browser.js` probes target the previous WebGL hero. For the current homepage interaction use the sensory studio check above.

`tests/evidence-dither.browser.js` runs on reports with figures. It verifies natural source colors, original-file links, retained descriptions, and captions outside the TV display.

`node --test tests/photo-shine.test.js` covers the single light pass, cancellation, stale mask loads, resizing, and reduced motion. `py tests/photo-shine-mask.test.py` checks that masks follow letter strokes without lighting backgrounds or shapes that have no detected text.

`tests/crt-field.browser.js` adds 19 focused browser checks for the full-page signal: visible wave movement, stable text/card positions, palette and thumbnail updates, both Signal controls, remembered motion, hidden-tab and immersive-overlay pausing, and decorative hit testing. Cross-page checks cover all 19 pages, 320/390/768 px layouts, navigation/reload persistence, high contrast, print, and the no-WebGL fallback.
