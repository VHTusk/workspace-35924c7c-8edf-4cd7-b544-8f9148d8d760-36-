/**
 * KYC Document OCR Integration for VALORHIVE
 * 
 * DISABLED FOR STANDARD REGISTRATION (v3.78.0)
 * 
 * OCR is now only activated for:
 * - Withdrawals above a monetary threshold
 * - Manual admin verification requests
 * 
 * Reason: Bypass for standard registration to reduce friction.
 * Activate later for withdrawals over a specific monetary threshold.
 * 
 * Features:
 * - Primary: HyperVerge API (Indian ID specialist)
 * - Fallback: AWS Textract (generic OCR)
 * - Privacy: Never store full Aadhaar number (only last 4 digits)
 */

import { SportType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export type DocumentType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE';

export interface KYCExtractionResult {
  documentType: DocumentType;
  name?: string;
  documentNumber?: string;  // Aadhaar: last 4 digits only
  dateOfBirth?: string;
  confidence: number;       // 0-1, auto-approve if > 0.92
  requiresManualReview: boolean;
  rawExtractedData?: Record<string, unknown>;
  error?: string;
  bypassed?: boolean;       // Flag indicating OCR was skipped
}

// ============================================
// CONFIGURATION
// ============================================

// Feature flag for OCR activation
export const KYC_OCR_CONFIG = {
  // Enable/disable OCR globally - FEATURE FLAG CONTROLLED
  // Use isFeatureEnabled(FEATURE_FLAGS.KYC_OCR) for runtime check
  enabled: false, // Hardcoded to false - override via database feature flag
  
  // Minimum withdrawal amount (in paise) to trigger OCR verification
  // Default: ₹10,000 (1000000 paise)
  withdrawalThreshold: parseInt(process.env.KYC_OCR_WITHDRAWAL_THRESHOLD || '1000000'),
  
  // Auto-approval threshold
  autoApproveThreshold: parseFloat(process.env.KYC_AUTO_APPROVE_THRESHOLD || '0.92'),
  
  // Bypass message
  bypassReason: 'KYC OCR bypassed for standard registration (Feature disabled v3.78.0)',
};

// ============================================
// MAIN EXPORT - WITH BYPASS LOGIC
// ============================================

/**
 * Check if OCR should be triggered based on context
 * 
 * @param context - 'registration' | 'withdrawal' | 'manual'
 * @param amount - Amount in paise (for withdrawal context)
 */
export function shouldTriggerOCR(
  context: 'registration' | 'withdrawal' | 'manual',
  amount?: number
): boolean {
  // OCR is globally disabled
  if (!KYC_OCR_CONFIG.enabled) {
    return false;
  }
  
  // Never trigger for standard registration
  if (context === 'registration') {
    return false;
  }
  
  // For withdrawals, check threshold
  if (context === 'withdrawal') {
    return (amount || 0) >= KYC_OCR_CONFIG.withdrawalThreshold;
  }
  
  // Manual admin requests always trigger OCR
  if (context === 'manual') {
    return true;
  }
  
  return false;
}

/**
 * Extract KYC document data using OCR
 * 
 * NOW WITH BYPASS: Skips OCR for standard registration
 * 
 * @param documentUrl - URL of the document image
 * @param sport - Sport context (for audit/logging)
 * @param context - 'registration' | 'withdrawal' | 'manual'
 * @param amount - Amount in paise (for withdrawal context)
 */
export async function extractKYCDocument(
  documentUrl: string,
  sport: SportType,
  context: 'registration' | 'withdrawal' | 'manual' = 'registration',
  amount?: number
): Promise<KYCExtractionResult> {
  console.log(`[KYC-OCR] Processing request for ${sport}`, { 
    context, 
    amount, 
    threshold: KYC_OCR_CONFIG.withdrawalThreshold,
  });

  // Check if OCR should be triggered
  if (!shouldTriggerOCR(context, amount)) {
    console.log(`[KYC-OCR] Bypassing OCR for context: ${context}`);
    return {
      documentType: 'AADHAAR',
      confidence: 0,
      requiresManualReview: true,
      error: KYC_OCR_CONFIG.bypassReason,
      bypassed: true,
    };
  }

  // Validate URL
  if (!documentUrl || !documentUrl.startsWith('http')) {
    return {
      documentType: 'AADHAAR',
      confidence: 0,
      requiresManualReview: true,
      error: 'Invalid document URL',
    };
  }

  // Try HyperVerge first (optimized for Indian IDs)
  const result = await extractWithHyperVerge(documentUrl);

  console.log(`[KYC-OCR] Extraction result:`, {
    documentType: result.documentType,
    hasName: !!result.name,
    hasDocumentNumber: !!result.documentNumber,
    confidence: result.confidence,
    requiresManualReview: result.requiresManualReview,
    error: result.error,
  });

  return result;
}

// ============================================
// HYPERVERGE API (Only called when enabled)
// ============================================

const HYPERVERGE_ENDPOINT = 'https://ind-docs.hyperverge.co/v2/readID';

async function extractWithHyperVerge(documentUrl: string): Promise<KYCExtractionResult> {
  const appId = process.env.HYPERVERGE_APP_ID;
  const appKey = process.env.HYPERVERGE_APP_KEY;

  if (!appId || !appKey) {
    console.warn('[KYC-OCR] HyperVerge credentials not configured, falling back to Textract');
    return extractWithTextract(documentUrl);
  }

  try {
    const response = await fetch(HYPERVERGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'appid': appId,
        'apikey': appKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [documentUrl],
        enablePlugins: ['face', 'ocv'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KYC-OCR] HyperVerge API error:', response.status, errorText);
      return extractWithTextract(documentUrl);
    }

    const data = await response.json();

    if (data.status !== 'success' || data.statusCode !== 200) {
      console.error('[KYC-OCR] HyperVerge returned error:', data.error);
      return extractWithTextract(documentUrl);
    }

    const details = data.result?.details;
    if (!details) {
      return {
        documentType: 'AADHAAR',
        confidence: 0,
        requiresManualReview: true,
        error: 'No data extracted from document',
      };
    }

    // Determine document type based on extracted fields
    let documentType: DocumentType = 'AADHAAR';
    let documentNumber: string | undefined;
    
    if (details.aadhaar_number) {
      documentType = 'AADHAAR';
      const fullNumber = details.aadhaar_number.replace(/\s/g, '');
      documentNumber = fullNumber.slice(-4);
    } else if (details.pan_number) {
      documentType = 'PAN';
      documentNumber = details.pan_number;
    } else if (details.passport_number) {
      documentType = 'PASSPORT';
      documentNumber = details.passport_number;
    } else if (details.dl_number) {
      documentType = 'DRIVING_LICENSE';
      documentNumber = details.dl_number;
    }

    const name = details.name;
    const dateOfBirth = details.dob || details.date_of_birth;
    const confidence = details.confidence || 0;

    const requiresManualReview = !(
      confidence > KYC_OCR_CONFIG.autoApproveThreshold &&
      name &&
      documentNumber
    );

    return {
      documentType,
      name,
      documentNumber,
      dateOfBirth,
      confidence,
      requiresManualReview,
      rawExtractedData: details as Record<string, unknown>,
    };
  } catch (error) {
    console.error('[KYC-OCR] HyperVerge request failed:', error);
    return extractWithTextract(documentUrl);
  }
}

// ============================================
// AWS TEXTRACT (Fallback)
// ============================================

async function extractWithTextract(documentUrl: string): Promise<KYCExtractionResult> {
  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'ap-south-1';

  if (!awsAccessKey || !awsSecretKey) {
    console.warn('[KYC-OCR] AWS credentials not configured');
    return {
      documentType: 'AADHAAR',
      confidence: 0,
      requiresManualReview: true,
      error: 'OCR service not configured',
    };
  }

  try {
    const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');

    const client = new TextractClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
      },
    });

    const docResponse = await fetch(documentUrl);
    if (!docResponse.ok) {
      throw new Error('Failed to fetch document');
    }
    
    const documentBytes = await docResponse.arrayBuffer();

    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: new Uint8Array(documentBytes),
      },
    });

    const response = await client.send(command);

    if (!response.Blocks || response.Blocks.length === 0) {
      return {
        documentType: 'AADHAAR',
        confidence: 0,
        requiresManualReview: true,
        error: 'No text detected in document',
      };
    }

    const textBlocks = response.Blocks
      .filter(block => block.BlockType === 'WORD' && block.Text && block.Confidence)
      .map(block => ({
        text: block.Text!,
        confidence: block.Confidence! / 100,
      }));

    const avgConfidence = textBlocks.length > 0
      ? textBlocks.reduce((sum, b) => sum + b.confidence, 0) / textBlocks.length
      : 0;

    const fullText = textBlocks.map(b => b.text).join(' ');
    const extractedData = parseGenericDocument(fullText);

    const requiresManualReview = !(
      avgConfidence > KYC_OCR_CONFIG.autoApproveThreshold &&
      extractedData.name &&
      extractedData.documentNumber
    );

    return {
      documentType: extractedData.documentType,
      name: extractedData.name,
      documentNumber: extractedData.documentNumber,
      dateOfBirth: extractedData.dateOfBirth,
      confidence: avgConfidence,
      requiresManualReview,
      rawExtractedData: { fullText, textBlocks: textBlocks.slice(0, 50) },
    };
  } catch (error) {
    console.error('[KYC-OCR] Textract request failed:', error);
    return {
      documentType: 'AADHAAR',
      confidence: 0,
      requiresManualReview: true,
      error: error instanceof Error ? error.message : 'OCR processing failed',
    };
  }
}

