import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewScreen } from './PreviewScreen';
import type { ParseResult } from '../parser/types';

function makeResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
    ...overrides,
  };
}

describe('PreviewScreen', () => {
  it('renders source label, target, and summary counts', () => {
    const pr = makeResult({
      observations: [
        {
          theme: 'Knie',
          fact: 'Schmerz',
          pattern: 'Belastung',
          selfRegulation: 'Training',
          status: 'Stabil',
          source: 'user',
          extraSections: {},
        },
      ],
      supplements: [{ name: 'Vit D', category: 'daily' }],
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="profil.md"
        targetProfileName="Mein Profil"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('profil.md')).toBeInTheDocument();
    expect(screen.getByText('Mein Profil')).toBeInTheDocument();
    expect(screen.getByText(/1 Beobachtung/)).toBeInTheDocument();
    expect(screen.getByText(/1 Supplement/)).toBeInTheDocument();
  });

  it('shows clean-parse indicator when no warnings or unrecognized blocks', () => {
    render(
      <PreviewScreen
        parseResult={makeResult()}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId('parse-clean')).toBeInTheDocument();
  });

  it('shows the warnings disclosure when warning-severity notices are present', async () => {
    const user = userEvent.setup();
    const pr = makeResult({
      report: {
        recognized: [],
        unrecognized: [],
        metadata: {},
        warnings: [{ section: 'Basisdaten', severity: 'warning', message: 'unerwartet' }],
      },
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('parse-clean')).not.toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /1 Warnung beim Parsen/ });
    await user.click(btn);
    expect(screen.getByText(/unerwartet/)).toBeInTheDocument();
  });

  it('shows a separate skipped-sections disclosure for info-severity notices', async () => {
    const user = userEvent.setup();
    const pr = makeResult({
      report: {
        recognized: [],
        unrecognized: [],
        metadata: {},
        warnings: [
          { section: 'Ausgangslage', severity: 'info', message: 'Section is empty. Skipped.' },
          { section: 'Erholung', severity: 'info', message: 'Section is empty. Skipped.' },
        ],
      },
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    // No amber warnings block, no clean indicator: the skipped block stands alone.
    expect(screen.queryByTestId('warnings-disclosure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('parse-clean')).not.toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /2 leere Abschnitte übersprungen/ });
    await user.click(btn);
    expect(screen.getByText(/Ausgangslage/)).toBeInTheDocument();
    expect(screen.getByText(/Erholung/)).toBeInTheDocument();
  });

  it('separates warning-severity and info-severity notices into distinct disclosures', () => {
    const pr = makeResult({
      report: {
        recognized: [],
        unrecognized: [],
        metadata: {},
        warnings: [
          { section: 'Basisdaten', severity: 'warning', message: 'unerwartet' },
          { section: 'Ausgangslage', severity: 'info', message: 'Section is empty. Skipped.' },
        ],
      },
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId('warnings-disclosure')).toBeInTheDocument();
    expect(screen.getByTestId('skipped-disclosure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 Warnung beim Parsen/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /1 leerer Abschnitt übersprungen/ }),
    ).toBeInTheDocument();
  });

  it('shows unrecognized disclosure when present', () => {
    const pr = makeResult({
      report: {
        recognized: [],
        warnings: [],
        metadata: {},
        unrecognized: [{ heading: 'Komische Sektion', content: '' }],
      },
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /1 nicht erkannter Block/ })).toBeInTheDocument();
  });

  it('observations accordion is collapsed by default and reveals content on click', async () => {
    const user = userEvent.setup();
    const pr = makeResult({
      observations: [
        {
          theme: 'Schulter',
          fact: 'Schmerz bei Druck',
          pattern: '',
          selfRegulation: '',
          status: 'Stabil',
          source: 'user',
          extraSections: {},
        },
      ],
    });
    render(
      <PreviewScreen
        parseResult={pr}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    // collapsed
    expect(screen.queryByText(/Schmerz bei Druck/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Beobachtungen anzeigen \(1\)/ }));
    expect(screen.getByText(/Schmerz bei Druck/)).toBeInTheDocument();
  });

  it('Zurück calls onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <PreviewScreen
        parseResult={makeResult()}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={vi.fn()}
        onBack={onBack}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('Import starten calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PreviewScreen
        parseResult={makeResult()}
        sourceLabel="x"
        targetProfileName="y"
        onConfirm={onConfirm}
        onBack={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Import starten' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
