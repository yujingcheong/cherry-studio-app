import * as Keychain from 'react-native-keychain'

import { loggerService } from '@/services/LoggerService'
import store from '@/store'
import { clearAuth, refreshTokenSuccess, setAuthError, setDeviceCode, setTokens, startAuthentication } from '@/store/copilotAuth'
import type {
  CopilotAuthError,
  CopilotDeviceCodeResponse,
  CopilotTokenRefreshResponse,
  CopilotTokenResponse
} from '@/types/copilotAuth';
import {
  COPILOT_OAUTH_CONFIG
} from '@/types/copilotAuth'

const logger = loggerService.withContext('CopilotAuthService')

const KEYCHAIN_SERVICE = 'cherry-studio-copilot'
const TOKEN_KEY = 'copilot-tokens'

/**
 * Mobile GitHub Copilot Authentication Service
 * Implements OAuth 2.0 Device Authorization Flow for mobile clients
 */
class CopilotAuthService {
  private pollingInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Initialize device authorization flow
   * Step 1: Request device code from GitHub
   */
  async startDeviceAuthorization(): Promise<CopilotDeviceCodeResponse> {
    try {
      logger.info('Starting device authorization flow')
      store.dispatch(startAuthentication())

      const response = await fetch(COPILOT_OAUTH_CONFIG.deviceCodeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: COPILOT_OAUTH_CONFIG.clientId,
          scope: COPILOT_OAUTH_CONFIG.scopes.join(' ')
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get device code: ${response.status}`)
      }

      const data: CopilotDeviceCodeResponse = await response.json()
      logger.info('Device code received', { userCode: data.user_code })

      store.dispatch(setDeviceCode(data))
      return data
    } catch (error) {
      logger.error('Failed to start device authorization', error as Error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      store.dispatch(setAuthError(errorMessage))
      throw error
    }
  }

  /**
   * Poll for access token
   * Step 2: Poll GitHub token endpoint until user completes authorization
   */
  async pollForToken(deviceCode: string, interval: number): Promise<void> {
    logger.info('Starting token polling')

    const pollToken = async () => {
      try {
        const response = await fetch(COPILOT_OAUTH_CONFIG.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            client_id: COPILOT_OAUTH_CONFIG.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        })

        const data = (await response.json()) as CopilotTokenResponse | CopilotAuthError

        if ('error' in data) {
          // Handle different error types
          if (data.error === 'authorization_pending') {
            logger.verbose('Authorization pending, continuing to poll')
            return
          } else if (data.error === 'slow_down') {
            logger.warn('Polling too fast, slowing down')
            this.stopPolling()
            // Restart with increased interval
            this.pollingInterval = setInterval(pollToken, (interval + 5) * 1000)
            return
          } else if (data.error === 'expired_token') {
            logger.error('Device code expired')
            this.stopPolling()
            store.dispatch(setAuthError('Authorization code expired. Please try again.'))
            return
          } else if (data.error === 'access_denied') {
            logger.error('User denied authorization')
            this.stopPolling()
            store.dispatch(setAuthError('Authorization denied'))
            return
          } else {
            logger.error('Token polling error', new Error(data.error))
            this.stopPolling()
            store.dispatch(setAuthError(data.error_description || data.error))
            return
          }
        }

        // Success! We got the tokens
        logger.info('Access token received successfully')
        this.stopPolling()
        await this.saveTokens(data)
        store.dispatch(setTokens(data))
      } catch (error) {
        logger.error('Error polling for token', error as Error)
        this.stopPolling()
        const errorMessage = error instanceof Error ? error.message : 'Failed to poll for token'
        store.dispatch(setAuthError(errorMessage))
      }
    }

    // Start polling
    this.pollingInterval = setInterval(pollToken, interval * 1000)
  }

  /**
   * Stop polling for token
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      logger.info('Stopped token polling')
    }
  }

  /**
   * Save tokens securely using Keychain
   */
  private async saveTokens(tokens: CopilotTokenResponse): Promise<void> {
    try {
      await Keychain.setGenericPassword(
        TOKEN_KEY,
        JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000
        }),
        {
          service: KEYCHAIN_SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED
        }
      )
      logger.info('Tokens saved securely')
    } catch (error) {
      logger.error('Failed to save tokens', error as Error)
      throw error
    }
  }

  /**
   * Load tokens from secure storage
   */
  async loadTokens(): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number } | null> {
    try {
      const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE })
      if (credentials && credentials.password) {
        const tokens = JSON.parse(credentials.password)
        logger.info('Tokens loaded from secure storage')
        return tokens
      }
      return null
    } catch (error) {
      logger.error('Failed to load tokens', error as Error)
      return null
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<void> {
    try {
      logger.info('Refreshing access token')

      const response = await fetch(COPILOT_OAUTH_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: COPILOT_OAUTH_CONFIG.clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.status}`)
      }

      const data: CopilotTokenRefreshResponse = await response.json()
      logger.info('Access token refreshed successfully')

      // Save new tokens
      await this.saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: COPILOT_OAUTH_CONFIG.scopes.join(' ')
      })

      store.dispatch(
        refreshTokenSuccess({
          accessToken: data.access_token,
          expiresIn: data.expires_in
        })
      )
    } catch (error) {
      logger.error('Failed to refresh token', error as Error)
      // If refresh fails, clear auth state
      await this.logout()
      throw error
    }
  }

  /**
   * Check if token is expired or will expire soon (within 5 minutes)
   */
  isTokenExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true
    const fiveMinutes = 5 * 60 * 1000
    return Date.now() >= expiresAt - fiveMinutes
  }

  /**
   * Get valid access token (refreshing if necessary)
   */
  async getValidAccessToken(): Promise<string | null> {
    const state = store.getState().copilotAuth

    if (!state.accessToken) {
      // Try to load from storage
      const tokens = await this.loadTokens()
      if (tokens) {
        if (this.isTokenExpired(tokens.expiresAt) && tokens.refreshToken) {
          await this.refreshAccessToken(tokens.refreshToken)
          return store.getState().copilotAuth.accessToken
        }
        return tokens.accessToken
      }
      return null
    }

    // Check if current token needs refresh
    if (this.isTokenExpired(state.expiresAt) && state.refreshToken) {
      await this.refreshAccessToken(state.refreshToken)
      return store.getState().copilotAuth.accessToken
    }

    return state.accessToken
  }

  /**
   * Logout and clear all stored tokens
   */
  async logout(): Promise<void> {
    try {
      logger.info('Logging out')
      this.stopPolling()
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE })
      store.dispatch(clearAuth())
      logger.info('Logout successful')
    } catch (error) {
      logger.error('Failed to logout', error as Error)
      // Still clear state even if keychain fails
      store.dispatch(clearAuth())
    }
  }

  /**
   * Initialize auth state on app startup
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Copilot auth service')
      const tokens = await this.loadTokens()
      if (tokens) {
        // Check if token is still valid
        if (!this.isTokenExpired(tokens.expiresAt)) {
          store.dispatch(
            setTokens({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
              expires_in: Math.floor((tokens.expiresAt - Date.now()) / 1000),
              token_type: 'Bearer',
              scope: COPILOT_OAUTH_CONFIG.scopes.join(' ')
            })
          )
          logger.info('Restored valid auth session')
        } else if (tokens.refreshToken) {
          // Try to refresh
          await this.refreshAccessToken(tokens.refreshToken)
          logger.info('Restored auth session with token refresh')
        } else {
          // Token expired and no refresh token
          await this.logout()
          logger.info('Auth session expired, logged out')
        }
      }
    } catch (error) {
      logger.error('Failed to initialize auth service', error as Error)
    }
  }
}

export const copilotAuthService = new CopilotAuthService()
