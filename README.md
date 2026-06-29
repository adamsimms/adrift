# Adrift

Three.js scene — live at [pinchards.is/adrift/](https://www.pinchards.is/adrift/).

## Weather

`weather.php` proxies [MSC GeoMet](https://api.weather.gc.ca/) (no API key) and returns WeatherAPI-shaped JSON for the scene HUD. `lib/geomet.php` holds the GeoMet client.

`weather-console.html` logs the JSON response in the browser devtools console.

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

Use **Actions → Deploy SFTP → Run workflow** with `dry_run: true` to preview changes.

## Local dev

Serve the folder with any static/PHP server, e.g.:

```bash
php -S localhost:8080
```

Open `http://localhost:8080/` — weather needs PHP for `weather.php`.
