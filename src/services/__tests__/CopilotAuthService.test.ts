// Mock modules before imports
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn().mockResolvedValue(true),
  getGenericPassword: jest.fn().mockResolvedValue(null),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'WHEN_UNLOCKED'
  }
}))

jest.mock('../ProviderService', () => ({
  providerService: {
    updateProvider: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('../../store/copilotAuth', () => ({
  startAuthentication: jest.fn(),
  setDeviceCode: jest.fn(),
  setTokens: jest.fn(),
  refreshTokenSuccess: jest.fn(),
  setAuthError: jest.fn(),
  clearAuth: jest.fn(),
  clearError: jest.fn()
}))

jest.mock('../../store', () => ({
  __esModule: true,
  default: {
    dispatch: jest.fn(),
    getState: jest.fn(() => ({
      copilotAuth: {
        isAuthenticated: false,
        isAuthenticating: false,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        deviceCode: null,
        userCode: null,
        verificationUri: null,
        error: null
      }
    }))
  }
}))

// Mock fetch
global.fetch = jest.fn()

import { copilotAuthService } from '../CopilotAuthService'

describe('CopilotAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isTokenExpired', () => {
    it('should return true if expiresAt is null', () => {
      expect(copilotAuthService.isTokenExpired(null)).toBe(true)
    })

    it('should return true if token is expired', () => {
      const pastTime = Date.now() - 1000 // 1 second ago
      expect(copilotAuthService.isTokenExpired(pastTime)).toBe(true)
    })

    it('should return true if token will expire within 5 minutes', () => {
      const fourMinutesFromNow = Date.now() + 4 * 60 * 1000
      expect(copilotAuthService.isTokenExpired(fourMinutesFromNow)).toBe(true)
    })

    it('should return false if token is valid for more than 5 minutes', () => {
      const tenMinutesFromNow = Date.now() + 10 * 60 * 1000
      expect(copilotAuthService.isTokenExpired(tenMinutesFromNow)).toBe(false)
    })
  })

  describe('stopPolling', () => {
    it('should stop polling without errors', () => {
      expect(() => copilotAuthService.stopPolling()).not.toThrow()
    })
  })

  describe('loadTokens', () => {
    it('should return null when no tokens are stored', async () => {
      const Keychain = require('react-native-keychain')
      Keychain.getGenericPassword.mockResolvedValueOnce(false)

      const result = await copilotAuthService.loadTokens()
      expect(result).toBeNull()
    })

    it('should return tokens when they exist', async () => {
      const Keychain = require('react-native-keychain')
      const mockTokens = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000
      }

      Keychain.getGenericPassword.mockResolvedValueOnce({
        username: 'copilot-tokens',
        password: JSON.stringify(mockTokens)
      })

      const result = await copilotAuthService.loadTokens()
      expect(result).toEqual(mockTokens)
    })

    it('should handle errors gracefully', async () => {
      const Keychain = require('react-native-keychain')
      Keychain.getGenericPassword.mockRejectedValueOnce(new Error('Keychain error'))

      const result = await copilotAuthService.loadTokens()
      expect(result).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear tokens and update provider status', async () => {
      const Keychain = require('react-native-keychain')
      const { providerService } = require('../ProviderService')

      await copilotAuthService.logout()

      expect(Keychain.resetGenericPassword).toHaveBeenCalled()
      expect(providerService.updateProvider).toHaveBeenCalledWith('copilot', { isAuthed: false })
    })

    it('should clear state even if keychain fails', async () => {
      const Keychain = require('react-native-keychain')
      Keychain.resetGenericPassword.mockRejectedValueOnce(new Error('Keychain error'))

      await expect(copilotAuthService.logout()).resolves.not.toThrow()
    })
  })
})
