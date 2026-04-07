"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Star,
  ShoppingCart,
  ExternalLink,
  Search,
  Filter,
  TrendingUp,
  Package,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getProductsBySport,
  getCategoriesBySport,
  formatPrice,
  type Product,
  type ProductCategory,
} from "@/lib/store-products";

export default function StorePage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"featured" | "price-low" | "price-high" | "rating">("featured");

  const products = getProductsBySport(sport);
  const categories = getCategoriesBySport(sport);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Sort products
    switch (sortBy) {
      case "featured":
        filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Get featured products
  const featuredProducts = products.filter((p) => p.featured);

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className={cn("relative overflow-hidden", primaryBgClass)}>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <Badge variant="outline" className={cn("mb-4", primaryBorderClass, primaryTextClass)}>
              <Package className="w-3 h-3 mr-1" />
              Affiliate Store
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {sportName} Equipment Store
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Discover professional-grade {sportName.toLowerCase()} equipment from trusted brands.
              Quality gear for beginners to tournament champions.
            </p>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/20 dark:bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/20 dark:bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Featured Products */}
        {featuredProducts.length > 0 && !searchQuery && !selectedCategory && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className={cn("w-5 h-5", primaryTextClass)} />
              <h2 className="text-xl font-semibold text-foreground">Featured Products</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredProducts.slice(0, 3).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFeatured
                  primaryClass={primaryClass}
                  primaryTextClass={primaryTextClass}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${sportName.toLowerCase()} equipment...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={selectedCategory === null ? primaryClass : ""}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className={selectedCategory === cat.id ? primaryClass : ""}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
          {selectedCategory && ` in ${categories.find((c) => c.id === selectedCategory)?.name}`}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                primaryClass={primaryClass}
                primaryTextClass={primaryTextClass}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* Affiliate Disclosure */}
        <div className="mt-12 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Affiliate Disclosure:</strong> This store contains affiliate links. When you purchase through
            these links, VALORHIVE may earn a commission at no extra cost to you. This helps support our
            tournament platform and community.
          </p>
        </div>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  isFeatured = false,
  primaryClass,
  primaryTextClass,
}: {
  product: Product;
  isFeatured?: boolean;
  primaryClass: string;
  primaryTextClass: string;
}) {
  return (
    <Card className={cn("overflow-hidden group hover:shadow-lg transition-shadow", isFeatured && "ring-2 ring-amber-200 dark:ring-amber-700/50")}>
      {/* Product Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.featured && (
          <Badge className="absolute top-2 left-2 bg-amber-500 text-white">
            <Star className="w-3 h-3 mr-1" />
            Featured
          </Badge>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="destructive">Out of Stock</Badge>
          </div>
        )}
        {product.originalPrice && (
          <Badge className="absolute top-2 right-2 bg-red-500 text-white">
            {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Brand & Category */}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {product.brand}
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">
            {product.category}
          </Badge>
        </div>

        {/* Product Name */}
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-3.5 h-3.5",
                  star <= Math.floor(product.rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted"
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating} ({product.reviews})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className={cn("text-lg font-bold", primaryTextClass)}>
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* Buy Button */}
        <Button
          className={cn("w-full", primaryClass)}
          disabled={!product.inStock}
          onClick={() => window.open(product.affiliateUrl, "_blank")}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {product.inStock ? "Buy Now" : "Out of Stock"}
          <ExternalLink className="w-3 h-3 ml-2" />
        </Button>

        {/* Stock Status */}
        {product.inStock && (
          <div className="flex items-center justify-center gap-1 mt-2 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            In Stock - Fast Delivery
          </div>
        )}
      </CardContent>
    </Card>
  );
}
