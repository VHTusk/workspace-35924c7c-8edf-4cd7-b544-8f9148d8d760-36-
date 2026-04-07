/**
 * VALORHIVE SMS Service
 * 
 * Supports multiple providers:
 * - MSG91 (primary for India) - Flow/template-based OTP sending
 * - Twilio (fallback) - Standard SMS with basic auth
 * - Console (development mode) - Logs OTP to console
 * 
 * Phone number handling:
 * - Accepts Indian phone numbers (10 digits or with +91)
 * - Normalizes to E.164 format for API calls
 */

// ============================================
// Types and Interfaces
// ============================================

export type SMSProvider = 'msg91' | 'twilio' | 'console';

export interface SMSConfig {
  provider: SMSProvider;
  // MSG91 config
  msg91AuthKey?: string;
  msg91TemplateId?: string;
  msg91SenderId?: string;
  // Twilio config
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export interface SendSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: SMSProvider;
  otp?: string;
}

export interface SendOTPResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: SMSProvider;
  otp?: string; // Only in development mode
}

// ============================================
// Configuration
// ============================================

/**
 * Get SMS configuration from environment variables
 */
export function getSMSConfig(): SMSConfig {
  const provider = (process.env.SMS_PROVIDER as SMSProvider) || 'console';
  
  return {
    provider,
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
    msg91SenderId: process.env.MSG91_SENDER_ID || 'VLRHVE',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  };
}

// ============================================
// Phone Number Utilities
// ============================================

/**
 * Normalize Indian phone number to E.164 format
 * Accepts: 9876543210, +919876543210, 919876543210
 * Returns: +919876543210
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle Indian numbers
  if (digits.length === 10) {
    // 10-digit Indian number, add +91
    return `+91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already has country code, add +
    return `+${digits}`;
  } else if (digits.length === 13 && digits.startsWith('91')) {
    // Has extra digit, take last 12
    return `+${digits.slice(-12)}`;
  }
  
  // If it starts with +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: assume it's an international number, add +
  return `+${digits}`;
}

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Indian numbers: +91 followed by 10 digits starting with 6-9
  return /^\+91[6-9]\d{9}$/.test(normalized);
}

/**
 * Check if phone number is valid (international support)
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // E.164 format: + followed by 1-15 digits
  return /^\+\d{1,15}$/.test(normalized);
}

// ============================================
// MSG91 SMS Provider
// ============================================

/**
 * Send SMS via MSG91 Flow API
 * MSG91 uses flow/template-based messaging for OTP
 */
async function sendWithMSG91(
  phone: string,
  message: string,
  config: SMSConfig,
  otp?: string
): Promise<SendSMSResponse> {
  const { msg91AuthKey, msg91TemplateId, msg91SenderId } = config;
  
  if (!msg91AuthKey) {
    console.warn('[SMS] MSG91 auth key not configured');
    return { success: false, error: 'MSG91 not configured', provider: 'msg91' };
  }
  
  const normalizedPhone = normalizePhoneNumber(phone);
  // Remove + for MSG91 API
  const phoneForApi = normalizedPhone.replace('+', '');
  
  try {
    // If template ID is provided, use flow API for OTP
    if (msg91TemplateId && otp) {
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': msg91AuthKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: msg91TemplateId,
          short_url: '0', // Disable short URL
          recipients: [
            {
              mobiles: phoneForApi,
              otp: otp,
            },
          ],
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.type === 'success') {
        return {
          success: true,
          messageId: data.request_id || `msg91-${Date.now()}`,
          provider: 'msg91',
        };
      }
      
      console.error('[SMS] MSG91 flow error:', data);
      return {
        success: false,
        error: data.message || 'MSG91 flow failed',
        provider: 'msg91',
      };
    }
    
    // Fallback to standard SMS via MSG91
    const response = await fetch('https://control.msg91.com/api/v5/send-sms', {
      method: 'POST',
      headers: {
        'authkey': msg91AuthKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: msg91SenderId || 'VLRHVE',
        route: '4', // Transactional route
        country: '91',
        sms: [
          {
            message: message,
            to: [phoneForApi],
          },
        ],
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.type === 'success') {
      return {
        success: true,
        messageId: data.request_id || `msg91-${Date.now()}`,
        provider: 'msg91',
      };
    }
    
    console.error('[SMS] MSG91 SMS error:', data);
    return {
      success: false,
      error: data.message || 'MSG91 SMS failed',
      provider: 'msg91',
    };
  } catch (error) {
    console.error('[SMS] MSG91 request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'MSG91 request failed',
      provider: 'msg91',
    };
  }
}

// ============================================
// Twilio SMS Provider
// ============================================

/**
 * Send SMS via Twilio API
 */
async function sendWithTwilio(
  phone: string,
  message: string,
  config: SMSConfig
): Promise<SendSMSResponse> {
  const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = config;
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.warn('[SMS] Twilio not fully configured');
    return { success: false, error: 'Twilio not configured', provider: 'twilio' };
  }
  
  const normalizedPhone = normalizePhoneNumber(phone);
  const authString = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
  
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioPhoneNumber,
          To: normalizedPhone,
          Body: message,
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        messageId: data.sid,
        provider: 'twilio',
      };
    }
    
    console.error('[SMS] Twilio error:', data);
    return {
      success: false,
      error: data.message || 'Twilio SMS failed',
      provider: 'twilio',
    };
  } catch (error) {
    console.error('[SMS] Twilio request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Twilio request failed',
      provider: 'twilio',
    };
  }
}

