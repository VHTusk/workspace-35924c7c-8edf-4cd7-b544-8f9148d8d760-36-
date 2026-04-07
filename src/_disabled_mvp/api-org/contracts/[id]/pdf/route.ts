import { NextRequest, NextResponse } from 'next/server';
import { getContractData, generateContractHTML, getPDFResponseHeaders, generateContractFilename } from '@/lib/contract-pdf';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/org/contracts/[id]/pdf
 * 
 * Generate and download a contract as PDF (HTML format for browser printing)
 * 
 * Headers:
 * - Authorization: Bearer <session_token>
 * 
 * Query params:
 * - format: 'html' (default) or 'pdf' (future)
 * 
 * Response:
 * - HTML file that can be printed to PDF by browser
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get contract data
    const contractData = await getContractData(contractId);
    
    if (!contractData) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Generate HTML content
    const htmlContent = generateContractHTML(contractData);
    
    // Generate filename
    const filename = generateContractFilename(contractData);

    // Return HTML for browser printing
    // Note: Users can print to PDF from browser (Ctrl+P → Save as PDF)
    return new NextResponse(htmlContent, {
      status: 200,
      headers: getPDFResponseHeaders(filename),
    });

  } catch (error) {
    console.error('[Contract PDF API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate contract PDF' },
      { status: 500 }
    );
  }
}
