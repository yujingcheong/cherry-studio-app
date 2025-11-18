/**
 * GitHub Copilot Mobile Authentication Types
 */

export type CopilotAuthState = {
  isAuthenticated: boolean
  isAuthenticating: boolean
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  deviceCode: string | null
  userCode: string | null
  verificationUri: string | null
  error: string | null
}

export type CopilotTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export type CopilotDeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export type CopilotTokenRefreshResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: string
}

export type CopilotAuthError = {
  error: string
  error_description?: string
}

/**
 * GitHub OAuth Configuration for Copilot
 */
export const COPILOT_OAUTH_CONFIG = {
  clientId: 'Iv1.b507a08c87ecfe98', // GitHub Copilot public client ID
  scopes: ['user:email', 'read:user'],
  deviceCodeEndpoint: 'https://github.com/login/device/code',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize'
} as const
