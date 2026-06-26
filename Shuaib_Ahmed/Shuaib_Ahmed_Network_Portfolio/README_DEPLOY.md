# Shuaib Ahmed Network Portfolio — Netlify Deployment

## Quick deployment
1. Extract this ZIP file.
2. Open `index.html` locally to review the static site.
3. In Netlify, use **Add new site → Deploy manually**.
4. Drag the extracted `Shuaib_Ahmed_Network_Portfolio` folder into Netlify Drop.
5. Confirm that the resume, certificate PDFs, gallery, and lab-detail pages load correctly.

## Structure
- `index.html` — portfolio landing page
- `assets/css/styles.css` — site styling
- `assets/js/site.js` — horizontal gallery, filters, drag scrolling, and lightbox
- `assets/photos/` — optimized gallery photos with EXIF metadata stripped
- `assets/docs/` — resume and certificate PDFs
- `assets/labs/` — local README files and lab screenshots
- `labs/` — employer-facing lab-detail pages

## Important privacy note
The included gallery is intentionally curated. Photos with potentially client-identifying interfaces, time-clock devices, serial labels, or other low-value sensitive content were not published. Perform one manual review before making the Netlify URL public.

## Embedded TopoDrawer video

The TopoDrawer project section includes a responsive embedded walkthrough video at `assets/video/preferred.mp4` with a static poster image generated from that recording at `assets/video/preferred-poster.jpg`. The video uses native browser controls and does not autoplay.
