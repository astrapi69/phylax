import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPreview } from './ExportPreview';

beforeEach(() => {
  // jsdom does not implement createObjectURL/revokeObjectURL on its
  // own; stub for the PDF preview path.
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportPreview', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ExportPreview
        open={false}
        onClose={vi.fn()}
        content={{ kind: 'markdown', text: 'foo' }}
        onDownload={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when content is null even if open', () => {
    const { container } = render(
      <ExportPreview open={true} onClose={vi.fn()} content={null} onDownload={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Markdown content via MarkdownContent', () => {
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'markdown', text: '# Hallo\n\nWelt' }}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('export-preview-markdown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hallo' })).toBeInTheDocument();
  });

  it('renders Markdown empty placeholder when text is whitespace', () => {
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'markdown', text: '   ' }}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('export-preview-empty')).toBeInTheDocument();
  });

  it('renders a CSV table from the supplied rows', () => {
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{
          kind: 'csv',
          headers: ['Datum', 'Parameter', 'Ergebnis'],
          rows: [
            ['2026-04-15', 'TSH', '2.4'],
            ['2026-04-15', 'Vitamin D', '32'],
          ],
        }}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('export-preview-csv')).toBeInTheDocument();
    expect(screen.getAllByTestId('export-preview-csv-row')).toHaveLength(2);
    expect(screen.getByText('TSH')).toBeInTheDocument();
    expect(screen.getByText('Vitamin D')).toBeInTheDocument();
  });

  it('renders CSV empty placeholder when there are zero rows', () => {
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'csv', headers: ['Datum'], rows: [] }}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('export-preview-empty')).toBeInTheDocument();
  });

  it('renders a sandboxed iframe for PDF content with a Blob URL', () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'pdf', blob }}
        onDownload={vi.fn()}
      />,
    );
    const iframe = screen.getByTestId('export-preview-pdf-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.src).toContain('blob:mock-url');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('revokes the PDF Blob URL when the modal unmounts', () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const { unmount } = render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'pdf', blob }}
        onDownload={vi.fn()}
      />,
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('Close button invokes onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ExportPreview
        open={true}
        onClose={onClose}
        content={{ kind: 'markdown', text: 'foo' }}
        onDownload={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('export-preview-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Download button invokes onDownload', async () => {
    const onDownload = vi.fn();
    const user = userEvent.setup();
    render(
      <ExportPreview
        open={true}
        onClose={vi.fn()}
        content={{ kind: 'markdown', text: 'foo' }}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByTestId('export-preview-download'));
    expect(onDownload).toHaveBeenCalledOnce();
  });
});
