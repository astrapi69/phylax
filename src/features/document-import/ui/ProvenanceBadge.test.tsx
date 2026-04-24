import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../i18n/config';
import { ProvenanceBadge } from './ProvenanceBadge';
import { DocumentRepository } from '../../../db/repositories';
import type { Document } from '../../../domain';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

function stubRepo(document: Document | null): DocumentRepository {
  const repo = Object.create(DocumentRepository.prototype) as DocumentRepository;
  repo.getMetadata = vi.fn(async () => document);
  return repo;
}

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    profileId: 'profile-1',
    createdAt: 100,
    updatedAt: 100,
    filename: 'lab-2026-04.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    description: 'Importiert: Laborbefund',
    ...overrides,
  };
}

describe('ProvenanceBadge', () => {
  it('renders nothing when sourceDocumentId is undefined', () => {
    const { container } = render(
      <MemoryRouter>
        <ProvenanceBadge />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state initially, then the filename link', async () => {
    const repo = stubRepo(doc());
    render(
      <MemoryRouter>
        <ProvenanceBadge sourceDocumentId="doc-1" repo={repo} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('provenance-badge-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('provenance-badge')).toBeInTheDocument());
    expect(screen.getByTestId('provenance-badge')).toHaveTextContent('lab-2026-04.pdf');
  });

  it('truncates long filenames', async () => {
    const longName = 'extremely-long-filename-that-exceeds-the-badge-width.pdf';
    const repo = stubRepo(doc({ filename: longName }));
    render(
      <MemoryRouter>
        <ProvenanceBadge sourceDocumentId="doc-1" repo={repo} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('provenance-badge')).toBeInTheDocument());
    expect(screen.getByTestId('provenance-badge').textContent).toContain('…');
  });

  it('renders as a link pointing to /documents/:id', async () => {
    const repo = stubRepo(doc());
    render(
      <MemoryRouter>
        <ProvenanceBadge sourceDocumentId="doc-1" repo={repo} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('provenance-badge')).toBeInTheDocument());
    expect(screen.getByTestId('provenance-badge')).toHaveAttribute('href', '/documents/doc-1');
  });

  it('renders "Quelle entfernt" when metadata is missing', async () => {
    const repo = stubRepo(null);
    render(
      <MemoryRouter>
        <ProvenanceBadge sourceDocumentId="doc-1" repo={repo} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('provenance-badge-missing')).toBeInTheDocument());
    expect(screen.getByTestId('provenance-badge-missing')).toHaveTextContent('Quelle entfernt');
  });

  it('treats a thrown repo error as a transient loading state (key store locked)', async () => {
    const repo = Object.create(DocumentRepository.prototype) as DocumentRepository;
    repo.getMetadata = vi.fn(async () => {
      throw new Error('key store locked');
    });
    render(
      <MemoryRouter>
        <ProvenanceBadge sourceDocumentId="doc-1" repo={repo} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('provenance-badge-loading')).toBeInTheDocument());
  });
});
