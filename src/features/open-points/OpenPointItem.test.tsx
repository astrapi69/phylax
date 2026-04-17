import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenPointItem } from './OpenPointItem';
import { makeOpenPoint } from './test-helpers';

describe('OpenPointItem', () => {
  it('renders the point text', () => {
    render(<OpenPointItem point={makeOpenPoint({ text: 'MRT-Ergebnis besprechen' })} />);
    expect(screen.getByText('MRT-Ergebnis besprechen')).toBeInTheDocument();
  });

  it('renders priority as a badge when present', () => {
    render(<OpenPointItem point={makeOpenPoint({ priority: 'hoch' })} />);
    expect(screen.getByText('hoch')).toBeInTheDocument();
  });

  it('renders time horizon as a badge when present', () => {
    render(<OpenPointItem point={makeOpenPoint({ timeHorizon: 'Innerhalb 3 Monate' })} />);
    expect(screen.getByText('Innerhalb 3 Monate')).toBeInTheDocument();
  });

  it('resolved item shows a checked disabled checkbox, Erledigt badge, and strikethrough text', () => {
    const { container } = render(
      <OpenPointItem point={makeOpenPoint({ resolved: true, text: 'erledigter Punkt' })} />,
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText('Erledigt')).toBeInTheDocument();
    expect(screen.getByText('erledigter Punkt').className).toMatch(/line-through/);
    // Muted container tint (bg-gray-50) instead of bg-white
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/bg-gray-50/);
  });

  it('renders details via MarkdownContent when present', () => {
    render(
      <OpenPointItem point={makeOpenPoint({ details: 'Zusatz mit **fett** hervorgehoben.' })} />,
    );
    expect(screen.getByText('fett').tagName.toLowerCase()).toBe('strong');
  });
});
