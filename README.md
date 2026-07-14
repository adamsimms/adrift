# Adrift

A Newfoundland saltbox house adrift on the open Atlantic — a real-time Three.js scene animated by live weather from [MSC GeoMet](https://api.weather.gc.ca/).

**Canonical:** [art.adamsimms.xyz/adrift/experience/](https://art.adamsimms.xyz/adrift/experience/)  
Portfolio: [art.adamsimms.xyz/adrift](https://art.adamsimms.xyz/adrift)

## Artist statement

Adrift elides physical and virtual space while challenging ephemeral notions of home. The digital structure floats perpetually on the ocean in response to real-time atmospheric data from a weather station in the Atlantic Ocean. As the viewer experiences the piece, the house drifts and turns as it would if it were floating in physical space.

Adrift functions as a historical representation of my grandmother's experience, and by extension, all resettled homes. The house also acts as another form of resettlement to a third, imaginary dimension still influenced by its geographical context: whereby the image prevails over the thing it is an image of. The virtual space, linked to an actual place via data, becomes a third space of hybridity accessed by the window of technology.

While technology allows us to access this hybrid space, it also challenges the real and actual, the near and far. It reminds us that neither a resettled resident nor their home can ever return to their origins.

## Project layout

| Area | Purpose |
|------|---------|
| **`index.html`** | Production scene entry point. |
| **`dev.html`** | Dev/tuning page (toggle panel with **H**). |
| **`_yh1/`** | Scene assets, textures, animations, audio refs. |
| **`jsm/`** | Production JS — minified viewer (`h106.js`) + Three.js r106. |
| **`js/`** | Readable viewer source. Edit here, then `npm run build:js`. |
| **`lib/`** | Reference GeoMet client helpers (production weather is an art Pages Function). |
| **`css/`**, **`mp3/`** | Styles and ambient audio. |

## Weather

On art, the scene calls **`/adrift/api/weather`** (Pages Function → MSC GeoMet). No API key. Default coordinates: Pinchard's Island (`49.2006, -53.4869`); override with `?lat=` / `?lon=`.

## Local development

Node.js 20+ if you edit viewer JavaScript. Static scene:

```bash
git clone https://github.com/adamsimms/adrift.git
cd adrift
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080/). Weather HUD needs the art Function (or point the fetch at a reachable GeoMet proxy while developing).

### JavaScript workflow

1. Edit `js/h106.js`.
2. `npm install && npm run build:js`
3. Test `index.html` / `dev.html` before opening a PR.

## Ship

Canonical experience is assembled into **art.adamsimms.xyz** `/adrift/experience/`. See art [PHASE4-SIBLINGS.md](https://github.com/adamsimms/art.adamsimms.xyz/blob/main/docs/PHASE4-SIBLINGS.md).
