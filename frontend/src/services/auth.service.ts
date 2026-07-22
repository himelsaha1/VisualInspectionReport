/**
 * auth.service.ts — Authentication service stub
 *
 * TODO: Replace with MAS IAM / SAML token exchange:
 *   1. Redirect to MAS IAM login at {VITE_MAXIMO_BASE_URL}/idaas/oidc/endpoint/default/authorize
 *   2. Exchange authorization code for Bearer token
 *   3. Store token in sessionStorage and attach to all service calls
 */

import type { User } from '@/types'
import { mockDelay } from './utils'

const MOCK_USER: User = {
  id: 'user-001',
  name: 'Jordan Smith',
  email: 'j.smith@ibm.com',
  role: 'supervisor',
}

export async function getCurrentUser(): Promise<User> {
  // STUB: return hardcoded user — replace with real IAM token validation
  await mockDelay(100)
  return MOCK_USER
}

export function isAuthenticated(): boolean {
  // STUB: always true in stub mode
  // TODO: check for valid unexpired IAM token in sessionStorage
  return true
}
