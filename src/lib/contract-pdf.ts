/**
 * Contract PDF Generation Service
 * 
 * Generates professional PDF contracts for player-organization agreements.
 * Uses @react-pdf/renderer for server-side PDF generation.
 * 
 * Note: Install with: npm install @react-pdf/renderer
 */

import { db } from '@/lib/db';

// Contract data interface
export interface ContractData {
  contractId: string;
  contractTitle: string;
  contractType: string;
  contractTerms: string;
  
  // Player info
  playerName: string;
  playerEmail: string;
  playerPhone?: string;
  playerCity?: string;
  playerState?: string;
  
  // Organization info
  orgName: string;
  orgType: string;
  orgEmail?: string;
  orgPhone?: string;
  orgCity?: string;
  orgState?: string;
  
  // Duration
  startDate: Date;
  endDate: Date;
  
  // Metadata
  createdAt: Date;
  generatedAt: Date;
}

/**
 * Generate a simple HTML contract for PDF conversion
 * This is a fallback that works without external libraries
 */
export function generateContractHTML(data: ContractData): string {
  const formatDate = (date: Date) => 
    date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Contract - ${data.contractTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24pt;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 10pt;
      color: #666;
    }
    .contract-title {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
      padding: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .section {
      margin: 20px 0;
    }
    .section-title {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-box {
      padding: 15px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .info-box h4 {
      margin: 0 0 10px 0;
      font-size: 11pt;
      color: #2563eb;
    }
    .info-row {
      margin: 5px 0;
    }
    .info-label {
      font-weight: 500;
      color: #666;
    }
    .terms {
      padding: 15px;
      background: #fafafa;
      border: 1px solid #e2e8f0;
      white-space: pre-wrap;
      font-size: 10pt;
      line-height: 1.8;
    }
    .signature-section {
      margin-top: 50px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #1a1a1a;
      margin-top: 60px;
      padding-top: 10px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 500;
    }
    .badge-id {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .badge-type {
      background: #fef3c7;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">VALORHIVE</div>
    <div class="subtitle">Multi-Sport Tournament Platform</div>
  </div>

  <div class="contract-title">
    ${data.contractTitle}
    <br>
    <span class="badge badge-id">Contract ID: ${data.contractId}</span>
    <span class="badge badge-type">${data.contractType.toUpperCase()}</span>
  </div>

  <div class="section">
    <div class="section-title">Agreement Parties</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>Player (First Party)</h4>
        <div class="info-row"><span class="info-label">Name:</span> ${data.playerName}</div>
        <div class="info-row"><span class="info-label">Email:</span> ${data.playerEmail}</div>
        ${data.playerPhone ? `<div class="info-row"><span class="info-label">Phone:</span> ${data.playerPhone}</div>` : ''}
        ${data.playerCity || data.playerState ? `<div class="info-row"><span class="info-label">Location:</span> ${[data.playerCity, data.playerState].filter(Boolean).join(', ')}</div>` : ''}
      </div>
      <div class="info-box">
        <h4>Organization (Second Party)</h4>
        <div class="info-row"><span class="info-label">Name:</span> ${data.orgName}</div>
        <div class="info-row"><span class="info-label">Type:</span> ${data.orgType}</div>
        ${data.orgEmail ? `<div class="info-row"><span class="info-label">Email:</span> ${data.orgEmail}</div>` : ''}
        ${data.orgCity || data.orgState ? `<div class="info-row"><span class="info-label">Location:</span> ${[data.orgCity, data.orgState].filter(Boolean).join(', ')}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Contract Duration</div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">Start Date:</span> ${formatDate(data.startDate)}</div>
      <div class="info-row"><span class="info-label">End Date:</span> ${formatDate(data.endDate)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Terms and Conditions</div>
    <div class="terms">${data.contractTerms}</div>
  </div>

  <div class="section">
    <div class="section-title">Acknowledgment</div>
    <p>
      By signing this contract, both parties acknowledge that they have read, understood, and agree to 
      abide by all terms and conditions stated herein. This contract is governed by the VALORHIVE 
      platform terms of service and applicable laws of India.
    </p>
    <p>
      <strong>Note:</strong> This contract has been generated electronically through the VALORHIVE 
      platform. The contract becomes active only after verification by a platform administrator.
    </p>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line">
        <strong>${data.playerName}</strong><br>
        <small>Player Signature</small><br>
        <small>Date: _______________</small>
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line">
        <strong>${data.orgName}</strong><br>
        <small>Organization Representative</small><br>
        <small>Date: _______________</small>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>
      Generated on ${formatDate(data.generatedAt)} | VALORHIVE Platform<br>
      Contract ID: ${data.contractId} | Created: ${formatDate(data.createdAt)}<br>
      <em>This document is for reference purposes. Official contract status is maintained on the VALORHIVE platform.</em>
    </p>
  </div>
</body>
</html>
`;
}

/**
 * Fetch contract data from database and prepare for PDF generation
 */
export async function getContractData(contractId: string): Promise<ContractData | null> {
  const contract = await db.playerContract.findUnique({
    where: { id: contractId },
    include: {
      player: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          city: true,
          state: true,
        },
      },
      organization: {
        select: {
          name: true,
          type: true,
          email: true,
          phone: true,
          city: true,
          state: true,
        },
      },
    },
  });

  if (!contract) {
    return null;
  }

  return {
    contractId: contract.id,
    contractTitle: contract.contractTitle,
    contractType: contract.contractType,
    contractTerms: contract.contractTerms,
    
    playerName: `${contract.player.firstName} ${contract.player.lastName}`,
    playerEmail: contract.player.email || '',
    playerPhone: contract.player.phone || undefined,
    playerCity: contract.player.city || undefined,
    playerState: contract.player.state || undefined,
    
    orgName: contract.organization.name,
    orgType: contract.organization.type,
    orgEmail: contract.organization.email || undefined,
    orgPhone: contract.organization.phone || undefined,
    orgCity: contract.organization.city || undefined,
    orgState: contract.organization.state || undefined,
    
    startDate: contract.startDate,
    endDate: contract.endDate,
    createdAt: contract.createdAt,
    generatedAt: new Date(),
  };
}

/**
 * Generate PDF response headers for download
 */
export function getPDFResponseHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  };
}

/**
 * Generate contract filename
 */
export function generateContractFilename(data: ContractData): string {
  const sanitizedName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  return `Contract_${sanitizedName(data.orgName)}_${sanitizedName(data.playerName)}_${dateStr}.html`;
}
