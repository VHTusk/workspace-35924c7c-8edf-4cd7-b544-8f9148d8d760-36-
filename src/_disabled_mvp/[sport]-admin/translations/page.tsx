"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
} from "lucide-react";

interface Translation {
  id: string;
  key: string;
  locale: string;
  value: string;
  namespace: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTranslationsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [editDialog, setEditDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formLocale, setFormLocale] = useState("en");
  const [formValue, setFormValue] = useState("");
  const [formNamespace, setFormNamespace] = useState("common");

  const locales = ["en", "hi"];
  const namespaces = ["common", "tournament", "player", "org", "admin"];

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchTranslations(); }, [sport, localeFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(localeFilter !== "all" && { locale: localeFilter }),
        ...(search && { search }),
      });
      const response = await fetch(`/api/admin/i18n/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data.translations || []);
      }
    } catch (error) {
      console.error("Failed to fetch translations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTranslations();
  };

  const handleCreate = async () => {
    if (!formKey || !formValue) return;
    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/i18n/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: formKey,
          locale: formLocale,
          value: formValue,
          namespace: formNamespace,
        }),
      });
      if (response.ok) {
        fetchTranslations();
        setCreateDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error("Failed to create translation:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTranslation || !formValue) return;
    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/i18n/translations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTranslation.id,
          value: formValue,
        }),
      });
      if (response.ok) {
        fetchTranslations();
        setEditDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error("Failed to update translation:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this translation?")) return;
    try {
      const response = await fetch(`/api/admin/i18n/translations?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error("Failed to delete translation:", error);
    }
  };

  const openEditDialog = (translation: Translation) => {
    setSelectedTranslation(translation);
    setFormKey(translation.key);
    setFormLocale(translation.locale);
    setFormValue(translation.value);
    setFormNamespace(translation.namespace);
    setEditDialog(true);
  };

  const resetForm = () => {
    setFormKey("");
    setFormLocale("en");
    setFormValue("");
    setFormNamespace("common");
    setSelectedTranslation(null);
  };

  if (loading && translations.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Translations</h1>
            <p className="text-muted-foreground mt-1">Manage platform language translations</p>
          </div>
          <Button onClick={() => { resetForm(); setCreateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Translation
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by key or value..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <Select value={localeFilter} onValueChange={setLocaleFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Locale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locales</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Translations Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {translations.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{t.key}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={t.locale === "en" ? "border-blue-500 text-blue-400" : "border-amber-500 text-amber-400"}>
                        {t.locale === "en" ? "🇬🇧 English" : "🇮🇳 Hindi"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.namespace}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{t.value}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(t)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {translations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No translations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Translation</DialogTitle>
              <DialogDescription>Add a new translation key.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Key</label>
                <Input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g., common.welcome"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Locale</label>
                  <Select value={formLocale} onValueChange={setFormLocale}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locales.map((l) => (
                        <SelectItem key={l} value={l}>{l === "en" ? "🇬🇧 English" : "🇮🇳 Hindi"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Namespace</label>
                  <Select value={formNamespace} onValueChange={setFormNamespace}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Translation Value</label>
                <Textarea
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="Translated text..."
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={actionLoading || !formKey || !formValue}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Translation</DialogTitle>
              <DialogDescription>Update the translation value.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Key</label>
                <Input value={formKey} disabled className="mt-1.5 bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Locale</label>
                  <Input value={formLocale} disabled className="mt-1.5 bg-muted" />
                </div>
                <div>
                  <label className="text-sm font-medium">Namespace</label>
                  <Input value={formNamespace} disabled className="mt-1.5 bg-muted" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Translation Value</label>
                <Textarea
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={actionLoading || !formValue}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
