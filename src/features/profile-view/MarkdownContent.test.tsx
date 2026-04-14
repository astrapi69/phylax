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
});
