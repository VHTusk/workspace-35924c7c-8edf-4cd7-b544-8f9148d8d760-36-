'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Calendar,
  Percent,
  IndianRupee,
  Gift,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  BarChart3,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';

// Types
interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_ENTRY';
  discountValue: number;
  maxDiscountLimit: number | null;
  applicableProduct: 'TOURNAMENT' | 'MEMBERSHIP' | 'BOTH';
  applicableTournamentIds: string[] | null;
  minOrderValue: number | null;
  usageLimit: number | null;
  usagePerUserLimit: number;
  currentUsageCount: number;
  validFrom: string;
  validUntil: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED';
  sport: string | null;
  isFirstPurchaseOnly: boolean;
  isNewUserOnly: boolean;
  createdAt: string;
  updatedAt: string;
  totalUsages?: number;
}

interface CouponUsage {
  id: string;
  userId: string | null;
  orgId: string | null;
  orderId: string | null;
  productId: string;
  productType: string;
  originalAmount: number;
  discountApplied: number;
  finalAmount: number;
  usedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface CouponWithUsages extends Coupon {
  usages?: CouponUsage[];
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  INACTIVE: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  EXPIRED: 'bg-red-500/10 text-red-500 border-red-500/30',
  EXHAUSTED: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
};

// Discount type badge colors
const DISCOUNT_TYPE_COLORS: Record<string, string> = {
  PERCENTAGE: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  FIXED: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  FREE_ENTRY: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
};

// Initial form state
const emptyForm = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED' | 'FREE_ENTRY',
  discountValue: 0,
  maxDiscountLimit: null as number | null,
  applicableProduct: 'BOTH' as 'TOURNAMENT' | 'MEMBERSHIP' | 'BOTH',
  applicableTournamentIds: '',
  minOrderValue: null as number | null,
  validFrom: null as Date | null,
  validUntil: null as Date | null,
  usageLimit: null as number | null,
  usagePerUserLimit: 1,
  isFirstPurchaseOnly: false,
  isNewUserOnly: false,
};

