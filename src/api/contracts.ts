import { API_BASE } from '../lib/api';

export type ContractPayload = Record<string, unknown>;
export type ContractResponse = Record<string, unknown>;
type FetchOptions = Parameters<typeof fetch>[1];

const contractUrl = (path: string) => `${API_BASE}${path}`;

async function requestJson<T>(url: string, init?: FetchOptions): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Contract request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function createContract(payload: ContractPayload): Promise<ContractResponse> {
  return requestJson<ContractResponse>(contractUrl('/contracts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function generatePDF(id: string): Promise<Blob> {
  const response = await fetch(contractUrl(`/contracts/${encodeURIComponent(id)}/pdf`));
  if (!response.ok) {
    throw new Error(`Contract PDF request failed (${response.status})`);
  }
  return response.blob();
}

export async function sendContract(id: string, email: string): Promise<ContractResponse> {
  return requestJson<ContractResponse>(contractUrl(`/contracts/${encodeURIComponent(id)}/send`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
}
