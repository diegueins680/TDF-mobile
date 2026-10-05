import { get, post } from './client';
import type { components } from './generated/types';

export type DdexDocument = components['schemas']['DdexDocument'];
export type DdexValidationIssue = components['schemas']['DdexValidationIssue'];
export type DdexValidationReport = components['schemas']['DdexValidationReport'];
export type DdexPartner = components['schemas']['DdexPartner'];
export type DdexReferences = components['schemas']['DdexReferenceSnapshot'];
export type DdexPartnerCreate = components['schemas']['DdexPartnerCreateRequest'];

export const getDdexReferences = (): Promise<DdexReferences> => get('/ddex/references');
export const listDdexDocuments = (workflowStateId?: string): Promise<DdexDocument[]> =>
  get(`/ddex/documents${workflowStateId ? `?workflowStateId=${encodeURIComponent(workflowStateId)}` : ''}`);
export const getDdexDocument = (id: number): Promise<DdexDocument> => get(`/ddex/documents/${id}`);
export const getDdexValidationReport = (id: number): Promise<DdexValidationReport> =>
  get(`/ddex/documents/${id}/validation-runs/latest`);
export const listDdexPartners = (): Promise<DdexPartner[]> => get('/ddex/partners');
export const createDdexPartner = (input: DdexPartnerCreate): Promise<DdexPartner> => post('/ddex/partners', input);

export const DDEX_ERROR_STATUSES = new Set(['invalid', 'import_failed', 'quarantined']);
export const DDEX_PENDING_STATUSES = new Set(['received', 'queued', 'validating', 'mapping_required', 'ready_to_import', 'importing']);
