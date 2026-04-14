import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningSignsSection } from './WarningSignsSection';

describe('WarningSignsSection', () => {
  it('renders each warning sign as a list item', () => {
    render(<WarningSignsSection signs={['Brustschmerz', 'Schwindel']} />);
    expect(screen.getByText('Brustschmerz')).toBeInTheDocument();
    expect(screen.getByText('Schwindel')).toBeInTheDocument();
  });

  it('applies the amber visual accent', () => {
    const { container } = render(<WarningSignsSection signs={['x']} />);
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/amber/);
  });

  it('includes a warning glyph in the heading', () => {
    render(<WarningSignsSection signs={['x']} />);
    const heading = screen.getByRole('heading', { level: 2, name: /warnsignale/i });
    expect(heading.textContent).toMatch(/⚠/);
  });

  it('renders nothing when signs list is empty', () => {
    const { container } = render(<WarningSignsSection signs={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
