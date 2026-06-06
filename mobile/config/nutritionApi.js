import { USDA_API_KEY } from './secrets';

export { USDA_API_KEY };

export const isUsdaApiKeyConfigured = () =>
  Boolean(USDA_API_KEY && USDA_API_KEY !== 'YOUR_USDA_API_KEY');