export default function AdminCouponsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  // State
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>('all');

  // Modal states
  const [showCreateEdit, setShowCreateEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showUsageStats, setShowUsageStats] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponWithUsages | null>(null);

  // Form state
  const [formData, setFormData] = useState(emptyForm);

  // Auth check
  useEffect(() => {
    checkAuth();
  }, [sport]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth/check');
      if (!response.ok) {
        router.push(`/${sport}/admin/login`);
        return;
      }
      fetchCoupons();
    } catch {
      router.push(`/${sport}/admin/login`);
    }
  };

  // Fetch coupons
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      // Build query params
      const queryParams = new URLSearchParams();
      queryParams.append('list', 'true');
      if (searchQuery) queryParams.append('search', searchQuery);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (discountTypeFilter !== 'all') queryParams.append('discountType', discountTypeFilter);
      queryParams.append('sport', sport.toUpperCase());

      const response = await fetch(`/api/coupons?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch coupons');
      }

      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (err) {
      setError('Failed to load coupons');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchCoupons();
    }
  }, [statusFilter, discountTypeFilter]);

  // Create coupon
  const handleCreate = async () => {
    if (!formData.code || !formData.validFrom || !formData.validUntil) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.discountType !== 'FREE_ENTRY' && formData.discountValue <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sport: sport.toUpperCase(),
          applicableTournamentIds: formData.applicableTournamentIds
            ? formData.applicableTournamentIds.split(',').map(id => id.trim()).filter(Boolean)
            : null,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create coupon');
      }

      setCoupons(prev => [...prev, data.coupon]);
      setShowCreateEdit(false);
      resetForm();
      toast.success('Coupon created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  // Update coupon
  const handleUpdate = async () => {
    if (!editingCoupon) return;

    if (!formData.code || !formData.validFrom || !formData.validUntil) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/coupons/${editingCoupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          validFrom: formData.validFrom?.toISOString(),
          validUntil: formData.validUntil?.toISOString(),
          applicableTournamentIds: formData.applicableTournamentIds
            ? formData.applicableTournamentIds.split(',').map(id => id.trim()).filter(Boolean)
            : null,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update coupon');
      }

      setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? data.coupon : c));
      setShowCreateEdit(false);
      setEditingCoupon(null);
      resetForm();
      toast.success('Coupon updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update coupon');
    } finally {
      setSaving(false);
    }
  };

  // Deactivate coupon
  const handleDeactivate = async () => {
    if (!deletingCoupon) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/coupons/${deletingCoupon.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate coupon');
      }

      setCoupons(prev => prev.map(c => 
        c.id === deletingCoupon.id ? { ...c, status: 'INACTIVE' } : c
      ));
      setShowDelete(false);
      setDeletingCoupon(null);
      toast.success('Coupon deactivated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate coupon');
    } finally {
      setSaving(false);
    }
  };

  // Fetch usage stats
  const fetchUsageStats = async (couponId: string) => {
    try {
      const response = await fetch(`/api/coupons/${couponId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSelectedCoupon(data.coupon);
        setShowUsageStats(true);
      }
    } catch (err) {
      toast.error('Failed to load usage statistics');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData(emptyForm);
  };

  // Start editing
  const startEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountLimit: coupon.maxDiscountLimit,
      applicableProduct: coupon.applicableProduct,
      applicableTournamentIds: coupon.applicableTournamentIds?.join(', ') || '',
      minOrderValue: coupon.minOrderValue,
      validFrom: new Date(coupon.validFrom),
      validUntil: new Date(coupon.validUntil),
      usageLimit: coupon.usageLimit,
      usagePerUserLimit: coupon.usagePerUserLimit,
      isFirstPurchaseOnly: coupon.isFirstPurchaseOnly,
      isNewUserOnly: coupon.isNewUserOnly,
    });
    setShowCreateEdit(true);
  };

  // Filter coupons by search query
  const filteredCoupons = coupons.filter(coupon => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return coupon.code.toLowerCase().includes(query) ||
        (coupon.description?.toLowerCase().includes(query));
    }
    return true;
  });

  // Calculate status dynamically
  const getCouponStatus = (coupon: Coupon): string => {
    const now = new Date();
    if (coupon.status === 'INACTIVE') return 'INACTIVE';
    if (new Date(coupon.validUntil) < now) return 'EXPIRED';
    if (coupon.usageLimit && coupon.currentUsageCount >= coupon.usageLimit) return 'EXHAUSTED';
    return 'ACTIVE';
  };

  // Format currency
  const formatCurrency = (paise: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(paise / 100);
  };

  // Format discount value
  const formatDiscount = (coupon: Coupon): string => {
    switch (coupon.discountType) {
      case 'PERCENTAGE':
        return `${coupon.discountValue}%`;
      case 'FIXED':
        return formatCurrency(coupon.discountValue);
      case 'FREE_ENTRY':
        return 'Free Entry';
      default:
        return '-';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" />
              Coupon Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Create, edit, and manage discount coupons
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingCoupon(null);
              setShowCreateEdit(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="EXHAUSTED">Exhausted</SelectItem>
                </SelectContent>
              </Select>

              {/* Discount Type Filter */}
              <Select value={discountTypeFilter} onValueChange={setDiscountTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="FREE_ENTRY">Free Entry</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDiscountTypeFilter('all');
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No coupons found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== 'all' || discountTypeFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first coupon to get started'}
                </p>
                {!searchQuery && statusFilter === 'all' && discountTypeFilter === 'all' && (
                  <Button
                    onClick={() => setShowCreateEdit(true)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Coupon
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => {
                    const status = getCouponStatus(coupon);
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div>
                            <code className="text-sm font-mono font-semibold text-foreground">
                              {coupon.code}
                            </code>
                            {coupon.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                {coupon.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={DISCOUNT_TYPE_COLORS[coupon.discountType]} variant="outline">
                              {coupon.discountType === 'PERCENTAGE' && <Percent className="h-3 w-3 mr-1" />}
                              {coupon.discountType === 'FIXED' && <IndianRupee className="h-3 w-3 mr-1" />}
                              {coupon.discountType === 'FREE_ENTRY' && <Gift className="h-3 w-3 mr-1" />}
                              {formatDiscount(coupon)}
                            </Badge>
                            {coupon.maxDiscountLimit && coupon.discountType === 'PERCENTAGE' && (
                              <span className="text-xs text-muted-foreground">
                                (max {formatCurrency(coupon.maxDiscountLimit)})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[status]} variant="outline">
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>
                              {coupon.currentUsageCount}
                              {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={new Date(coupon.validUntil) < new Date() ? 'text-red-500' : ''}>
                              {format(new Date(coupon.validUntil), 'dd MMM yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchUsageStats(coupon.id)}
                              title="View usage stats"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(coupon)}
                              title="Edit coupon"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => {
                                setDeletingCoupon(coupon);
                                setShowDelete(true);
                              }}
                              disabled={coupon.status === 'INACTIVE'}
                              title="Deactivate coupon"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showCreateEdit} onOpenChange={setShowCreateEdit}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
              </DialogTitle>
              <DialogDescription>
                {editingCoupon
                  ? 'Update the coupon details below'
                  : 'Fill in the details to create a new coupon'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Code and Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">
                    Coupon Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="code"
                    placeholder="SUMMER20"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    maxLength={20}
                    disabled={!!editingCoupon}
                  />
                  <p className="text-xs text-muted-foreground">
                    Uppercase letters and numbers only
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Summer sale discount"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={200}
                  />
                </div>
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountType">
                    Discount Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: 'PERCENTAGE' | 'FIXED' | 'FREE_ENTRY') => 
                      setFormData({ ...formData, discountType: value, discountValue: value === 'FREE_ENTRY' ? 0 : formData.discountValue })
                    }
                  >
                    <SelectTrigger id="discountType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Percentage
                        </div>
                      </SelectItem>
                      <SelectItem value="FIXED">
                        <div className="flex items-center gap-2">
                          <IndianRupee className="h-4 w-4" />
                          Fixed Amount
                        </div>
                      </SelectItem>
                      <SelectItem value="FREE_ENTRY">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          Free Entry
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.discountType !== 'FREE_ENTRY' && (
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">
                      Discount Value <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '50000'}
                      value={formData.discountValue || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        discountValue: e.target.value ? parseInt(e.target.value) : 0 
                      })}
                      min={0}
                      max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.discountType === 'PERCENTAGE' 
                        ? 'Percentage discount (1-100)'
                        : 'Fixed amount in paise (e.g., 50000 = ₹500)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Max Discount Limit (for percentage) */}
              {formData.discountType === 'PERCENTAGE' && (
                <div className="space-y-2">
                  <Label htmlFor="maxDiscountLimit">Maximum Discount Limit (optional)</Label>
                  <Input
                    id="maxDiscountLimit"
                    type="number"
                    placeholder="50000 (₹500 max discount)"
                    value={formData.maxDiscountLimit || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      maxDiscountLimit: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum discount amount in paise
                  </p>
                </div>
              )}

              <Separator />

              {/* Applicable Product */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="applicableProduct">Applicable Product</Label>
                  <Select
                    value={formData.applicableProduct}
                    onValueChange={(value: 'TOURNAMENT' | 'MEMBERSHIP' | 'BOTH') => 
                      setFormData({ ...formData, applicableProduct: value })
                    }
                  >
                    <SelectTrigger id="applicableProduct">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTH">Both Tournament & Membership</SelectItem>
                      <SelectItem value="TOURNAMENT">Tournament Only</SelectItem>
                      <SelectItem value="MEMBERSHIP">Membership Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minOrderValue">Minimum Order Value (optional)</Label>
                  <Input
                    id="minOrderValue"
                    type="number"
                    placeholder="100000 (₹1000 minimum)"
                    value={formData.minOrderValue || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      minOrderValue: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum order value in paise
                  </p>
                </div>
              </div>

              {/* Tournament IDs */}
              <div className="space-y-2">
                <Label htmlFor="tournamentIds">Applicable Tournament IDs (optional)</Label>
                <Input
                  id="tournamentIds"
                  placeholder="tournament_id_1, tournament_id_2"
                  value={formData.applicableTournamentIds}
                  onChange={(e) => setFormData({ ...formData, applicableTournamentIds: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated tournament IDs. Leave empty for all tournaments.
                </p>
              </div>

              <Separator />

              {/* Validity Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Valid From <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.validFrom ? format(formData.validFrom, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.validFrom || undefined}
                        onSelect={(date) => setFormData({ ...formData, validFrom: date || null })}
                        disabled={(date) => date < new Date() && !editingCoupon}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>
                    Valid Until <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.validUntil ? format(formData.validUntil, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.validUntil || undefined}
                        onSelect={(date) => setFormData({ ...formData, validUntil: date || null })}
                        disabled={(date) => formData.validFrom ? date < formData.validFrom : date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />

              {/* Usage Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usageLimit">Total Usage Limit (optional)</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    placeholder="1000"
                    value={formData.usageLimit || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      usageLimit: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited usage
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usagePerUserLimit">Usage Per User</Label>
                  <Input
                    id="usagePerUserLimit"
                    type="number"
                    placeholder="1"
                    value={formData.usagePerUserLimit}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      usagePerUserLimit: e.target.value ? parseInt(e.target.value) : 1 
                    })}
                    min={1}
                  />
                </div>
              </div>

              <Separator />

              {/* Restrictions */}
              <div className="space-y-4">
                <Label>Restrictions</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="firstPurchase"
                      checked={formData.isFirstPurchaseOnly}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, isFirstPurchaseOnly: checked as boolean })
                      }
                    />
                    <Label htmlFor="firstPurchase" className="font-normal cursor-pointer">
                      First purchase only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="newUser"
                      checked={formData.isNewUserOnly}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, isNewUserOnly: checked as boolean })
                      }
                    />
                    <Label htmlFor="newUser" className="font-normal cursor-pointer">
                      New users only (registered within 30 days)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateEdit(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingCoupon ? handleUpdate : handleCreate}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingCoupon ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4 mr-2" />
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate Coupon</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deactivate coupon <strong>{deletingCoupon?.code}</strong>?
                This action cannot be undone. The coupon will no longer be usable.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeactivate}
                disabled={saving}
                className="bg-red-500 hover:bg-red-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Usage Stats Modal */}
        <Dialog open={showUsageStats} onOpenChange={setShowUsageStats}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Statistics - {selectedCoupon?.code}
              </DialogTitle>
              <DialogDescription>
                View detailed usage history for this coupon
              </DialogDescription>
            </DialogHeader>

            {selectedCoupon && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedCoupon.totalUsages || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Uses</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedCoupon.usageLimit || '∞'}
                      </p>
                      <p className="text-xs text-muted-foreground">Usage Limit</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-500">
                        {formatCurrency(
                          selectedCoupon.usages?.reduce((sum, u) => sum + u.discountApplied, 0) || 0
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Discount Given</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedCoupon.usagePerUserLimit}
                      </p>
                      <p className="text-xs text-muted-foreground">Per User Limit</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Usage List */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Recent Usage</h3>
                  {selectedCoupon.usages && selectedCoupon.usages.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Original</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Final</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCoupon.usages.map((usage) => (
                          <TableRow key={usage.id}>
                            <TableCell>
                              {usage.user ? (
                                <div>
                                  <p className="text-sm font-medium">
                                    {usage.user.firstName} {usage.user.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{usage.user.email}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Organization</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {usage.productType.toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(usage.originalAmount)}</TableCell>
                            <TableCell className="text-emerald-500">
                              -{formatCurrency(usage.discountApplied)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(usage.finalAmount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(usage.usedAt), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No usage history yet
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUsageStats(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
