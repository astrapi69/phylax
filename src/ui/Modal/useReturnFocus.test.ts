import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReturnFocus } from './useReturnFocus';

const cleanup: Array<() => void> = [];

afterEach(() => {
  cleanup.forEach((fn) => fn());
  cleanup.length = 0;
});

function addBtn(id: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = id;
  b.textContent = id;
  document.body.appendChild(b);
  cleanup.push(() => b.remove());
  return b;
}

describe('useReturnFocus', () => {
  it('restores focus to trigger on unmount', () => {
    const trigger = addBtn('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    const { unmount } = renderHook(() => useReturnFocus(true));
    // Simulate dialog stealing focus.
    const inside = addBtn('inside');
    inside.focus();
    expect(document.activeElement).toBe(inside);
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to body when trigger is removed from DOM', () => {
    const trigger = addBtn('disappears');
    trigger.focus();
    const { unmount } = renderHook(() => useReturnFocus(true));
    trigger.remove();
    unmount();
    // Should not throw; focus targets body.
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  });

  it('no-ops when enabled is false', () => {
    const trigger = addBtn('trigger');
    trigger.focus();
    const inside = addBtn('inside');
    const { unmount } = renderHook(() => useReturnFocus(false));
    inside.focus();
    unmount();
    // No restore happened; focus stays where the test put it.
    expect(document.activeElement).toBe(inside);
  });
});
