# Mobile GitHub Copilot Authentication

## Overview

This implementation adds GitHub Copilot authentication support for the mobile React Native app using OAuth 2.0 Device Authorization Flow. This allows mobile users to authenticate with their GitHub account and use Copilot models.

## Architecture

### Components

1. **CopilotAuthService** (`src/services/CopilotAuthService.ts`)
   - Manages the OAuth 2.0 Device Authorization Flow
   - Handles token storage and retrieval using react-native-keychain
   - Implements automatic token refresh before expiration
   - Updates provider authentication status

2. **Redux State** (`src/store/copilotAuth.ts`)
   - Manages authentication state
   - Stores tokens and device code information
   - Persists authentication state across app restarts

3. **UI Components** (`src/screens/settings/providers/CopilotAuthScreen.tsx`)
   - Device code display and copy functionality
   - Browser launch to GitHub authorization page
   - Success/error state display
   - Logout functionality

4. **Provider Integration** (`src/aiCore/provider/providerConfig.ts`)
   - Injects authentication tokens into API calls
   - Handles token refresh automatically
   - Throws error if authentication required but not available

## OAuth 2.0 Device Authorization Flow

The implementation follows the OAuth 2.0 Device Authorization Flow (RFC 8628):

### Step 1: Request Device Code
```
POST https://github.com/login/device/code
{
  "client_id": "Iv1.b507a08c87ecfe98",
  "scope": "user:email read:user"
}
```

Response includes:
- `device_code`: Used for polling
- `user_code`: Displayed to user
- `verification_uri`: GitHub URL to visit
- `interval`: Polling interval in seconds

### Step 2: User Authorization
User opens `verification_uri` in browser, enters `user_code`, and authorizes the application.

### Step 3: Token Polling
App polls GitHub token endpoint every `interval` seconds until:
- Authorization is completed (success)
- User denies access (error)
- Code expires (error)
- Too many requests (slow_down)

### Step 4: Token Storage
On success, tokens are securely stored in device keychain:
- `access_token`: Used for API authentication
- `refresh_token`: Used to get new access tokens
- `expires_at`: Token expiration timestamp

## Security Features

### Secure Token Storage
- Uses `react-native-keychain` for secure storage
- Tokens stored with `ACCESSIBLE.WHEN_UNLOCKED` accessibility
- Keychain service: `cherry-studio-copilot`

### Token Lifecycle Management
- Automatic refresh 5 minutes before expiration
- Refresh token used to obtain new access tokens
- Expired tokens trigger re-authentication

### Error Handling
- Network errors with retry logic
- Authorization denial handling
- Expired code detection
- Rate limiting (slow_down) handling

## Usage

### For Users

1. Navigate to Settings → Providers → GitHub Copilot
2. Tap "Login with GitHub"
3. Copy the displayed user code
4. Tap "Open GitHub" to launch browser
5. Paste the code on GitHub's authorization page
6. Return to app - authentication completes automatically

### For Developers

#### Initialize Auth Service
```typescript
import { copilotAuthService } from '@/services/CopilotAuthService'

// Initialize on app startup (done in AppInitializationService)
await copilotAuthService.initialize()
```

#### Get Valid Token
```typescript
// Automatically refreshes if needed
const token = await copilotAuthService.getValidAccessToken()
```

#### Logout
```typescript
await copilotAuthService.logout()
```

## Configuration

### OAuth Configuration
Located in `src/types/copilotAuth.ts`:

```typescript
export const COPILOT_OAUTH_CONFIG = {
  clientId: 'Iv1.b507a08c87ecfe98', // GitHub Copilot public client ID
  scopes: ['user:email', 'read:user'],
  deviceCodeEndpoint: 'https://github.com/login/device/code',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize'
}
```

## State Management

### Redux State Structure
```typescript
type CopilotAuthState = {
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
```

### Actions
- `startAuthentication()`: Begin auth flow
- `setDeviceCode()`: Store device code response
- `setTokens()`: Store authentication tokens
- `refreshTokenSuccess()`: Update after token refresh
- `setAuthError()`: Set error state
- `clearAuth()`: Clear all auth state
- `clearError()`: Clear error only

## Provider Integration

When using Copilot provider, the system:

1. Checks if user is authenticated
2. Gets valid access token (refreshes if needed)
3. Injects token into API request headers
4. Handles token expiration automatically

If authentication is required but not available:
```typescript
throw new Error('GitHub Copilot authentication required. Please login first.')
```

## Testing

Test coverage includes:
- Token expiration logic
- Keychain operations
- Logout functionality
- Error handling
- State management

Run tests:
```bash
yarn test CopilotAuthService
```

## Troubleshooting

### Authentication Fails
1. Check network connection
2. Verify device code hasn't expired (15 minutes)
3. Ensure correct user code was entered on GitHub
4. Check if GitHub Copilot subscription is active

### Token Refresh Fails
- App will automatically logout user
- User needs to re-authenticate
- Check for network issues

### Keychain Access Issues
- Ensure device is unlocked
- Check app permissions
- Try logging out and back in

## Future Enhancements

Potential improvements:
1. Biometric authentication for keychain access
2. Multiple account support
3. Token revocation on logout
4. Offline mode with cached tokens
5. Background token refresh

## References

- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://www.rfc-editor.org/rfc/rfc8628)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [React Native Keychain](https://github.com/oblador/react-native-keychain)
- [Redux Toolkit](https://redux-toolkit.js.org/)

## Support

For issues or questions:
1. Check GitHub issues: https://github.com/yujingcheong/cherry-studio-app/issues
2. Review error logs in app
3. Verify OAuth configuration
4. Test with different network conditions