// ============================================
// Console Provider (Development)
// ============================================

/**
 * Log SMS to console (development mode)
 */
async function sendWithConsole(phone: string, message: string, otp?: string): Promise<SendSMSResponse> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  console.log('\n' + '='.repeat(50));
  console.log('[SMS] DEVELOPMENT MODE - SMS would be sent:');
  console.log(`  To: ${normalizedPhone}`);
  console.log(`  Message: ${message}`);
  if (otp) {
    console.log(`  OTP: ${otp}`);
  }
  console.log('='.repeat(50) + '\n');
  
  return {
    success: true,
    messageId: `dev-${Date.now()}`,
    provider: 'console',
    otp: process.env.NODE_ENV === 'development' ? otp : undefined,
  };
}

// ============================================
// SMS Service Class
// ============================================

export class SMSService {
  private config: SMSConfig;
  
  constructor() {
    this.config = getSMSConfig();
  }
  
  /**
   * Send SMS message
   */
  async sendSms(to: string, message: string): Promise<SendSMSResponse> {
    const { provider } = this.config;
    
    // Validate phone number
    if (!isValidPhone(to)) {
      return {
        success: false,
        error: 'Invalid phone number format',
        provider,
      };
    }
    
    // Route to appropriate provider
    switch (provider) {
      case 'msg91':
        return sendWithMSG91(to, message, this.config);
      case 'twilio':
        return sendWithTwilio(to, message, this.config);
      case 'console':
      default:
        return sendWithConsole(to, message);
    }
  }
  
  /**
   * Send OTP via SMS with template support
   * Uses MSG91 flow/template if configured, otherwise sends plain SMS
   */
  async sendOtp(phone: string, otp: string): Promise<SendOTPResponse> {
    const { provider } = this.config;
    
    // Validate phone number
    if (!isValidPhone(phone)) {
      return {
        success: false,
        error: 'Invalid phone number format',
        provider,
      };
    }
    
    // Generate message
    const message = this.generateOTPMessage(otp);
    
    // Route to appropriate provider
    switch (provider) {
      case 'msg91':
        // MSG91 with template/flow for OTP
        return sendWithMSG91(phone, message, this.config, otp);
      case 'twilio':
        return sendWithTwilio(phone, message, this.config);
      case 'console':
      default:
        return sendWithConsole(phone, message, otp);
    }
  }
  
  /**
   * Generate OTP message
   */
  private generateOTPMessage(otp: string): string {
    return `Your VALORHIVE verification code is ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
  }
  
  /**
   * Send SMS with fallback to secondary provider
   */
  async sendWithFallback(to: string, message: string): Promise<SendSMSResponse> {
    const { provider } = this.config;
    
    // Try primary provider
    let result = await this.sendSms(to, message);
    
    // If primary fails and we have a secondary, try it
    if (!result.success && provider === 'msg91') {
      const twilioConfig = getSMSConfig();
      if (twilioConfig.twilioAccountSid && twilioConfig.twilioAuthToken) {
        console.log('[SMS] MSG91 failed, trying Twilio fallback...');
        result = await sendWithTwilio(to, message, twilioConfig);
      }
    }
    
    return result;
  }
  
  /**
   * Send OTP with fallback
   */
  async sendOtpWithFallback(phone: string, otp: string): Promise<SendOTPResponse> {
    const { provider } = this.config;
    
    // Try primary provider
    let result = await this.sendOtp(phone, otp);
    
    // If primary fails and we have a secondary, try it
    if (!result.success && provider === 'msg91') {
      const twilioConfig = getSMSConfig();
      if (twilioConfig.twilioAccountSid && twilioConfig.twilioAuthToken) {
        console.log('[SMS] MSG91 failed, trying Twilio fallback...');
        const twilioResult = await sendWithTwilio(phone, this.generateOTPMessage(otp), twilioConfig);
        result = twilioResult;
      }
    }
    
    return result;
  }
}

// ============================================
// Singleton Export
// ============================================

export const smsService = new SMSService();

// ============================================
// Convenience Functions
// ============================================

/**
 * Send SMS message
 */
export async function sendSms(to: string, message: string): Promise<SendSMSResponse> {
  return smsService.sendSms(to, message);
}

/**
 * Send OTP via SMS
 */
export async function sendOtp(phone: string, otp: string): Promise<SendOTPResponse> {
  return smsService.sendOtp(phone, otp);
}
