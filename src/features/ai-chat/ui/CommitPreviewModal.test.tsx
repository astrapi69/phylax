import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitPreviewModal } from './CommitPreviewModal';
import { detectProfileFragment, type DetectedFragment } from '../detection';

function requireFragment(raw: string): DetectedFragment {
  const fragment = detectProfileFragment(raw);
  if (!fragment) throw new Error('expected a detected fragment');
  return fragment;
}

const OBSERVATION_FRAGMENT = requireFragment(
  `### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz bei Bankdruecken\n- **Muster:** Gurtbelastung\n- **Selbstregulation:** SCM-Routine`,
);

const MIXED_FRAGMENT = requireFragment(`### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach Lauftraining

## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Magnesium 400 |

## Offene Punkte

### Laufen
- Laufschuh-Check`);

describe('CommitPreviewModal', () => {
  it('renders the observation preview with theme and all four fields', () => {
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={vi.fn()} />);
    const section = screen.getByTestId('commit-preview-observations');
    expect(section).toHaveTextContent('Linke Schulter');
    expect(section).toHaveTextContent('Status:');
    expect(section).toHaveTextContent('Akut');
    expect(section).toHaveTextContent('Druckschmerz bei Bankdruecken');
    expect(section).toHaveTextContent('SCM-Routine');
  });

  it('renders the supplements preview with the German category label', () => {
    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    const section = screen.getByTestId('commit-preview-supplements');
    expect(section).toHaveTextContent('Magnesium 400');
    expect(section).toHaveTextContent('taeglich');
  });

  it('renders the open points preview grouped by context', () => {
    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    const section = screen.getByTestId('commit-preview-open-points');
    expect(section).toHaveTextContent('Laufen');
    expect(section).toHaveTextContent('Laufschuh-Check');
  });

  it('"Uebernehmen" is rendered disabled with the AI-08 tooltip', () => {
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Uebernehmen' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('title', 'Wird in AI-08 aktiviert');
  });

  it('"Schliessen" button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key also calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('exposes a dialog role with aria-modal and focuses "Schliessen" on mount', () => {
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'commit-preview-title');
    expect(screen.getByRole('button', { name: 'Schliessen' })).toHaveFocus();
  });

  it('exposes a Roh-Markdown toggle', () => {
    render(<CommitPreviewModal fragment={OBSERVATION_FRAGMENT} onClose={vi.fn()} />);
    expect(screen.getByTestId('commit-preview-raw-toggle')).toHaveTextContent(
      'Roh-Markdown anzeigen',
    );
  });

  it('shows an amber banner when the parser produces nothing usable', async () => {
    // Build a fragment whose observation heading has a field marker (passes
    // detection) but whose body contains only the field marker with no
    // accompanying theme recognizable by the parser. Here we hand-craft a
    // bare supplement block with an empty table body so parseProfile returns
    // zero entities.
    const emptyTable = requireFragment(
      `## Supplemente\n\n| Kategorie | Praeparat |\n| --- | --- |`,
    );
    render(<CommitPreviewModal fragment={emptyTable} onClose={vi.fn()} />);
    expect(screen.getByTestId('commit-preview-empty')).toBeInTheDocument();
  });
});
