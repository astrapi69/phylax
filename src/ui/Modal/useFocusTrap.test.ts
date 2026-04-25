import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

let cleanupFns: Array<() => void> = [];

afterEach(() => {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
});

function makeContainer(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  cleanupFns.push(() => div.remove());
  return div;
}

function pressTab(shift = false): void {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true });
  document.dispatchEvent(e);
}

describe('useFocusTrap', () => {
  it('cycles focus from last to first on Tab', () => {
    const container = makeContainer(
      '<button id="a">A</button><button id="b">B</button><button id="c">C</button>',
    );
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    expect(result.current.current).toBe(container);
    const c = container.querySelector<HTMLButtonElement>('#c');
    if (!c) throw new Error('expected c');
    c.focus();
    expect(document.activeElement).toBe(c);
    pressTab(false);
    expect(document.activeElement?.id).toBe('a');
  });

  it('cycles focus from first to last on Shift+Tab', () => {
    const container = makeContainer(
      '<button id="a">A</button><button id="b">B</button><button id="c">C</button>',
    );
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    const a = container.querySelector<HTMLButtonElement>('#a');
    if (!a) throw new Error('expected a');
    a.focus();
    pressTab(true);
    expect(document.activeElement?.id).toBe('c');
  });

  it('skips disabled and aria-hidden focusables', () => {
    const container = makeContainer(
      '<button id="a">A</button><button id="b" disabled>B</button><button id="c" aria-hidden="true">C</button><button id="d">D</button>',
    );
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    const d = container.querySelector<HTMLButtonElement>('#d');
    if (!d) throw new Error('expected d');
    d.focus();
    pressTab(false);
    // Should wrap to A, skipping disabled B and aria-hidden C.
    expect(document.activeElement?.id).toBe('a');
  });

  it('no-ops when container has zero focusables', () => {
    const container = makeContainer('<span>nothing</span>');
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    // Should not throw on Tab.
    expect(() => pressTab(false)).not.toThrow();
  });

  it('no-ops when enabled is false', () => {
    const container = makeContainer('<button id="a">A</button><button id="b">B</button>');
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, false);
      return ref;
    });
    const b = container.querySelector<HTMLButtonElement>('#b');
    if (!b) throw new Error('expected b');
    b.focus();
    pressTab(false);
    // No trap = focus remains on b (Tab default behavior in jsdom does nothing here).
    expect(document.activeElement).toBe(b);
  });

  it('removes listener on unmount', () => {
    const container = makeContainer('<button id="a">A</button><button id="b">B</button>');
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    unmount();
    const b = container.querySelector<HTMLButtonElement>('#b');
    if (!b) throw new Error('expected b');
    b.focus();
    pressTab(false);
    // After unmount, no trap intercepts; focus stays on b.
    expect(document.activeElement).toBe(b);
  });
});
