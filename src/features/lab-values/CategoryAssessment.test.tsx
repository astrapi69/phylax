import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryAssessment } from './CategoryAssessment';

describe('CategoryAssessment', () => {
  it('renders assessment text via MarkdownContent', () => {
    render(<CategoryAssessment category="Blutbild" assessment="Alle Werte **unauffaellig**." />);
    expect(screen.getByText('unauffaellig')).toBeInTheDocument();
    expect(screen.getByText('unauffaellig').tagName.toLowerCase()).toBe('strong');
  });

  it('renders nothing when assessment is empty', () => {
    const { container } = render(<CategoryAssessment category="Blutbild" assessment="" />);
    expect(container.firstChild).toBeNull();
  });

  it('preserves the German category name in the label', () => {
    render(<CategoryAssessment category="Nierenwerte" assessment="Kreatinin leicht erhoht." />);
    expect(screen.getByText(/Einschaetzung Nierenwerte/)).toBeInTheDocument();
  });
});
