import { OAuth2Client as RealOAuth2Client } from 'google-auth-library';

class MockOAuth2Client {
  constructor(_clientId?: string, _clientSecret?: string, _redirectUri?: string) {}

  generateAuthUrl() {
    return `/google/callback?code=playwright-mock-auth-code`;
  }

  async getToken(code: string) {
    if (code !== 'playwright-mock-auth-code')
      throw new Error('MockClient: Invalid auth code provided');
    return { tokens: { id_token: 'playwright-mock-id-token' } };
  }

  async verifyIdToken(options: {
    idToken: string;
    audience?: string | string[];
  }) {
    if (options.idToken !== 'playwright-mock-id-token')
      throw new Error('MockClient: Invalid ID token provided');
    return {
      getPayload: () => ({
        sub: 'playwright-test-user',
        email: 'playwright@nu31.space',
        name: 'Playwright UI Tester',
      }),
    };
  }
}

export const OAuth2Client = process.env.TEST_MODE
  ? (MockOAuth2Client as unknown as typeof RealOAuth2Client)
  : RealOAuth2Client;
