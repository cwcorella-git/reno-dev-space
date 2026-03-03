'use client'

import { getFunctions, httpsCallable } from 'firebase/functions'
import { getApp } from 'firebase/app'

export interface SendResult {
  success: boolean
  emailsSent: number
  error?: string
}

export interface CampaignUpdateData {
  milestoneTitle: string
  milestoneMessage: string
  newBackers?: number
  dailyAverage?: number
}

export interface CampaignStats {
  totalRaised: number
  goalAmount: number
  percent: number
  needed: number
  backerCount: number
  daysLeft: number
  pledges: Array<{
    pledgeId: string
    userId: string
    email: string
    displayName: string
    amount: number
  }>
}

/**
 * Get Firebase Functions instance
 */
function getCloudFunctions() {
  const app = getApp()
  return getFunctions(app)
}

/**
 * Send campaign success emails to all backers
 * Only works when funding goal has been reached
 */
export async function sendCampaignSuccessEmails(): Promise<SendResult> {
  try {
    const functions = getCloudFunctions()
    const callable = httpsCallable<void, { success: boolean; emailsSent: number }>(
      functions,
      'sendCampaignSuccessEmails'
    )
    const result = await callable()
    return {
      success: result.data.success,
      emailsSent: result.data.emailsSent
    }
  } catch (error) {
    console.error('[emailFunctions] sendCampaignSuccessEmails error:', error)
    return {
      success: false,
      emailsSent: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send campaign ended emails to all backers
 * Used when campaign expires without reaching goal
 */
export async function sendCampaignEndedEmails(): Promise<SendResult> {
  try {
    const functions = getCloudFunctions()
    const callable = httpsCallable<void, { success: boolean; emailsSent: number }>(
      functions,
      'sendCampaignEndedEmails'
    )
    const result = await callable()
    return {
      success: result.data.success,
      emailsSent: result.data.emailsSent
    }
  } catch (error) {
    console.error('[emailFunctions] sendCampaignEndedEmails error:', error)
    return {
      success: false,
      emailsSent: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send campaign update/milestone email to all backers
 */
export async function sendCampaignUpdate(data: CampaignUpdateData): Promise<SendResult> {
  try {
    const functions = getCloudFunctions()
    const callable = httpsCallable<CampaignUpdateData, { success: boolean; emailsSent: number }>(
      functions,
      'sendCampaignUpdate'
    )
    const result = await callable(data)
    return {
      success: result.data.success,
      emailsSent: result.data.emailsSent
    }
  } catch (error) {
    console.error('[emailFunctions] sendCampaignUpdate error:', error)
    return {
      success: false,
      emailsSent: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send test email to the current admin user
 */
export async function sendTestEmail(template: string, email?: string): Promise<SendResult> {
  try {
    const functions = getCloudFunctions()
    const callable = httpsCallable<
      { template: string; email?: string },
      { success: boolean; recipient: string }
    >(functions, 'sendTestEmail')
    const result = await callable({ template, email })
    return {
      success: result.data.success,
      emailsSent: 1
    }
  } catch (error) {
    console.error('[emailFunctions] sendTestEmail error:', error)
    return {
      success: false,
      emailsSent: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
