/** One bounded isolated demo profile. Evaluation never activates it. */
const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export const demoMode =
  query.get('evaluation') !== '1' && ['full', 'short'].includes(query.get('demo') ?? '')
    ? (query.get('demo') as 'full' | 'short')
    : null;
export const demoSuffix = demoMode ? '.guided.v1' : '';
