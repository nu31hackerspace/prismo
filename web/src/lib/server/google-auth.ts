/**
 * Dependency-injected Google OAuth2 client for testing.
 * 
 * In production/dev, this exports the genuine OAuth2Client from google-auth-library.
 * In TEST_MODE (e.g., during Playwright E2E tests), it returns a mock client that
 * simulates Google's API behaviors, completely eliminating the need for real keys,
 * while allowing our actual route handlers to process the authentication flow normally.
 */
import { OAuth2Client as RealOAuth2Client } from 'google-auth-library';
import { env } from '$env/dynamic/private';

class MockOAuth2Client {
    // Mimics the instantiation parameters
    constructor(clientId?: string, clientSecret?: string, redirectUri?: string) {}

    // Instantly bypasses the Google login popup, redirecting back to our local callback with a fake code
    generateAuthUrl() {
        return `/google/callback?code=playwright-mock-auth-code`;
    }

    // Mocks the code exchange mechanism
    async getToken(code: string) {
        if (code !== 'playwright-mock-auth-code') {
            throw new Error('MockClient: Invalid auth code provided');
        }
        return { tokens: { id_token: 'playwright-mock-id-token' } };
    }

    // Emulates the cryptographically verified JWT payload response
    async verifyIdToken(options: { idToken: string; audience?: string | string[] }) {
        if (options.idToken !== 'playwright-mock-id-token') {
            throw new Error('MockClient: Invalid ID token provided');
        }
        return {
            getPayload: () => ({
                sub: 'playwright-test-user',
                email: 'playwright@nu31.space',
                name: 'Playwright UI Tester'
            })
        };
    }
}

export const OAuth2Client = process.env.TEST_MODE 
    ? (MockOAuth2Client as unknown as typeof RealOAuth2Client)
    : RealOAuth2Client;
