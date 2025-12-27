/**
 * EdgeSpark Client Configuration
 * 
 * Sets up the EdgeSpark client for authentication and API calls.
 * This client is used throughout the application for:
 * - User authentication (Google OAuth, email/password)
 * - API requests to the backend with automatic auth token injection
 */

import { createEdgeSpark } from '@edgespark/client';
import '@edgespark/client/styles.css';

// Get backend worker URL from environment
// In Youbase, the backend URL is dynamically provided by the platform
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  'https://staging--0ob3mcrl5tysk4p4qxy5.youbase.cloud';

/**
 * EdgeSpark client instance
 * Use this client for all authentication and API operations
 */
export const client = createEdgeSpark({
  baseUrl: BACKEND_URL,
  fetchCredentials: 'include', // Include cookies for session management
});

/**
 * Helper: Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await client.auth.getSession();
  return !!session.data?.user;
}

/**
 * Helper: Get current user
 */
export async function getCurrentUser() {
  const session = await client.auth.getSession();
  return session.data?.user || null;
}

/**
 * Helper: Sign out current user
 */
export async function signOut() {
  await client.auth.signOut();
}
