import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renders plain text', () => {
    const { container } = render(<MarkdownContent>Hallo Welt</MarkdownContent>);
    expect(container.textContent).toContain('Hallo Welt');
  });

  it('renders bold markdown as a <strong> element', () => {
    render(<MarkdownContent>Ein **wichtiger** Hinweis</MarkdownContent>);
    const strong = screen.getByText('wichtiger');
    expect(strong.tagName.toLowerCase()).toBe('strong');
  });

  it('renders bullet lists', () => {
    const { container } = render(<MarkdownContent>{`- Eins\n- Zwei\n- Drei`}</MarkdownContent>);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('Eins');
  });

  it('renders nested bullet lists', () => {
    const md = `- Außen\n  - Innen A\n  - Innen B`;
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    // Outer list + one nested list = 2 <ul> elements
    expect(container.querySelectorAll('ul')).toHaveLength(2);
    expect(container.textContent).toContain('Innen A');
  });

  it('renders nothing for empty string', () => {
    const { container } = render(<MarkdownContent>{''}</MarkdownContent>);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for whitespace-only string', () => {
    const { container } = render(<MarkdownContent>{'   \n  '}</MarkdownContent>);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for undefined/null children', () => {
    const { container } = render(<MarkdownContent>{undefined}</MarkdownContent>);
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render raw HTML (XSS guard)', () => {
    const md = 'Hello <img src=x onerror="alert(1)"> world';
    const { container } = render(<MarkdownContent>{md}</MarkdownContent>);
    // The <img> tag must be rendered as text, not an actual element.
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });

  it('applies prose classes and custom className', () => {
    const { container } = render(<MarkdownContent className="custom-class">test</MarkdownContent>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('prose');
    expect(wrapper?.className).toContain('custom-class');
  });

  describe('search highlighting (P-19)', () => {
    it('renders no marks when highlightQuery is empty', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="">stechender Schmerz</MarkdownContent>,
      );
      expect(container.querySelectorAll('mark')).toHaveLength(0);
    });

    it('wraps each occurrence of the query in a mark element', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="schmerz" startMatchIndex={1}>
          Schmerz hier und Schmerz dort
        </MarkdownContent>,
      );
      const marks = container.querySelectorAll('mark');
      expect(marks).toHaveLength(2);
      expect(marks[0]?.textContent).toBe('Schmerz');
      expect(marks[1]?.textContent).toBe('Schmerz');
    });

    it('assigns sequential data-match-index starting at startMatchIndex', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="x" startMatchIndex={7}>
          x x x
        </MarkdownContent>,
      );
      const marks = container.querySelectorAll('mark');
      expect(marks[0]?.getAttribute('data-match-index')).toBe('7');
      expect(marks[1]?.getAttribute('data-match-index')).toBe('8');
      expect(marks[2]?.getAttribute('data-match-index')).toBe('9');
    });

    it('marks the active index with data-active and aria-current', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="x" startMatchIndex={1} activeMatchIndex={2}>
          x x x
        </MarkdownContent>,
      );
      const marks = container.querySelectorAll('mark');
      expect(marks[0]?.getAttribute('data-active')).toBeNull();
      expect(marks[1]?.getAttribute('data-active')).toBe('true');
      expect(marks[1]?.getAttribute('aria-current')).toBe('true');
      expect(marks[2]?.getAttribute('data-active')).toBeNull();
    });

    it('preserves Markdown formatting (strong) around marks', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="wichtig" startMatchIndex={1}>
          Ein **wichtiger** Hinweis
        </MarkdownContent>,
      );
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      const mark = strong?.querySelector('mark');
      expect(mark?.textContent).toBe('wichtig');
    });

    it('is case- and diacritics-insensitive', () => {
      const { container } = render(
        <MarkdownContent highlightQuery="muller" startMatchIndex={1}>
          Müller hier
        </MarkdownContent>,
      );
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Müller');
    });
  });
});
