'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContractPDFButtonProps {
  contractId: string;
  contractTitle?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  className?: string;
}

/**
 * Contract PDF Download Button
 * 
 * Downloads a contract as a printable HTML file that can be saved as PDF.
 * 
 * @example
 * <ContractPDFButton contractId="abc123" contractTitle="Player Contract" />
 */
export function ContractPDFButton({
  contractId,
  contractTitle = 'Contract',
  variant = 'outline',
  size = 'default',
  showIcon = true,
  className = '',
}: ContractPDFButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/org/contracts/${contractId}/pdf`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to download contracts');
        }
        if (response.status === 404) {
          throw new Error('Contract not found');
        }
        throw new Error('Failed to generate contract');
      }

      // Get the HTML content
      const htmlContent = await response.text();
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${contractTitle.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      toast({
        title: 'Contract Downloaded',
        description: 'Open the file in your browser and use Print (Ctrl+P) to save as PDF.',
      });

    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download contract',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showIcon ? (
        <Download className="h-4 w-4 mr-2" />
      ) : null}
      {loading ? 'Generating...' : 'Download Contract'}
    </Button>
  );
}

/**
 * Contract Preview Card
 * Shows contract summary with download button
 */
export function ContractPreviewCard({
  contractId,
  contractTitle,
  contractType,
  status,
  startDate,
  endDate,
  playerName,
  orgName,
}: {
  contractId: string;
  contractTitle: string;
  contractType: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  playerName: string;
  orgName: string;
}) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
    TERMINATED: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  const formatDate = (date: Date | string) => 
    new Date(date).toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">{contractTitle}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {playerName} ↔ {orgName}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status] || 'bg-gray-100'}`}>
          {status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span>Type: {contractType}</span>
        <span>•</span>
        <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
      </div>

      <div className="mt-4 flex justify-end">
        <ContractPDFButton
          contractId={contractId}
          contractTitle={contractTitle}
          size="sm"
        />
      </div>
    </div>
  );
}

export default ContractPDFButton;
