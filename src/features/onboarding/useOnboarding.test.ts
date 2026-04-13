import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { getLockState, lock } from '../../crypto';
import { metaExists } from '../../db/meta';
import { resetDatabase } from '../../db/test-helpers';
import { useOnboarding } from './useOnboarding';

const VALID_PASSWORD = 'test-password-12';
const onComplete = vi.fn();

beforeEach(async () => {
  lock();
  await resetDatabase();
  onComplete.mockReset();
});

describe('useOnboarding', () => {
  it('initial state is setup', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));
    expect(result.current.state).toBe('setup');
    expect(result.current.password).toBe('');
    expect(result.current.confirmPassword).toBe('');
  });

  it('shows strength for valid password', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => result.current.setPassword(VALID_PASSWORD));

    expect(result.current.strength).toBeDefined();
    expect(result.current.passwordError).toBeUndefined();
  });

  it('shows error for short password', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => result.current.setPassword('short'));

    expect(result.current.passwordError).toBeDefined();
    expect(result.current.state).toBe('setup');
  });

  it('transitions to confirm when password is valid', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => result.current.setPassword(VALID_PASSWORD));

    expect(result.current.state).toBe('confirm');
  });

  it('returns to setup when password is edited to be invalid', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => result.current.setPassword(VALID_PASSWORD));
    expect(result.current.state).toBe('confirm');

    act(() => result.current.setPassword('short'));
    expect(result.current.state).toBe('setup');
  });

  it('shows mismatch error when passwords do not match on submit', async () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => {
      result.current.setPassword(VALID_PASSWORD);
      result.current.setConfirmPassword('wrong-password1');
      result.current.setAcknowledged(true);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.confirmError).toBeDefined();
    expect(result.current.confirmPassword).toBe('');
  });

  it('completes full flow: setup -> confirm -> deriving -> done', async () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => {
      result.current.setPassword(VALID_PASSWORD);
      result.current.setConfirmPassword(VALID_PASSWORD);
      result.current.setAcknowledged(true);
    });

    expect(result.current.submitEnabled).toBe(true);

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe('done');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('keyStore is unlocked after successful onboarding', async () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => {
      result.current.setPassword(VALID_PASSWORD);
      result.current.setConfirmPassword(VALID_PASSWORD);
      result.current.setAcknowledged(true);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(getLockState()).toBe('unlocked');
    lock();
  });

  it('meta row exists with salt after successful onboarding', async () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => {
      result.current.setPassword(VALID_PASSWORD);
      result.current.setConfirmPassword(VALID_PASSWORD);
      result.current.setAcknowledged(true);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(await metaExists()).toBe(true);
    lock();
  });

  it('submit is disabled without acknowledgment', () => {
    const { result } = renderHook(() => useOnboarding(onComplete));

    act(() => {
      result.current.setPassword(VALID_PASSWORD);
      result.current.setConfirmPassword(VALID_PASSWORD);
    });

    expect(result.current.submitEnabled).toBe(false);

    act(() => result.current.setAcknowledged(true));
    expect(result.current.submitEnabled).toBe(true);
  });
});
