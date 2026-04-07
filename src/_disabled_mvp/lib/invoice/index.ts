/**
 * GST Invoice Generation Service
 * Generates tax invoices for all payments as per Indian GST regulations
 */

import { db } from '@/lib/db';

// Platform GST details (configure in environment)
const PLATFORM_GSTIN = process.env.PLATFORM_GSTIN || '29XXXXX1234X1XX';
const PLATFORM_NAME = 'VALORHIVE';
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS || 'Bangalore, Karnataka, India';

// GST rates (18% for services)
const GST_RATE = parseInt(process.env.GST_RATE || '18');

interface GenerateInvoiceParams {
  paymentLedgerId: string;
  userId?: string | null;
  orgId?: string | null;
  amount: number; // in paise
  description: string;
  invoiceType: string;
  paymentId?: string;
  paymentMethod?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  payerName: string;
  payerEmail?: string;
  payerPhone?: string;
  payerGstin?: string;
  payerAddress?: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Generate a unique invoice number
 * Format: VH-{YYYY}-{MM}-{XXXXX}
 */
async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Get the count of invoices this month
  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);
  
  const count = await db.invoice.count({
    where: {
      invoiceDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });
  
  const sequence = String(count + 1).padStart(5, '0');
  return `VH-${year}-${month}-${sequence}`;
}

/**
 * Calculate GST amounts
 * For intra-state: CGST + SGST (9% + 9%)
 * For inter-state: IGST (18%)
 */
function calculateGST(baseAmount: number, payerState?: string, platformState?: string): {
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
} {
  const gstAmount = Math.round(baseAmount * GST_RATE / 100);
  const totalAmount = baseAmount + gstAmount;
  
  // Check if inter-state transaction
  const isInterState = payerState && platformState && payerState !== platformState;
  
  if (isInterState) {
    // IGST for inter-state
    return {
      gstAmount,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      totalAmount,
    };
  } else {
    // CGST + SGST for intra-state
    const halfGst = Math.round(gstAmount / 2);
    return {
      gstAmount,
      cgst: halfGst,
      sgst: halfGst,
      igst: 0,
      totalAmount,
    };
  }
}

/**
 * Generate a GST invoice for a payment
 */
export async function generateInvoice(params: GenerateInvoiceParams): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}> {
  try {
    // Get payer details
    let payerName = '';
    let payerEmail: string | undefined;
    let payerPhone: string | undefined;
    let payerGstin: string | undefined;
    let payerAddress: string | undefined;
    let payerState: string | undefined;
    
    if (params.userId) {
      const user = await db.user.findUnique({
        where: { id: params.userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          district: true,
        },
      });
      
      if (user) {
        payerName = `${user.firstName} ${user.lastName}`;
        payerEmail = user.email || undefined;
        payerPhone = user.phone || undefined;
        payerState = user.state || undefined;
        payerAddress = [user.city, user.district, user.state].filter(Boolean).join(', ') || undefined;
      }
    } else if (params.orgId) {
      const org = await db.organization.findUnique({
        where: { id: params.orgId },
        select: {
          name: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          district: true,
        },
      });
      
      if (org) {
        payerName = org.name;
        payerEmail = org.email || undefined;
        payerPhone = org.phone || undefined;
        payerState = org.state || undefined;
        payerAddress = [org.city, org.district, org.state].filter(Boolean).join(', ') || undefined;
      }
    }
    
    // Platform state (Karnataka)
    const platformState = 'Karnataka';
    
    // Calculate GST
    const gstCalc = calculateGST(params.amount, payerState, platformState);
    
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    
    // Create invoice
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(),
        userId: params.userId,
        orgId: params.orgId,
        payerName,
        payerEmail,
        payerPhone,
        payerGstin,
        payerAddress,
        platformGstin: PLATFORM_GSTIN,
        platformName: PLATFORM_NAME,
        platformAddress: PLATFORM_ADDRESS,
        description: params.description,
        amount: params.amount,
        gstRate: GST_RATE,
        gstAmount: gstCalc.gstAmount,
        totalAmount: gstCalc.totalAmount,
        cgst: gstCalc.cgst,
        sgst: gstCalc.sgst,
        igst: gstCalc.igst,
        paymentId: params.paymentId,
        paymentMethod: params.paymentMethod,
        paymentStatus: 'PAID',
        invoiceType: params.invoiceType,
        paidAt: new Date(),
      },
    });
    
    // Link invoice to payment ledger
    await db.paymentLedger.update({
      where: { id: params.paymentLedgerId },
      data: { invoiceId: invoice.id },
    });
    
    console.log(`Invoice generated: ${invoiceNumber}`);
    
    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  } catch (error) {
    console.error('Invoice generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string) {
  return db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
    },
  });
}

/**
 * Get invoice by number
 */
export async function getInvoiceByNumber(invoiceNumber: string) {
  return db.invoice.findUnique({
    where: { invoiceNumber },
  });
}

/**
 * Get all invoices for a user
 */
export async function getUserInvoices(userId: string, limit = 10) {
  return db.invoice.findMany({
    where: { userId },
    orderBy: { invoiceDate: 'desc' },
    take: limit,
  });
}

/**
 * Get all invoices for an organization
 */
export async function getOrgInvoices(orgId: string, limit = 10) {
  return db.invoice.findMany({
    where: { orgId },
    orderBy: { invoiceDate: 'desc' },
    take: limit,
  });
}

/**
 * Format invoice for display/printing
 */
export function formatInvoiceForDisplay(invoice: {
  invoiceNumber: string;
  invoiceDate: Date;
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  payerGstin?: string | null;
  payerAddress?: string | null;
  platformGstin: string;
  platformName: string;
  platformAddress: string;
  description: string;
  amount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  paymentId?: string | null;
  paymentMethod?: string | null;
  invoiceType: string;
  sacCode: string;
}) {
  const formatAmount = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  
  return {
    ...invoice,
    amountFormatted: formatAmount(invoice.amount),
    gstAmountFormatted: formatAmount(invoice.gstAmount),
    totalAmountFormatted: formatAmount(invoice.totalAmount),
    cgstFormatted: formatAmount(invoice.cgst),
    sgstFormatted: formatAmount(invoice.sgst),
    igstFormatted: formatAmount(invoice.igst),
    invoiceDateFormatted: invoice.invoiceDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  };
}
