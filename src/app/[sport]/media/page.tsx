"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  Video,
  Play,
  Calendar,
  Trophy,
  Eye,
  Download,
  Share2,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  url: string;
  title: string;
  tournament: string;
  tournamentId: string;
  date: string;
  uploadedBy: string;
}

interface VideoData {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  tournament: string;
  tournamentId: string;
  duration: string;
  date: string;
}

interface MediaStats {
  totalPhotos: number;
  totalVideos: number;
  tournaments: number;
  totalViews: number;
}

interface MediaData {
  photos: Photo[];
  videos: VideoData[];
  stats: MediaStats;
}

export default function MediaPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaData | null>(null);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/player/media");
      if (!response.ok) {
        throw new Error("Failed to fetch media");
      }
      const data = await response.json();
      if (data.success) {
        setMedia(data.data);
      } else {
        setError(data.error || "Failed to load media");
      }
    } catch (err: any) {
      console.error("Failed to fetch media:", err);
      setError(err.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-8 text-center">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-red-500">{error}</p>
                <Button onClick={fetchMedia} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Media</h1>
            <p className="text-gray-500">Your highlights and photos uploaded by management</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <ImageIcon className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{media?.stats?.totalPhotos || 0}</p>
                <p className="text-xs text-gray-500">Photos</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Video className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{media?.stats?.totalVideos || 0}</p>
                <p className="text-xs text-gray-500">Videos</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{media?.stats?.tournaments || 0}</p>
                <p className="text-xs text-gray-500">Tournaments</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Eye className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{media?.stats?.totalViews || 0}</p>
                <p className="text-xs text-gray-500">Total Views</p>
              </CardContent>
            </Card>
          </div>

          {/* Media Tabs */}
          <Tabs defaultValue="photos" className="space-y-4">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="photos" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-2">
                <Video className="w-4 h-4" />
                Videos
              </TabsTrigger>
            </TabsList>

            {/* Photos Tab */}
            <TabsContent value="photos">
              {media?.photos && media.photos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {media.photos.map((photo) => (
                    <Card key={photo.id} className="bg-white border-gray-100 shadow-sm overflow-hidden group">
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={photo.url}
                          alt={photo.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder.png';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" className="gap-1">
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                          <Button size="sm" variant="secondary" className="gap-1">
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium text-gray-900">{photo.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <Trophy className="w-4 h-4" />
                          {photo.tournament}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(photo.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <span>By {photo.uploadedBy}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No photos uploaded yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Photos from your tournaments will appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Videos Tab */}
            <TabsContent value="videos">
              {media?.videos && media.videos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {media.videos.map((video) => (
                    <Card key={video.id} className="bg-white border-gray-100 shadow-sm overflow-hidden group">
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder.png';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-gray-900 ml-1" />
                          </div>
                        </div>
                        <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
                          {video.duration}
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium text-gray-900">{video.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <Trophy className="w-4 h-4" />
                          {video.tournament}
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(video.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No videos uploaded yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Video highlights from your tournaments will appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
