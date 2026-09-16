import { describe, it, expect } from 'vitest';
import { extractHosts, findDisallowedHosts, ALLOWLIST } from './audit-external-resources.mjs';

describe('extractHosts', () => {
  it('extracts a single https host from surrounding text', () => {
    const hosts = extractHosts('fetch(`https://evil-tracker.example/collect`)');
    expect(hosts.has('evil-tracker.example')).toBe(true);
  });

  it('extracts multiple distinct hosts including http', () => {
    const hosts = extractHosts('a https://foo.example/x b http://bar.example/y');
    expect(hosts).toEqual(new Set(['foo.example', 'bar.example']));
  });

  it('lowercases hosts so casing cannot evade the allowlist', () => {
    const hosts = extractHosts('https://EVIL.EXAMPLE/x');
    expect(hosts.has('evil.example')).toBe(true);
  });

  it('returns an empty set for text with no URLs', () => {
    expect(extractHosts('no urls here').size).toBe(0);
  });

  it('ignores a bare host without a scheme', () => {
    expect(extractHosts('evil.example/collect').size).toBe(0);
  });

  it('strips a trailing port from the extracted host', () => {
    const hosts = extractHosts('http://localhost:1234/v1');
    expect(hosts).toEqual(new Set(['localhost']));
  });
});

describe('findDisallowedHosts', () => {
  it('flags a host not present in the allowlist', () => {
    const violations = findDisallowedHosts('https://tracker.example/beacon', ALLOWLIST);
    expect(violations).toContain('tracker.example');
  });

  it('does not flag any currently allowlisted host', () => {
    const text = ALLOWLIST.map((entry) => `https://${entry.host}/x`).join(' ');
    const violations = findDisallowedHosts(text, ALLOWLIST);
    expect(violations).toEqual([]);
  });

  it('is case-insensitive against the allowlist', () => {
    const violations = findDisallowedHosts('https://API.ANTHROPIC.COM/v1', ALLOWLIST);
    expect(violations).toEqual([]);
  });

  it('flags a typosquat host even when it contains an allowed host as a substring', () => {
    const violations = findDisallowedHosts(
      'https://api.anthropic.com.evil.example/phish',
      ALLOWLIST,
    );
    expect(violations).toContain('api.anthropic.com.evil.example');
  });

  it('returns an empty array when the text has no URLs at all', () => {
    expect(findDisallowedHosts('nothing to see here', ALLOWLIST)).toEqual([]);
  });
});
