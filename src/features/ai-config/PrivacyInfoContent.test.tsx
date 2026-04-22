import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivacyInfoContent } from './PrivacyInfoContent';

describe('PrivacyInfoContent', () => {
  it('renders all three section headings', () => {
    render(<PrivacyInfoContent />);
    expect(screen.getByRole('heading', { name: 'Was Phylax macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was Anthropic macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was du kontrollierst' })).toBeInTheDocument();
  });

  it('explicitly names the 30-day retention window and auto-deletion', () => {
    render(<PrivacyInfoContent />);
    expect(screen.getByText(/30 Tage/)).toBeInTheDocument();
    expect(screen.getByText(/danach automatisch/)).toBeInTheDocument();
  });

  it('explicitly states that inputs are not used for AI training', () => {
    render(<PrivacyInfoContent />);
    expect(screen.getByText(/nicht für KI-Training/)).toBeInTheDocument();
  });

  it('names the user-owned account and API key up front', () => {
    render(<PrivacyInfoContent />);
    expect(screen.getByText(/Anthropic-Account und API-Schlüssel gehören dir/)).toBeInTheDocument();
  });

  it('links to privacy.claude.com with safe target/rel attributes', () => {
    render(<PrivacyInfoContent />);
    const link = screen.getByRole('link', { name: /privacy\.claude\.com/ });
    expect(link).toHaveAttribute('href', 'https://privacy.claude.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
