import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { Button, Spinner } from 'heroui-native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

import {
  Container,
  Group,
  GroupTitle,
  HeaderBar,
  SafeAreaContainer,
  Text,
  XStack,
  YStack
} from '@/componentsV2'
import { CheckCircle2, Copy, ExternalLink } from '@/componentsV2/icons/LucideIcon'
import { copilotAuthService } from '@/services/CopilotAuthService'
import { loggerService } from '@/services/LoggerService'
import { useAppSelector } from '@/store'

const logger = loggerService.withContext('CopilotAuthScreen')

export default function CopilotAuthScreen() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const authState = useAppSelector(state => state.copilotAuth)

  useEffect(() => {
    // Start device authorization flow when screen mounts
    if (!authState.deviceCode && !authState.isAuthenticated) {
      startAuth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Start polling when device code is received
    if (authState.deviceCode) {
      // Default interval is 5 seconds
      copilotAuthService.pollForToken(authState.deviceCode, 5)
    }

    // Cleanup polling on unmount
    return () => {
      copilotAuthService.stopPolling()
    }
  }, [authState.deviceCode])

  const startAuth = async () => {
    try {
      setIsLoading(true)
      await copilotAuthService.startDeviceAuthorization()
    } catch (error) {
      logger.error('Failed to start authentication', error as Error)
      Alert.alert(
        t('common.error'),
        t('settings.providers.copilot.auth.startError', { defaultValue: 'Failed to start authentication' })
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (authState.userCode) {
      await Clipboard.setStringAsync(authState.userCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleOpenBrowser = async () => {
    if (authState.verificationUri) {
      await WebBrowser.openBrowserAsync(authState.verificationUri)
    }
  }

  const handleRetry = () => {
    copilotAuthService.stopPolling()
    startAuth()
  }

  if (authState.isAuthenticated) {
    return (
      <SafeAreaContainer edges={['top']}>
        <HeaderBar
          title={t('settings.providers.copilot.auth.title', { defaultValue: 'GitHub Copilot Login' })}
          showBackButton
        />
        <Container>
          <YStack gap="$4" paddingTop="$6" alignItems="center">
            <CheckCircle2 size={64} color="$green10" />
            <YStack gap="$2" alignItems="center">
              <Text fontSize="$6" fontWeight="600">
                {t('settings.providers.copilot.auth.success', { defaultValue: 'Successfully Authenticated!' })}
              </Text>
              <Text fontSize="$4" color="$gray11" textAlign="center">
                {t('settings.providers.copilot.auth.successMessage', {
                  defaultValue: 'You can now use GitHub Copilot models'
                })}
              </Text>
            </YStack>
          </YStack>
        </Container>
      </SafeAreaContainer>
    )
  }

  return (
    <SafeAreaContainer edges={['top']}>
      <HeaderBar
        title={t('settings.providers.copilot.auth.title', { defaultValue: 'GitHub Copilot Login' })}
        showBackButton
      />
      <Container>
        <YStack gap="$4" paddingTop="$6">
          <Group>
            <GroupTitle>
              {t('settings.providers.copilot.auth.instructions', {
                defaultValue: 'Device Authorization Flow'
              })}
            </GroupTitle>

            {isLoading || authState.isAuthenticating ? (
              <YStack gap="$4" padding="$4" alignItems="center">
                <Spinner />
                <Text fontSize="$4" color="$gray11">
                  {t('settings.providers.copilot.auth.initializing', {
                    defaultValue: 'Initializing authentication...'
                  })}
                </Text>
              </YStack>
            ) : authState.error ? (
              <YStack gap="$4" padding="$4">
                <Text fontSize="$4" color="$red10">
                  {authState.error}
                </Text>
                <Button onPress={handleRetry}>
                  {t('settings.providers.copilot.auth.retry', { defaultValue: 'Retry' })}
                </Button>
              </YStack>
            ) : authState.userCode ? (
              <YStack gap="$4" padding="$4">
                <YStack gap="$2">
                  <Text fontSize="$4" fontWeight="600">
                    {t('settings.providers.copilot.auth.step1', { defaultValue: 'Step 1: Copy your code' })}
                  </Text>
                  <XStack
                    gap="$2"
                    padding="$3"
                    backgroundColor="$gray3"
                    borderRadius="$4"
                    alignItems="center"
                    justifyContent="space-between">
                    <Text fontSize="$7" fontWeight="700" letterSpacing={2}>
                      {authState.userCode}
                    </Text>
                    <Button size="sm" onPress={handleCopyCode} icon={copiedCode ? CheckCircle2 : Copy}>
                      {copiedCode
                        ? t('common.copied', { defaultValue: 'Copied' })
                        : t('common.copy', { defaultValue: 'Copy' })}
                    </Button>
                  </XStack>
                </YStack>

                <YStack gap="$2">
                  <Text fontSize="$4" fontWeight="600">
                    {t('settings.providers.copilot.auth.step2', {
                      defaultValue: 'Step 2: Open GitHub and paste the code'
                    })}
                  </Text>
                  <Button onPress={handleOpenBrowser} icon={ExternalLink}>
                    {t('settings.providers.copilot.auth.openGitHub', { defaultValue: 'Open GitHub' })}
                  </Button>
                </YStack>

                <YStack gap="$2" paddingTop="$2">
                  <Text fontSize="$3" color="$gray11" textAlign="center">
                    {t('settings.providers.copilot.auth.waiting', {
                      defaultValue: 'Waiting for you to complete authorization in your browser...'
                    })}
                  </Text>
                  <XStack justifyContent="center" paddingTop="$2">
                    <Spinner size="small" />
                  </XStack>
                </YStack>
              </YStack>
            ) : null}
          </Group>

          <Group>
            <YStack padding="$4" gap="$2">
              <Text fontSize="$3" color="$gray11">
                {t('settings.providers.copilot.auth.note', {
                  defaultValue:
                    'Note: You need an active GitHub Copilot subscription to use this feature. The authorization code will expire in 15 minutes.'
                })}
              </Text>
            </YStack>
          </Group>
        </YStack>
      </Container>
    </SafeAreaContainer>
  )
}
