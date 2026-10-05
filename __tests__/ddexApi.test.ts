const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../src/api/client', () => ({ get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) }));
import { createDdexPartner, getDdexReferences, listDdexDocuments } from '../src/api/ddex';

describe('DDEX canonical Mobile contract', () => {
  beforeEach(() => jest.clearAllMocks());
  it('uses the governed workflow ID, not the obsolete status query', async () => {
    await listDdexDocuments('40000000-0000-4000-8000-000000000001');
    expect(mockGet).toHaveBeenCalledWith('/ddex/documents?workflowStateId=40000000-0000-4000-8000-000000000001');
    await listDdexDocuments();
    expect(mockGet).toHaveBeenLastCalledWith('/ddex/documents');
  });
  it('loads selectable versions from current governed references', async () => {
    await getDdexReferences();
    expect(mockGet).toHaveBeenCalledWith('/ddex/references');
  });
  it('sends only canonical standard-version relationship fields', async () => {
    const payload = { partnerName: 'Synthetic', partnerDpid: null, partnerAllowedStandardVersionIds: ['40000000-0000-4000-8000-000000000001'] };
    await createDdexPartner(payload);
    expect(mockPost).toHaveBeenCalledWith('/ddex/partners', payload);
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('partnerAllowedVersions');
  });
});
