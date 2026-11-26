import { describe, it, expect, vi } from 'vitest';
import { notifyProfilesChanged, subscribeProfilesChanged } from './profilesChanged';

describe('profilesChanged signal (M-09)', () => {
  it('calls every subscriber on notify', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = subscribeProfilesChanged(first);
    const offSecond = subscribeProfilesChanged(second);

    notifyProfilesChanged();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops calling a subscriber after it unsubscribed', () => {
    const listener = vi.fn();
    const off = subscribeProfilesChanged(listener);
    off();

    notifyProfilesChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('does nothing without subscribers', () => {
    expect(() => notifyProfilesChanged()).not.toThrow();
  });

  it('lets a subscriber unsubscribe during a notification', () => {
    const later = vi.fn();
    const offs: Array<() => void> = [];
    offs.push(subscribeProfilesChanged(() => offs.forEach((off) => off())));
    offs.push(subscribeProfilesChanged(later));

    expect(() => notifyProfilesChanged()).not.toThrow();
    expect(later).toHaveBeenCalledTimes(1);

    notifyProfilesChanged();
    expect(later).toHaveBeenCalledTimes(1);
  });
});
