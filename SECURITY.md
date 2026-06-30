# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` branch (live at [pinchards.is/adrift](https://www.pinchards.is/adrift/)) | Yes |
| Older tags / forks | No |

## Reporting a vulnerability

**Please do not open a public GitHub issue** for security problems.

Email **adam@adamsimms.xyz** with:

- A description of the issue and impact
- Steps to reproduce (or proof of concept)
- Affected URLs or files, if known

We aim to acknowledge reports within a few days and will coordinate on disclosure timing.

## Secrets and credentials

- **Never commit** SSH private keys, FTP passwords, or other deploy credentials.
- Production deploy secrets live in **GitHub Actions repository secrets** (`FTP_SERVER`, `FTP_USERNAME`, `FTP_SERVER_DIR`, `SSH_DEPLOY_KEY`).
- This project has **no runtime secrets** — `weather.php` uses the public MSC GeoMet API.

If you accidentally commit a secret:

1. **Rotate the credential immediately** — assume it is compromised once pushed.
2. Notify the maintainers so history can be reviewed.

## Scope notes

Adrift is a static Three.js scene with a small PHP weather proxy on shared hosting.

**In scope:** server-side injection in PHP, rate-limit bypass on `weather.php`, misconfigurations that expose private files, and deploy workflow issues that could leak credentials.

**Out of scope:** social engineering, denial-of-service, and vulnerabilities in third-party services (MSC GeoMet, Google Analytics, Google Fonts) unless introduced by this repo's integration.

## Safe harbor

We appreciate responsible disclosure and will not pursue action against researchers who act in good faith and follow this policy.
