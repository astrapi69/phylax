#!/usr/bin/env node
/**
 * Scans the production build (dist/) for references to external hosts.
 *
 * Fails (exit 1) if any host outside the allowlist appears in a built
 * asset, so a new dependency, font, or feature cannot silently start
 * leaking the visitor's IP to a third party (CLAUDE.md: "Keine eigenen
 * externen Services... Ausnahme: nutzerinitiierte KI-Requests").
 *
 * A host on the allowlist is not necessarily fetched automatically;
 * each entry's `reason` documents the actual trigger, verified by
 * reading the call site, not just grepping the string (CC privacy
 * audit, 2026-09-16, Point 1).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const SCAN_EXTENSIONS = new Set(['.js', '.html', '.json']);
const URL_PATTERN = /https?:\/\/([a-zA-Z0-9.-]+)/g;

/**
 * Hosts allowed to appear in the built artifact, with a written
 * justification each (required by the "Allowlist nur mit
 * schriftlicher Begruendung" rule).
 */
export const ALLOWLIST = [
  // Own domain (canonical URL, Open Graph, JSON-LD)
  {
    host: 'astrapi69.github.io',
    reason: 'Own GitHub Pages domain, used in canonical/OG/JSON-LD metadata in index.html.',
  },
  // User-initiated AI requests, own API key (ADR-0019)
  {
    host: 'api.anthropic.com',
    reason:
      'AI provider preset. Called only if the user configures this provider and sends a chat message with their own API key (ADR-0019).',
  },
  {
    host: 'api.openai.com',
    reason:
      'AI provider preset (config only). Browser CORS blocks real calls per providers.ts corsHint "blocked"; the URL is never actually fetched by the running app today.',
  },
  {
    host: 'api.mistral.ai',
    reason: 'AI provider preset (config only). Same CORS-blocked status as OpenAI.',
  },
  {
    host: 'generativelanguage.googleapis.com',
    reason:
      'AI provider preset (Google Gemini). Called only if the user configures this provider and sends a chat message with their own API key.',
  },
  {
    host: 'localhost',
    reason: 'LM Studio / Ollama local-server provider presets. Never leaves the device.',
  },
  // Outbound links, opened only on explicit user click, not resource loads
  {
    host: 'privacy.claude.com',
    reason:
      'Link in AIDisclaimer / PrivacyInfoContent to Anthropic privacy policy, target="_blank", opened only on click.',
  },
  {
    host: 'github.com',
    reason:
      'Donation link (DONATE.md) plus library doc references embedded in bundled error-message strings (react-router, dexie related packages). Not fetched by Befaro.',
  },
  {
    host: 'docs.github.com',
    reason:
      'Link in DatenschutzView (P-16) to the GitHub Privacy Statement, target="_blank", opened only on click.',
  },
  {
    host: 'openai.com',
    reason:
      'Link in DatenschutzView (P-16) to OpenAI\'s own privacy policy, target="_blank", opened only on click.',
  },
  {
    host: 'policies.google.com',
    reason:
      'Link in DatenschutzView (P-16) to Google\'s own privacy policy, target="_blank", opened only on click.',
  },
  {
    host: 'mistral.ai',
    reason:
      'Link in DatenschutzView (P-16) to Mistral\'s own privacy policy, target="_blank", opened only on click.',
  },
  // Inert strings bundled inside third-party library code, never fetched
  {
    host: 'react.dev',
    reason: 'React dev-mode warning message text, never fetched.',
  },
  {
    host: 'reactrouter.com',
    reason: 'react-router-dom warning message text, never fetched.',
  },
  {
    host: 'bit.ly',
    reason: 'Dexie error-message text (troubleshooting link), never fetched.',
  },
  {
    host: 'tinyurl.com',
    reason: 'Dexie error-message text (IndexedDB troubleshooting link), never fetched.',
  },
  {
    host: 'cdnjs.cloudflare.com',
    reason:
      'jsPDF optional PDFObject-viewer fallback, only reachable via doc.output("...newwindow"). Befaro only ever calls output("blob") (pdfExport.ts), so this branch is unreachable in this app.',
  },
  {
    host: 'ns.adobe.com',
    reason:
      'XML namespace URI string compared inside pdf.js XFA form parser, never fetched (same class as an xmlns attribute).',
  },
  {
    host: 'www.xfa.org',
    reason: 'XML namespace URI string, same class as ns.adobe.com above.',
  },
  {
    host: 'jspdf.default.namespaceuri',
    reason: 'jsPDF internal placeholder default string, not a resolvable host.',
  },
  {
    host: 'example.com',
    reason: 'Placeholder/example string bundled in a third-party library, never fetched.',
  },
  {
    host: 'foo.bar',
    reason: 'Placeholder/example string bundled in a third-party library, never fetched.',
  },
  {
    host: 'schema.org',
    reason: 'JSON-LD @context identifier in index.html structured data, a URI, never fetched.',
  },
  {
    host: 'www.w3.org',
    reason: 'SVG/XML namespace URI (xmlns), never fetched.',
  },
  {
    host: 'spdx.org',
    reason: 'License URL in the JSON-LD block for search engines, not fetched by the app.',
  },
];

/** Extracts the lowercased host of every http(s) URL found in `text`. */
export function extractHosts(text) {
  const hosts = new Set();
  let match;
  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text))) {
    hosts.add(match[1].toLowerCase());
  }
  return hosts;
}

/** Returns the hosts found in `text` that are not on `allowlist`. */
export function findDisallowedHosts(text, allowlist) {
  const allowed = new Set(allowlist.map((entry) => entry.host.toLowerCase()));
  return [...extractHosts(text)].filter((host) => !allowed.has(host));
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (SCAN_EXTENSIONS.has(extname(name))) {
      files.push(full);
    }
  }
  return files;
}

function scanDist() {
  const distDir = fileURLToPath(new URL('../dist', import.meta.url));
  let files;
  try {
    files = walk(distDir);
  } catch {
    console.error(`dist/ not found at ${distDir}. Run "make build" first.`);
    process.exitCode = 1;
    return;
  }

  const violations = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf-8');
    for (const host of findDisallowedHosts(text, ALLOWLIST)) {
      if (!violations.has(host)) violations.set(host, new Set());
      violations.get(host).add(file.replace(`${distDir}/`, ''));
    }
  }

  if (violations.size === 0) {
    console.log(`OK: no disallowed external hosts found in ${files.length} scanned files.`);
    return;
  }

  console.error('Disallowed external hosts found in the build artifact:\n');
  for (const [host, inFiles] of violations) {
    console.error(`  ${host}`);
    for (const file of inFiles) console.error(`    in ${file}`);
  }
  console.error(
    '\nIf this host is intentional, add it to ALLOWLIST in scripts/audit-external-resources.mjs with a written justification.',
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scanDist();
}
