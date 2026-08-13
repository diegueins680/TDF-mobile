import type { components } from './generated/types';
import { http, normalizeApiError } from './client';

export type CatalogBatch = components['schemas']['CatalogBatch'];
export type CatalogDefinition = components['schemas']['CatalogDefinition'];
export type CatalogPage = components['schemas']['CatalogPage'];
export type CatalogItem = components['schemas']['CatalogItem'];
export type CatalogDefault = components['schemas']['CatalogDefault'];
export type WorkflowState = components['schemas']['WorkflowState'];
export type WorkflowStates = components['schemas']['WorkflowStates'];
export type CatalogDraft = components['schemas']['CatalogDraft'];
export type CatalogRevision = components['schemas']['CatalogRevision'];
export type CatalogReview = components['schemas']['CatalogReview'];
export type RadioAutoStopOptions = components['schemas']['RadioAutoStopOptions'];

export interface CatalogPageQuery {
  locale?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export interface CatalogBatchResult {
  batch: CatalogBatch | null;
  etag: string | null;
  notModified: boolean;
}

export interface WorkflowStatesResult {
  workflow: WorkflowStates | null;
  etag: string | null;
  notModified: boolean;
}

export async function fetchCatalogBatch(
  codes: readonly string[],
  locale: string,
  etag?: string | null,
): Promise<CatalogBatchResult> {
  const uniqueCodes = Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
  if (uniqueCodes.length === 0) throw new Error('Se requiere al menos un catálogo.');

  const params = new URLSearchParams();
  uniqueCodes.forEach((code) => params.append('code', code));
  params.set('locale', locale.trim() || 'es');
  params.set('page', '1');
  params.set('pageSize', '500');

  try {
    const response = await http.get<CatalogBatch>(`/catalogs/batch?${params.toString()}`, {
      headers: etag ? { 'If-None-Match': etag } : undefined,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });
    const responseEtag = typeof response.headers.etag === 'string' ? response.headers.etag : null;
    if (response.status === 304) {
      return { batch: null, etag: responseEtag ?? etag ?? null, notModified: true };
    }
    return { batch: response.data, etag: responseEtag, notModified: false };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function fetchPublicWorkflowStates(
  workflowCode: string,
  locale: string,
  etag?: string | null,
): Promise<WorkflowStatesResult> {
  const normalizedCode = workflowCode.trim();
  if (!normalizedCode) throw new Error('Se requiere el código del flujo de trabajo.');
  const params = new URLSearchParams({ locale: locale.trim() || 'es' });
  try {
    const response = await http.get<WorkflowStates>(
      `/catalogs/workflows/${encodeURIComponent(normalizedCode)}/states?${params.toString()}`,
      {
        headers: etag ? { 'If-None-Match': etag } : undefined,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      },
    );
    const responseEtag = typeof response.headers.etag === 'string' ? response.headers.etag : null;
    if (response.status === 304) {
      return { workflow: null, etag: responseEtag ?? etag ?? null, notModified: true };
    }
    return { workflow: response.data, etag: responseEtag, notModified: false };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

const appendOptional = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) => {
  if (value !== undefined) params.set(key, String(value));
};

const querySuffix = (params: URLSearchParams) => {
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

const catalogPath = (catalogCode: string) => `/catalog/${encodeURIComponent(catalogCode)}`;

const requestData = async <T>(request: Promise<{ data: T }>): Promise<T> => {
  try {
    return (await request).data;
  } catch (error) {
    throw normalizeApiError(error);
  }
};

export const Catalogs = {
  listDefinitions: (locale?: string) => {
    const params = new URLSearchParams();
    appendOptional(params, 'locale', locale);
    return requestData(http.get<CatalogDefinition[]>(`/catalog/definitions${querySuffix(params)}`));
  },

  listItems: (catalogCode: string, query: CatalogPageQuery = {}) => {
    const params = new URLSearchParams();
    appendOptional(params, 'locale', query.locale);
    appendOptional(params, 'q', query.q);
    appendOptional(params, 'page', query.page);
    appendOptional(params, 'pageSize', query.pageSize);
    appendOptional(params, 'includeInactive', query.includeInactive);
    return requestData(http.get<CatalogPage>(`${catalogPath(catalogCode)}/items${querySuffix(params)}`));
  },

  listRevisions: (catalogCode: string, page = 1, pageSize = 50) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return requestData(http.get<CatalogRevision[]>(`${catalogPath(catalogCode)}/revisions?${params}`));
  },

  createRevision: (catalogCode: string, draft: CatalogDraft) =>
    requestData(http.post<CatalogRevision>(`${catalogPath(catalogCode)}/revisions`, draft)),

  submitRevision: (revisionId: string) =>
    requestData(http.post<CatalogRevision>(`/catalog/revisions/${encodeURIComponent(revisionId)}/submit`)),

  approveRevision: (revisionId: string, review: CatalogReview) =>
    requestData(http.post<CatalogRevision>(`/catalog/revisions/${encodeURIComponent(revisionId)}/approve`, review)),

  rejectRevision: (revisionId: string, review: CatalogReview) =>
    requestData(http.post<CatalogRevision>(`/catalog/revisions/${encodeURIComponent(revisionId)}/reject`, review)),

  listRadioAutoStopOptions: (locale?: string) => {
    const params = new URLSearchParams();
    appendOptional(params, 'locale', locale);
    return requestData(http.get<RadioAutoStopOptions>(`/radio/auto-stop-options${querySuffix(params)}`));
  },
};
