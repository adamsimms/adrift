# Adrift

[![Deploy](https://github.com/adamsimms/adrift/actions/workflows/deploy.yml/badge.svg)](https://github.com/adamsimms/adrift/actions/workflows/deploy.yml)

A Newfoundland saltbox house adrift on the open Atlantic — a real-time Three.js scene animated by live weather from [MSC GeoMet](https://api.weather.gc.ca/).

Live at [pinchards.is/adrift/](https://www.pinchards.is/adrift/).

Related projects: [pinchards.is](https://github.com/adamsimms/pinchards.is) (parent site), [Dory](https://github.com/adamsimms/dory), [Waves](https://github.com/adamsimms/waves).

## Contents

- [Project layout](#project-layout)
- [Weather](#weather)
- [Local development](#local-development)
- [Deploy](#deploy)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Project layout

| Area | Purpose |
|------|---------|
| **`index.html`** | Production scene entry point — loads the viewer with no dev UI. |
| **`dev.html`** | Dev/tuning page with lighting, wind, time-of-day, and camera controls (toggle panel with **H**). |
| **`_yh1/`** | Scene assets — `_yh1.js` scene definition, textures (`_tex/`), 3D data (`_3d/yh1_2.ion`), `animations.json`, and audio references. |
| **`jsm/`** | Production JavaScript — minified viewer bundle (`h106.js`) and Three.js r106 (`three.min.js`). |
| **`js/`** | Readable viewer source (`h106.js`). Edit here, then run `npm run build:js` before deploying. |
| **`lib/`** | PHP helpers for the weather proxy — `geomet.php` (GeoMet client), `helpers.php` (rate limiting), `env.php`. |
| **`weather.php`** | JSON weather endpoint for the scene HUD. |
| **`weather-console.html`** | Fetches `weather.php` and logs the response in browser devtools. |
| **`css/`** | Scene styles (`ion.css`). |
| **`mp3/`** | Ambient audio (`wind.mp3`). |
| **`.github/workflows/`** | Deploy workflow (rsync to DreamHost on push to `main`). |
| **`.github/dependabot.yml`** | Dependabot — monthly updates for GitHub Actions and npm. |

## Weather

`weather.php` proxies [MSC GeoMet](https://api.weather.gc.ca/) (no API key required) and returns WeatherAPI-shaped JSON for the scene HUD. `lib/geomet.php` holds the GeoMet client and normalizes bilingual responses to English.

Default coordinates target Pinchard's Island, Newfoundland (`49.2006, -53.4869`). Override with `?lat=…&lon=…` query parameters.

`weather-console.html` logs the JSON response in the browser devtools console.

## Local development

**Requirements:** PHP 8.1+ with the `curl` extension. Node.js 20+ only if you edit the viewer JavaScript.

```bash
git clone https://github.com/adamsimms/adrift.git
cd adrift
php -S localhost:8080
```

Open [http://localhost:8080](http://localhost:8080). The scene loads without secrets; weather needs PHP for `weather.php`.

Use [http://localhost:8080/dev.html](http://localhost:8080/dev.html) for the tuning panel.

### JavaScript workflow

The live site loads the minified bundle in `jsm/`. When editing viewer behaviour:

1. Edit `js/h106.js` (readable source).
2. Regenerate the production bundle:

   ```bash
   npm install
   npm run build:js
   ```

3. Test locally (`index.html` and `dev.html` if you changed viewer behaviour) before opening a PR.

`jsm/three.min.js` is Three.js r106 — upgrade only with care; the viewer targets that revision.

## Deploy

On **push to `main`**, `.github/workflows/deploy.yml` rsyncs this repo to `adrift/` on DreamHost (same server as [pinchards.is](https://github.com/adamsimms/pinchards.is)).

### Repository secrets

Reuse the DreamHost deploy secrets from pinchards.is:

| Secret | Notes |
|--------|--------|
| `FTP_SERVER` | SSH hostname |
| `FTP_USERNAME` | Shell user |
| `FTP_SERVER_DIR` | Site root, e.g. `/home/USER/pinchards.is` (workflow appends `/adrift`) |
| `SSH_DEPLOY_KEY` | ed25519 private key (base64-encoded single line) |

Use **Actions → Deploy → Run workflow** with `dry_run: true` to preview changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Small, focused PRs are welcome — documentation, accessibility, weather hardening, and bug fixes are good starting points.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately to **adam@adamsimms.xyz** — do not open public issues for security problems.

## License

[MIT](LICENSE) — Copyright (c) 2017–2026 Adam Simms and Angela Gabereaux.

Scene assets in `_yh1/` and third-party weather data (MSC GeoMet) have separate terms — see [LICENSE](LICENSE) for details. Three.js is used under its [MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
