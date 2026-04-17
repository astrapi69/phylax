import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineEntryCard } from './TimelineEntryCard';
import { makeTimelineEntry } from './test-helpers';

describe('TimelineEntryCard', () => {
  it('renders the period as a level-2 heading', () => {
    render(<TimelineEntryCard entry={makeTimelineEntry({ period: 'Maerz 2026' })} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Maerz 2026' })).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<TimelineEntryCard entry={makeTimelineEntry({ title: 'Brustkorbbeschwerden' })} />);
    expect(screen.getByText('Brustkorbbeschwerden')).toBeInTheDocument();
  });

  it('renders content via MarkdownContent', () => {
    render(<TimelineEntryCard entry={makeTimelineEntry({ content: 'Narrative mit **fett**.' })} />);
    const strong = screen.getByText('fett');
    expect(strong.tagName.toLowerCase()).toBe('strong');
  });

  it('shows the source badge for non-user sources', () => {
    render(<TimelineEntryCard entry={makeTimelineEntry({ source: 'ai' })} />);
    expect(screen.getByText('KI')).toBeInTheDocument();
  });

  it('does not show the source badge for user-sourced entries', () => {
    render(<TimelineEntryCard entry={makeTimelineEntry({ source: 'user' })} />);
    expect(screen.queryByText('Arzt')).toBeNull();
    expect(screen.queryByText('KI')).toBeNull();
  });
});
