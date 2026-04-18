# Security Policy

## Reporting a vulnerability

If you discover a security issue in Phylax, please report it privately
rather than opening a public issue.

**Preferred:** use GitHub's private vulnerability reporting via the
[Security tab](https://github.com/astrapi69/phylax/security/advisories/new).
This keeps the disclosure private while allowing coordinated resolution.

**Alternative:** email aster.raptis@gmail.com.

I aim to respond within 7 days and will work with you on coordinated
disclosure. Please include:

- A clear description of the issue and its impact
- Steps to reproduce
- The affected version (commit hash or tag)
- Any proof-of-concept you have

## Supported versions

| Version | Supported       |
| ------- | --------------- |
| 1.0.x   | yes             |
| < 1.0   | no (use latest) |

## Scope

In scope for security reports:

- Vulnerabilities in the encryption implementation (AES-256-GCM handling,
  PBKDF2 parameters, IV reuse, key lifetime)
- Auto-lock or session-management bypass
- IndexedDB handling that could leak plaintext
- AI API key storage or transmission (Anthropic integration)
- Service worker or PWA install flow vulnerabilities
- Cross-site or injection vectors in the UI
- Privacy disclosure inaccuracy: if the in-app disclaimer or the
  "Datenschutz beim KI-Chat" popover materially misrepresents how data is
  handled (for example, stale Anthropic retention claims after a policy
  change, or undocumented network calls)

Out of scope:

- Vulnerabilities in third-party services (Anthropic, GitHub Pages)
- User choice of master password (weak passwords are the user's
  responsibility)
- User device security (keyloggers, screen recorders, compromised OS)
- Social engineering against the user

## Acknowledgments

Security researchers who report issues responsibly will be credited in
the release notes unless they request otherwise.
