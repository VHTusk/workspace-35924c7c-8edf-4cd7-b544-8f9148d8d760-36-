'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Award, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface BadgeDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  tier: string;
  pointsRequired: number | null;
  conditionExpr: string | null;
  isActive: boolean;
}

const CATEGORIES = ['achievement', 'milestone', 'special'];
const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-700',
  silver: 'bg-gray-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-gradient-to-r from-purple-400 to-pink-400',
};

export default function BadgeManagementPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const emptyBadge = {
    code: '',
    name: '',
    description: '',
    iconUrl: '',
    category: 'achievement',
    tier: 'bronze',
    pointsRequired: null as number | null,
    conditionExpr: '',
    isActive: true,
  };

  const [formData, setFormData] = useState(emptyBadge);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetch('/api/badges?admin=true');
      const data = await res.json();
      if (res.ok) {
        setBadges(data.badges);
      } else {
        toast.error('Access denied');
      }
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name || !formData.description) {
      toast.error('Code, name, and description are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          pointsRequired: formData.pointsRequired || null,
          conditionExpr: formData.conditionExpr || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBadges((prev) => [...prev, data.badge]);
        setFormData(emptyBadge);
        setShowCreate(false);
        toast.success('Badge created');
      } else {
        toast.error(data.error || 'Failed to create badge');
      }
    } catch (error) {
      toast.error('Failed to create badge');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    setSaving(true);
    try {
      const res = await fetch('/api/badges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...formData,
          pointsRequired: formData.pointsRequired || null,
          conditionExpr: formData.conditionExpr || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBadges((prev) =>
          prev.map((b) => (b.id === editingId ? data.badge : b))
        );
        setEditingId(null);
        setFormData(emptyBadge);
        toast.success('Badge updated');
      } else {
        toast.error(data.error || 'Failed to update badge');
      }
    } catch (error) {
      toast.error('Failed to update badge');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (badge: BadgeDefinition) => {
    setEditingId(badge.id);
    setFormData({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl || '',
      category: badge.category,
      tier: badge.tier,
      pointsRequired: badge.pointsRequired,
      conditionExpr: badge.conditionExpr || '',
      isActive: badge.isActive,
    });
    setShowCreate(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    setFormData(emptyBadge);
  };

  // Group badges by category
  const groupedBadges = badges.reduce((acc, badge) => {
    const cat = badge.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(badge);
    return acc;
  }, {} as Record<string, BadgeDefinition[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold text-${theme}-600 flex items-center gap-2`}>
              <Award className="h-6 w-6" />
              Badge Management
            </h1>
            <p className="text-gray-500 mt-1">
              Create and manage achievement badges
            </p>
          </div>
          {!showCreate && !editingId && (
            <Button
              onClick={() => setShowCreate(true)}
              className={`bg-${theme}-500 hover:bg-${theme}-600`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Badge
            </Button>
          )}
        </div>

        {/* Create/Edit Form */}
        {(showCreate || editingId) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                {showCreate ? 'Create New Badge' : 'Edit Badge'}
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    placeholder="FIRST_WIN"
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="First Victory"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Description *</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Won your first tournament match"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tier</Label>
                  <Select
                    value={formData.tier}
                    onValueChange={(v) => setFormData({ ...formData, tier: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Points Required</Label>
                  <Input
                    type="number"
                    value={formData.pointsRequired || ''}
                    onChange={(e) => setFormData({ ...formData, pointsRequired: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Auto-award at points threshold"
                  />
                </div>
                <div>
                  <Label>Icon URL</Label>
                  <Input
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Condition Expression (JSON)</Label>
                  <Input
                    value={formData.conditionExpr}
                    onChange={(e) => setFormData({ ...formData, conditionExpr: e.target.value })}
                    placeholder='{"wins": {"$gte": 10}}'
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={saving}
                  className={`bg-${theme}-500 hover:bg-${theme}-600`}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Badges List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : badges.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No badges yet</h3>
              <p className="text-gray-500 mb-4">
                Create achievement badges to reward players
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                className={`bg-${theme}-500 hover:bg-${theme}-600`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Badge
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const categoryBadges = groupedBadges[category];
              if (!categoryBadges || categoryBadges.length === 0) return null;

              return (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
                    {category} Badges
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryBadges.map((badge) => (
                      <Card key={badge.id} className={!badge.isActive ? 'opacity-60' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full ${TIER_COLORS[badge.tier]} flex items-center justify-center`}>
                                <Award className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{badge.name}</h3>
                                <p className="text-xs text-gray-500">{badge.code}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(badge)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">{badge.description}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="secondary" className="capitalize">
                              {badge.tier}
                            </Badge>
                            {badge.pointsRequired && (
                              <Badge variant="outline">
                                {badge.pointsRequired} pts
                              </Badge>
                            )}
                            {!badge.isActive && (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
