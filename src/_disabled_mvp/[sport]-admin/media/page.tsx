"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Upload,
  ImageIcon as GalleryIcon,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";

interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string | null;
  caption?: string | null;
  imageUrl: string;
  videoUrl?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  displayOrder: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  uploadedAt: string;
}

interface GalleryImage {
  id: string;
  tournamentId: string;
  tournament?: { id: string; name: string };
  imageUrl: string;
  caption?: string | null;
  category: string;
  isFeatured: boolean;
  displayOrder: number;
  isActive: boolean;
  uploadedAt: string;
}

interface SpotlightImage {
  id: string;
  playerId: string;
  player?: { id: string; firstName: string; lastName: string };
  imageUrl: string;
  caption?: string | null;
  type: string;
  isFeatured: boolean;
  displayOrder: number;
  isActive: boolean;
  uploadedAt: string;
}

export default function MediaManagementPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [spotlightImages, setSpotlightImages] = useState<SpotlightImage[]>([]);
  const [activeTab, setActiveTab] = useState("hero");

  // Dialog states
  const [heroDialogOpen, setHeroDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    caption: "",
    imageUrl: "",
    videoUrl: "",
    linkUrl: "",
    linkText: "",
    displayOrder: 0,
    isActive: true,
    startDate: "",
    endDate: "",
  });

  const primaryTextClass = isCornhole
    ? "text-green-500 dark:text-green-400"
    : "text-teal-500 dark:text-teal-400";
  const primaryBgClass = isCornhole
    ? "bg-green-500/10 dark:bg-green-500/20"
    : "bg-teal-500/10 dark:bg-teal-500/20";

  // Fetch all media data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch hero slides
      const heroRes = await fetch(`/api/admin/media/hero?sport=${sport.toUpperCase()}`);
      if (heroRes.ok) {
        const data = await heroRes.json();
        setHeroSlides(data.slides || []);
      }

      // Fetch gallery images
      const galleryRes = await fetch(`/api/admin/media/gallery?sport=${sport.toUpperCase()}`);
      if (galleryRes.ok) {
        const data = await galleryRes.json();
        setGalleryImages(data.images || []);
      }

      // Fetch spotlight images
      const spotlightRes = await fetch(`/api/admin/media/spotlight?sport=${sport.toUpperCase()}`);
      if (spotlightRes.ok) {
        const data = await spotlightRes.json();
        setSpotlightImages(data.images || []);
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sport]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = "/api/admin/media/hero";
    const method = editingSlide ? "PUT" : "POST";
    const body = editingSlide
      ? { id: editingSlide.id, ...formData, sport }
      : { ...formData, sport };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setHeroDialogOpen(false);
        setEditingSlide(null);
        setFormData({
          title: "",
          subtitle: "",
          caption: "",
          imageUrl: "",
          videoUrl: "",
          linkUrl: "",
          linkText: "",
          displayOrder: 0,
          isActive: true,
          startDate: "",
          endDate: "",
        });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save slide:", error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/admin/media/hero?id=${deletingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setDeletingId(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete slide:", error);
    }
  };

  // Toggle active status
  const toggleActive = async (slide: HeroSlide) => {
    try {
      await fetch("/api/admin/media/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slide.id, isActive: !slide.isActive }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to toggle active:", error);
    }
  };

  // Open edit dialog
  const openEditDialog = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setFormData({
      title: slide.title,
      subtitle: slide.subtitle || "",
      caption: slide.caption || "",
      imageUrl: slide.imageUrl,
      videoUrl: slide.videoUrl || "",
      linkUrl: slide.linkUrl || "",
      linkText: slide.linkText || "",
      displayOrder: slide.displayOrder,
      isActive: slide.isActive,
      startDate: slide.startDate || "",
      endDate: slide.endDate || "",
    });
    setHeroDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-muted/30">
      <Sidebar userType="admin" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Media Management</h1>
              <p className="text-muted-foreground">
                Manage hero slides, tournament galleries, and player spotlights
              </p>
            </div>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="hero" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Hero Slides
                <Badge variant="secondary" className="ml-1">{heroSlides.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="gallery" className="gap-2">
                <GalleryIcon className="w-4 h-4" />
                Tournament Gallery
                <Badge variant="secondary" className="ml-1">{galleryImages.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="spotlight" className="gap-2">
                <UserIcon className="w-4 h-4" />
                Player Spotlights
                <Badge variant="secondary" className="ml-1">{spotlightImages.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Hero Slides Tab */}
            <TabsContent value="hero">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Hero Carousel Slides</CardTitle>
                      <CardDescription>
                        Images shown on the {sport} home page carousel
                      </CardDescription>
                    </div>
                    <Dialog open={heroDialogOpen} onOpenChange={setHeroDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className={cn(primaryBgClass, primaryTextClass, "border-transparent")}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Slide
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <form onSubmit={handleSubmit}>
                          <DialogHeader>
                            <DialogTitle>
                              {editingSlide ? "Edit Hero Slide" : "Add New Hero Slide"}
                            </DialogTitle>
                            <DialogDescription>
                              Add images to the sport home page carousel
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-4 py-4">
                            <div className="col-span-2">
                              <Label htmlFor="title">Title *</Label>
                              <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Tournament Championship"
                                required
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="subtitle">Subtitle</Label>
                              <Input
                                id="subtitle"
                                value={formData.subtitle}
                                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                placeholder="2024 Season"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="caption">Caption</Label>
                              <Input
                                id="caption"
                                value={formData.caption}
                                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                                placeholder="Compete in tournaments across India"
                              />
                            </div>
                            
                            <div className="col-span-2">
                              <Label htmlFor="imageUrl">Image URL *</Label>
                              <Input
                                id="imageUrl"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="/images/hero/cornhole/tournament.png"
                                required
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Upload image to public/images folder and enter the path
                              </p>
                            </div>
                            
                            <div>
                              <Label htmlFor="videoUrl">Video URL (optional)</Label>
                              <Input
                                id="videoUrl"
                                value={formData.videoUrl}
                                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                placeholder="/videos/hero-background.mp4"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="displayOrder">Display Order</Label>
                              <Input
                                id="displayOrder"
                                type="number"
                                value={formData.displayOrder}
                                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="linkUrl">Link URL</Label>
                              <Input
                                id="linkUrl"
                                value={formData.linkUrl}
                                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                                placeholder="/cornhole/tournaments/abc123"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="linkText">Link Text</Label>
                              <Input
                                id="linkText"
                                value={formData.linkText}
                                onChange={(e) => setFormData({ ...formData, linkText: e.target.value })}
                                placeholder="View Tournament"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="startDate">Start Date</Label>
                              <Input
                                id="startDate"
                                type="datetime-local"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="endDate">End Date</Label>
                              <Input
                                id="endDate"
                                type="datetime-local"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                              />
                            </div>
                            
                            <div className="col-span-2 flex items-center gap-2">
                              <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                              />
                              <Label htmlFor="isActive">Active (visible on site)</Label>
                            </div>
                          </div>
                          
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setHeroDialogOpen(false);
                                setEditingSlide(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button type="submit">
                              {editingSlide ? "Update" : "Create"} Slide
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {heroSlides.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hero slides configured</p>
                      <p className="text-sm">Add slides to customize the home page carousel</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {heroSlides.map((slide) => (
                        <div
                          key={slide.id}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border",
                            slide.isActive ? "bg-card" : "bg-muted/50 opacity-60"
                          )}
                        >
                          {/* Thumbnail */}
                          <div className="w-20 h-12 relative rounded overflow-hidden bg-muted flex-shrink-0">
                            {slide.imageUrl && (
                              <img
                                src={slide.imageUrl}
                                alt={slide.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate">{slide.title}</p>
                              {!slide.isActive && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {slide.caption || "No caption"}
                            </p>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActive(slide)}
                              title={slide.isActive ? "Deactivate" : "Activate"}
                            >
                              {slide.isActive ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(slide)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setDeletingId(slide.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tournament Gallery Tab */}
            <TabsContent value="gallery">
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Gallery</CardTitle>
                  <CardDescription>
                    Photos from completed tournaments (ready for future uploads)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <GalleryIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Tournament gallery infrastructure is ready</p>
                    <p className="text-sm mt-2">
                      Upload photos through the API endpoint:
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                      POST /api/admin/media/gallery
                    </code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Player Spotlights Tab */}
            <TabsContent value="spotlight">
              <Card>
                <CardHeader>
                  <CardTitle>Player Spotlights</CardTitle>
                  <CardDescription>
                    Featured player action shots and profiles (ready for future uploads)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-muted-foreground">
                    <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Player spotlight infrastructure is ready</p>
                    <p className="text-sm mt-2">
                      Upload player photos through the API endpoint:
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                      POST /api/admin/media/spotlight
                    </code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Hero Slide?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The slide will be permanently removed from the carousel.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
}
