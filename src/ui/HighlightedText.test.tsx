import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HighlightedText } from './HighlightedText';

describe('HighlightedText', () => {
  it('renders plain text when ranges is empty', () => {
    const { container } = render(
      <HighlightedText text="hello world" ranges={[]} startMatchIndex={1} />,
    );
    expect(container.textContent).toBe('hello world');
    expect(container.querySelector('mark')).toBeNull();
  });

  it('wraps a single matched range in mark', () => {
    render(
      <HighlightedText
        text="hello world"
        ranges={[{ start: 6, end: 11 }]}
        startMatchIndex={5}
      />,
    );
    const mark = document.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('world');
    expect(mark?.getAttribute('data-match-index')).toBe('5');
  });

  it('wraps multiple ranges with sequential global indices', () => {
    render(
      <HighlightedText
        text="aaa bbb aaa"
        ranges={[
          { start: 0, end: 3 },
          { start: 8, end: 11 },
        ]}
        startMatchIndex={10}
      />,
    );
    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0]?.getAttribute('data-match-index')).toBe('10');
    expect(marks[1]?.getAttribute('data-match-index')).toBe('11');
  });

  it('marks the active match with data-active and aria-current', () => {
    render(
      <HighlightedText
        text="aaa bbb"
        ranges={[
          { start: 0, end: 3 },
          { start: 4, end: 7 },
        ]}
        startMatchIndex={1}
        activeMatchIndex={2}
      />,
    );
    const marks = document.querySelectorAll('mark');
    expect(marks[0]?.getAttribute('data-active')).toBeNull();
    expect(marks[1]?.getAttribute('data-active')).toBe('true');
    expect(marks[1]?.getAttribute('aria-current')).toBe('true');
  });

  it('preserves text segments between, before, and after ranges', () => {
    const { container } = render(
      <HighlightedText
        text="aXbYc"
        ranges={[
          { start: 1, end: 2 },
          { start: 3, end: 4 },
        ]}
        startMatchIndex={1}
      />,
    );
    expect(container.textContent).toBe('aXbYc');
  });

  it('applies different styling for active vs passive marks', () => {
    render(
      <HighlightedText
        text="aaa bbb"
        ranges={[
          { start: 0, end: 3 },
          { start: 4, end: 7 },
        ]}
        startMatchIndex={1}
        activeMatchIndex={1}
      />,
    );
    const marks = document.querySelectorAll('mark');
    expect(marks[0]?.className).toMatch(/orange/);
    expect(marks[1]?.className).toMatch(/yellow/);
  });
});
