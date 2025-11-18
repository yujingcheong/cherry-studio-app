import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit'

import type { CopilotAuthState, CopilotDeviceCodeResponse, CopilotTokenResponse } from '@/types/copilotAuth'

const initialState: CopilotAuthState = {
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

const copilotAuthSlice = createSlice({
  name: 'copilotAuth',
  initialState,
  reducers: {
    startAuthentication: state => {
      state.isAuthenticating = true
      state.error = null
    },
    setDeviceCode: (state, action: PayloadAction<CopilotDeviceCodeResponse>) => {
      state.deviceCode = action.payload.device_code
      state.userCode = action.payload.user_code
      state.verificationUri = action.payload.verification_uri
    },
    setTokens: (state, action: PayloadAction<CopilotTokenResponse>) => {
      state.isAuthenticated = true
      state.isAuthenticating = false
      state.accessToken = action.payload.access_token
      state.refreshToken = action.payload.refresh_token || null
      state.expiresAt = Date.now() + action.payload.expires_in * 1000
      state.deviceCode = null
      state.userCode = null
      state.verificationUri = null
      state.error = null
    },
    refreshTokenSuccess: (state, action: PayloadAction<{ accessToken: string; expiresIn: number }>) => {
      state.accessToken = action.payload.accessToken
      state.expiresAt = Date.now() + action.payload.expiresIn * 1000
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.isAuthenticating = false
      state.error = action.payload
    },
    clearAuth: state => {
      state.isAuthenticated = false
      state.isAuthenticating = false
      state.accessToken = null
      state.refreshToken = null
      state.expiresAt = null
      state.deviceCode = null
      state.userCode = null
      state.verificationUri = null
      state.error = null
    },
    clearError: state => {
      state.error = null
    }
  }
})

export const {
  startAuthentication,
  setDeviceCode,
  setTokens,
  refreshTokenSuccess,
  setAuthError,
  clearAuth,
  clearError
} = copilotAuthSlice.actions

export default copilotAuthSlice.reducer
