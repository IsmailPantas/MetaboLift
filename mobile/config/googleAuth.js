export const GOOGLE_WEB_CLIENT_ID = '945525315047-b94d5ojt0i63q0pvivfd97t9q5m057ap.apps.googleusercontent.com';

export const isGoogleClientIdConfigured = () =>
  Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_WEB_CLIENT_ID !== 'YOUR_GOOGLE_WEB_CLIENT_ID');