// ============================================
// DOCUMENT PARSING UTILITIES
// ============================================

function parseGenericDocument(text: string): {
  documentType: DocumentType;
  name?: string;
  documentNumber?: string;
  dateOfBirth?: string;
} {
  const upperText = text.toUpperCase();
  
  let documentType: DocumentType = 'AADHAAR';
  
  if (upperText.includes('AADHAAR') || upperText.includes('AADHAR') || upperText.includes('आधार')) {
    documentType = 'AADHAAR';
  } else if (upperText.includes('PAN') || upperText.includes('INCOME TAX')) {
    documentType = 'PAN';
  } else if (upperText.includes('PASSPORT') || upperText.includes('REPUBLIC OF INDIA')) {
    documentType = 'PASSPORT';
  } else if (upperText.includes('DRIVING LICENCE') || upperText.includes('DRIVER LICENCE') || upperText.includes('DL NO')) {
    documentType = 'DRIVING_LICENSE';
  }

  let documentNumber: string | undefined;
  
  switch (documentType) {
    case 'AADHAAR': {
      const aadhaarMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}|\d{12}/);
      if (aadhaarMatch) {
        const cleanNumber = aadhaarMatch[0].replace(/\s/g, '');
        documentNumber = cleanNumber.slice(-4);
      }
      break;
    }
    case 'PAN': {
      const panMatch = text.match(/[A-Z]{5}\d{4}[A-Z]/);
      if (panMatch) {
        documentNumber = panMatch[0];
      }
      break;
    }
    case 'PASSPORT': {
      const passportMatch = text.match(/[A-Z]\d{7}/);
      if (passportMatch) {
        documentNumber = passportMatch[0];
      }
      break;
    }
    case 'DRIVING_LICENSE': {
      const dlMatch = text.match(/[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7,}/);
      if (dlMatch) {
        documentNumber = dlMatch[0].replace(/[-\s]/g, '');
      }
      break;
    }
  }

  let name: string | undefined;
  
  const nameMatch = text.match(/(?:NAME|नाम)[:\s]+([A-Za-z\s]{2,50})/i);
  if (nameMatch) {
    name = nameMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    const capWordsMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
    if (capWordsMatch) {
      name = capWordsMatch[1];
    }
  }

  let dateOfBirth: string | undefined;
  
  const dobPatterns = [
    /(?:DOB|DATE OF BIRTH|जन्म तिथि)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
  ];

  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) {
      dateOfBirth = match[1];
      break;
    }
  }

  return {
    documentType,
    name,
    documentNumber,
    dateOfBirth,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate if a document number matches expected format for its type
 */
export function validateDocumentNumber(documentType: DocumentType, number: string): boolean {
  switch (documentType) {
    case 'AADHAAR':
      return /^\d{4}$/.test(number);
    case 'PAN':
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(number);
    case 'PASSPORT':
      return /^[A-Z]\d{7}$/.test(number);
    case 'DRIVING_LICENSE':
      return /^[A-Z0-9]{8,20}$/.test(number);
    default:
      return false;
  }
}

/**
 * Mask document number for display (privacy protection)
 */
export function maskDocumentNumber(documentType: DocumentType, number: string): string {
  if (!number) return '****';
  
  switch (documentType) {
    case 'AADHAAR':
      return `XXXX-XXXX-${number}`;
    case 'PAN':
      return number.slice(0, 4) + 'XXX' + number.slice(-2);
    case 'PASSPORT':
      return number[0] + 'XXXXXXX';
    case 'DRIVING_LICENSE':
      if (number.length > 4) {
        return number.slice(0, 2) + 'X'.repeat(number.length - 4) + number.slice(-2);
      }
      return '****';
    default:
      return '****';
  }
}
