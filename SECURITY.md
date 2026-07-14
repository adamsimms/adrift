# Security Policy

## Supported

| Target | Supported |
|--------|-----------|
| art.adamsimms.xyz `/adrift/experience/` (assembled from this repo) | Yes |

## Reporting

Please report vulnerabilities privately via GitHub security advisories on this repository or art.adamsimms.xyz.

## Notes

- Production weather is a Cloudflare Pages Function (public MSC GeoMet; no app secrets).
- Never commit deploy keys or tokens.
- In scope: XSS in the scene shell, credential leaks in workflows. Out of scope: third-party CDNs/Sketchfab/GeoMet themselves unless introduced by this repo’s integration.
