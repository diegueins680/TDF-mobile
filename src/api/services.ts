import { get } from './client';
import type { components } from './generated/types';

export type ServiceDefaultResourceDTO = components['schemas']['ServiceDefaultResource'];
export type ServiceOfferingDTO = components['schemas']['ServiceOffering'];
export type ServiceCatalogEnvelopeDTO = components['schemas']['ServiceCatalogEnvelope'];

export const getPublicServiceOfferingCatalog = (locale = 'es'): Promise<ServiceCatalogEnvelopeDTO> =>
  get<ServiceCatalogEnvelopeDTO>(`/services/catalog/public?locale=${encodeURIComponent(locale)}`);
