# My Personal Site

This is the source for my personal website: a static portfolio for software work, music collaboration, professional opportunities, and creative experiments.

The project is no longer a stock HTML5 UP template. It has been reshaped into a custom static site with its own page structure, visual system, theme handling, content, and interactive pieces. Some legacy vendor files remain where they are still useful.

## What Is Included

- Multi-page static site: `index.html`, `work.html`, `about.html`, `connect.html`, `services.html`, `contact.html`, and `thanks.html`
- Project showcase pages for software, product, music-thinking tools, and creative experiments
- Custom responsive layout and dark/light theme switcher
- Contact form markup with honeypot spam protection
- Fridge Poetry Lab, a standalone custom web component powered by `assets/js/fridge-poetry.js`
- Local data files for fridge poetry words and homepage splash quotes
- Optimized image assets in `images/`

## Project Structure

```text
.
├── index.html
├── work.html
├── about.html
├── connect.html
├── services.html
├── contact.html
├── fridge-poetry.html
├── thanks.html
├── assets/
│   ├── css/
│   │   └── main.css
│   ├── data/
│   │   ├── alec-splash-quotes.json
│   │   └── fridge-poetry-words.json
│   ├── js/
│   │   ├── main.js
│   │   └── fridge-poetry.js
│   └── sass/
├── images/
└── LICENSE.txt
```

## Editing Notes

- Main site styles live in `assets/css/main.css`.
- The Sass sources remain in `assets/sass/`, but the current workflow edits the compiled CSS directly.
- Shared header, navigation, footer, theme bootstrapping, and asset query strings are repeated across the HTML pages.
- The theme preference is stored in `localStorage` under `site-theme-v2`.
- The contact form posts to `thanks.html`.
- Fridge Poetry Lab reads word data from `assets/data/fridge-poetry-words.json` and persists board state with browser storage.

## Credits And Licensing

This repository includes third-party/vendor assets such as Font Awesome, jQuery, responsive helpers, and older HTML5 UP-derived scaffolding.

My personal content, copy, custom design work, project screenshots, and images are not offered as a reusable template.
