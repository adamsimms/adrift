# Contributing

Thanks for your interest in **Adrift** — a Newfoundland saltbox house adrift on the open Atlantic, animated with real-time weather from MSC GeoMet.

This is a personal art project, but small, focused improvements are welcome.

## Good first contributions

- Documentation fixes and clarifications
- Accessibility (keyboard nav, contrast, semantic HTML)
- Weather proxy hardening and error handling
- Performance (asset loading, render loop tuning)
- Bug fixes with clear reproduction steps

## Before you start

1. **Search existing issues** — someone may already be working on it.
2. **Open an issue** for non-trivial changes so we can agree on approach before you invest time.
3. **Keep scope small** — one logical change per pull request.

## Development setup

See the [README local dev section](README.md#local-development).

```bash
git clone https://github.com/adamsimms/adrift.git
cd adrift
php -S localhost:8080
```

Open [http://localhost:8080](http://localhost:8080). The scene loads without secrets; weather needs PHP with the `curl` extension for `weather.php`.

## Code conventions

Match the existing style in the files you touch:

- **PHP:** 8.1+, `declare(strict_types=1);` in new files, tabs for indentation. Weather helpers live in `lib/`. Functions use the `pinchard_*` prefix (shared lineage with [pinchards.is](https://github.com/adamsimms/pinchards.is)).
- **JavaScript:** The readable viewer source is `js/h106.js`; the minified production bundle is `jsm/h106.js`. Edit the source, then regenerate or hand-update the bundle before shipping. `jsm/three.js` is Three.js r106.
- **Scene assets:** Scene definition and textures live under `_yh1/`. Paths in `index.html` are relative to the repo root.
- **Secrets:** This project needs no API keys or credentials. Never commit deploy keys or server passwords.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes with a clear commit message (what and why).
3. Test locally — load the scene, check `weather.php` and `weather-console.html` if you touched weather code.
4. Open a PR against `main` with:
   - A short summary of the change
   - How you tested it
   - Screenshots or screen recordings for visible UI changes

Merging to `main` triggers an automatic deploy. You do not need server access.

## What we are not looking for

- Large refactors or framework migrations without prior discussion
- Changes that require production secrets to test
- Dependency churn (no npm/composer toolchain — this is a static site with a small PHP proxy)

## Questions

Open a GitHub issue or email **adam@adamsimms.xyz**.
