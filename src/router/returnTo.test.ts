import { describe, it, expect } from 'vitest';
import { getSafeReturnTo } from './returnTo';

describe('getSafeReturnTo', () => {
  it('returns the path when valid', () => {
    const params = new URLSearchParams('returnTo=%2Fobservations');
    expect(getSafeReturnTo(params)).toBe('/observations');
  });

  it('returns /profile when returnTo is missing', () => {
    const params = new URLSearchParams('');
    expect(getSafeReturnTo(params)).toBe('/profile');
  });

  it('returns /profile when returnTo is empty', () => {
    const params = new URLSearchParams('returnTo=');
    expect(getSafeReturnTo(params)).toBe('/profile');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    const params = new URLSearchParams('returnTo=%2F%2Fevil.com');
    expect(getSafeReturnTo(params)).toBe('/profile');
  });

  it('rejects absolute URLs (https://evil.com)', () => {
    const params = new URLSearchParams('returnTo=https%3A%2F%2Fevil.com');
    expect(getSafeReturnTo(params)).toBe('/profile');
  });

  it('preserves query params in returnTo', () => {
    const params = new URLSearchParams('returnTo=%2Fobservations%3Fpage%3D2');
    expect(getSafeReturnTo(params)).toBe('/observations?page=2');
  });
});
