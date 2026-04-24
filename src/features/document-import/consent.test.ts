import { describe, it, expect, beforeEach } from 'vitest';
import { isConsentGranted, grantConsentForSession, __resetConsentSession } from './consent';

beforeEach(() => {
  __resetConsentSession();
});

describe('consent', () => {
  it('starts with no granted reasons', () => {
    expect(isConsentGranted('pdf-rasterization')).toBe(false);
  });

  it('grant + check round trip', () => {
    grantConsentForSession('pdf-rasterization');
    expect(isConsentGranted('pdf-rasterization')).toBe(true);
  });

  it('grantConsentForSession is idempotent', () => {
    grantConsentForSession('pdf-rasterization');
    grantConsentForSession('pdf-rasterization');
    grantConsentForSession('pdf-rasterization');
    expect(isConsentGranted('pdf-rasterization')).toBe(true);
  });

  it('__resetConsentSession clears all grants', () => {
    grantConsentForSession('pdf-rasterization');
    __resetConsentSession();
    expect(isConsentGranted('pdf-rasterization')).toBe(false);
  });
});
