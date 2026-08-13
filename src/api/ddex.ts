import { get, post } from './client';

export type DdexDocument = {
  ddexDocumentId: number;
  ddexDocumentFileName: string;
  ddexDocumentFamily: string;
  ddexDocumentVersion: string;
  ddexDocumentStatus: string;
  ddexDocumentMessageId: string | null;
  ddexDocumentSenderId: string | null;
  ddexDocumentRecipientId: string | null;
  ddexDocumentCreatedAt: string;
};

export type DdexValidationIssue = {
  issueSeverity: string;
  issueLayer: string;
  issueCode: string;
  issueMessage: string;
  issueLine: number | null;
  issueColumn: number | null;
};

export type DdexValidationReport = {
  reportRunId: number;
  reportIssues: DdexValidationIssue[];
  reportIsValid: boolean;
};

export type DdexPartner = {
  ddexPartnerId: number;
  ddexPartnerName: string;
  ddexPartnerDpid: string | null;
  ddexPartnerAllowedVersions: string[];
};

export const listDdexDocuments = (status?: string): Promise<DdexDocument[]> =>
  get(`/ddex/documents${status ? `?status=${encodeURIComponent(status)}` : ''}`);

export const getDdexDocument = (id: number): Promise<DdexDocument> =>
  get(`/ddex/documents/${id}`);

export const getDdexValidationReport = (id: number): Promise<DdexValidationReport> =>
  get(`/ddex/documents/${id}/validation-runs/latest`);

export const listDdexPartners = (): Promise<DdexPartner[]> => get('/ddex/partners');

export const createDdexPartner = (input: {
  partnerName: string;
  partnerDpid: string | null;
  partnerAllowedVersions: string[];
}): Promise<DdexPartner> => post('/ddex/partners', input);

export const DDEX_ERROR_STATUSES = new Set(['invalid', 'import_failed', 'quarantined']);
export const DDEX_PENDING_STATUSES = new Set(['received', 'queued', 'validating', 'mapping_required', 'ready_to_import', 'importing']);
