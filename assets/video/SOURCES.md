# Starlight background

- Source: ESO 4K (3840 × 2160, 25 fps, ~54 Mb/s) Milky Way time-lapse over the Atacama, 7.6 s clip (container date 2014-08-26).
  - TODO: confirm the exact ESO video page/ID for this clip and then point the on-page attribution link in `assets/js/main.js` at it (currently the general ESO video archive).
- Credit: ESO
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); [ESO usage terms](https://www.eso.org/public/outreach/copyright/)
- Files: `starlight-fixed-stars.mp4` (1536 × 864) and `starlight-fixed-stars.jpg` (poster).
- Adaptation:
  - Excerpt 2.2–5.4 s (80 frames), original playback speed.
  - Stars registered to the 3.8 s frame with SIFT feature matching and a projective transform (median registration error ≈ 0.8 source pixels), resampled once with Lanczos straight from the 4K frames.
  - Cropped to a 1536 × 864 window that is sky-only and fully covered in every frame (no horizon, ground or warped edges), at native source resolution — no upscaling. The earlier version upscaled an 816 × 459 crop of 720p footage, which caused the blur.
  - Large-scale background (airglow and horizon glow drifting with the ground) replaced with the clip mean so sky colour stays constant; stars and Milky Way structure are untouched.
  - Darkened to a sparse sky: a smooth, star-free sky estimate (median + blur of the temporal mean) is subtracted; only the ~520 brightest stars (local peaks above a fixed threshold on the temporal mean) are kept, each with its real per-frame light and colour. Everything else is set to a deep blue-black, with a very faint (12%) hint of the Milky Way glow. Star selection is fixed across frames, so nothing flickers in or out.
  - The final 0.8 s blend into the opening 0.8 s, creating a 2.4 s loop with no positional reset.
  - Encoded as silent 25 fps H.264 Main@4.0, CRF 18 (≈ 260 KB). JPEG poster is the loop's first frame.
- CSS applies a dark overlay and crops responsively. Attribution and license links appear below the page footer while Starlight is selected.
