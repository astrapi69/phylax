import type { Document } from './types';

/**
 * Thrown when a document carries both `linkedObservationId` and
 * `linkedLabValueId` at the same time.
 *
 * A document is evidence for ONE entity, not both simultaneously.
 * The constraint is enforced at every persistence boundary
 * (`DocumentRepository.create` and `.update`) as defense in depth:
 * the UI picks one or the other through dedicated helpers, but the
 * repository rejects invalid state regardless of who writes it.
 */
export class DocumentLinkConflictError extends Error {
  constructor() {
    super(
      'Document cannot be linked to both an observation and a lab value at the same time. ' +
        'Use linkToObservation / linkToLabValue / unlink helpers to switch links atomically.',
    );
    this.name = 'DocumentLinkConflictError';
  }
}

/**
 * Reject documents that set both link fields. Both absent, or either
 * one set alone, are valid states.
 */
export function validateDocumentLinks(
  doc: Pick<Document, 'linkedObservationId' | 'linkedLabValueId'>,
): void {
  if (doc.linkedObservationId && doc.linkedLabValueId) {
    throw new DocumentLinkConflictError();
  }
}
