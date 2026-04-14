import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  children: string | undefined | null;
  className?: string;
}

/**
 * Single Markdown rendering wrapper for the whole app. Call sites
 * MUST go through this component rather than importing react-markdown
 * directly. See ADR-0008 for the rationale.
 *
 * HTML passthrough is not enabled. Raw HTML in the source renders as
 * text. Any future need for sanitized HTML passthrough requires a new
 * ADR and a dedicated rehype pipeline.
 *
 * Empty or whitespace-only content renders nothing so call sites can
 * pass optional fields without guards.
 */
export function MarkdownContent({ children, className }: MarkdownContentProps) {
  const content = typeof children === 'string' ? children : '';
  if (content.trim() === '') return null;

  return (
    <div className={`prose prose-sm max-w-none ${className ?? ''}`.trim()}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
