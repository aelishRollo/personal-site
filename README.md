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

## Local Development

This is a plain static site. There is no package manager, dependency install, or build command required for the current workflow. Netlify should publish the repository root directly.

To preview locally:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000`.

## Deployment Workflow

The deployment model is GitHub pull requests plus Netlify continuous deployment.

- `main` is production. Merging into `main` should trigger the production deploy on Netlify.
- `development` is staging/development. Merging into `development` should trigger the persistent Netlify branch deploy for integrated testing.
- Feature work should branch from `development`, using names such as `feature/new-homepage`, `fix/mobile-header`, or `content/about-page`.
- Feature branches should normally open pull requests into `development`.
- Netlify Deploy Previews should be used to review pull requests when available.
- After testing `development`, promote changes by opening a pull request from `development` into `main`.
- Direct pushes to `main` and `development` should be blocked or avoided.

Typical feature workflow:

```bash
git checkout development
git pull
git checkout -b feature/my-change

# make edits

git add .
git commit -m "Describe change"
git push -u origin feature/my-change
```

Open the pull request on GitHub with `development` as the base branch.

Promotion workflow:

```bash
git checkout development
git pull
git checkout main
git pull
```

Then open a pull request on GitHub from `development` into `main`. When that pull request is reviewed, CI is passing, and the Netlify preview looks right, merge it to deploy production.

If the `development` branch does not exist yet, create it once from the current production branch before enabling branch protection:

```bash
git checkout main
git pull
git checkout -b development
git push -u origin development
```

## Build And Deploy Settings

Detected project type: plain static HTML/CSS/JS.

- Build command: leave blank / no build command.
- Publish directory: `.`.
- Production branch: `main`.
- Persistent branch deploy: `development`.
- Deploy Previews: enabled for pull requests.

These settings are also captured in `netlify.toml` with `publish = "."`. If the Netlify UI has conflicting build or publish settings, the matching setting in `netlify.toml` takes precedence.

There are no repository-level Netlify redirects, custom headers, functions, or framework adapters at the moment. The contact page uses Netlify Forms markup, so keep Forms enabled in Netlify and confirm the form is detected after the first Git-based deploy. Configure any production environment variables in the Netlify UI; do not commit secrets or `.env` files.

The `development` branch deploy and Deploy Preview URLs are public URLs. That is acceptable for this site as long as no sensitive content or secrets are committed.

## GitHub Branch Protection

Configure branch protection in GitHub after pushing this setup.

For `main`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require the `CI / Static site validation` GitHub Actions check.
- Block direct pushes.
- Do not allow force pushes.
- Optionally require branches to be up to date before merging.

For `development`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require the `CI / Static site validation` GitHub Actions check.
- Block direct pushes unless you intentionally keep development less strict.
- Do not allow force pushes.

## Netlify Setup

In Netlify, create or update the site from the GitHub repository:

- Connect the site to this GitHub repo.
- Set the production branch to `main`.
- Leave the build command blank.
- Set the publish directory to `.`.
- Enable Deploy Previews for pull requests.
- Enable branch deploys only for selected branches and include `development`.
- Do not enable branch deploys for all branches unless there is a specific need.
- Keep Netlify Drop as an emergency/manual fallback, not the normal deploy path.
- Configure custom domains, HTTPS, Forms, and environment variables in the Netlify UI.

## Credits And Licensing

This repository includes third-party/vendor assets such as Font Awesome, jQuery, responsive helpers, and older HTML5 UP-derived scaffolding.

My personal content, copy, custom design work, project screenshots, and images are not offered as a reusable template.
