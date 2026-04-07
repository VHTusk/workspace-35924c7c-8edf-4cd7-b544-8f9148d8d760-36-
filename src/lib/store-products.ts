// Store Products Data - Affiliate Equipment for Cornhole and Darts

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  brand: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  affiliateUrl: string;
  featured?: boolean;
  tags: string[];
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Cornhole Products
export const cornholeCategories: ProductCategory[] = [
  { id: "boards", name: "Cornhole Boards", description: "Professional and recreational boards", icon: "🎯" },
  { id: "bags", name: "Cornhole Bags", description: "ACL approved and practice bags", icon: "🛍️" },
  { id: "accessories", name: "Accessories", description: "Scoreboards, lights, and more", icon: "⚡" },
  { id: "apparel", name: "Apparel", description: "Cornhole themed clothing", icon: "👕" },
];

export const cornholeProducts: Product[] = [
  // Boards
  {
    id: "cornhole-board-1",
    name: "ACL Pro Series Cornhole Boards",
    description: "Official ACL tournament-approved boards with premium birch wood construction. Regulation 24\" x 48\" size with smooth playing surface.",
    price: 29999,
    originalPrice: 34999,
    image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400",
    category: "boards",
    brand: "CornholePro",
    rating: 4.9,
    reviews: 128,
    inStock: true,
    affiliateUrl: "https://amazon.in/cornhole-boards",
    featured: true,
    tags: ["tournament", "professional", "ACL approved"],
  },
  {
    id: "cornhole-board-2",
    name: "Premium Tailgate Boards Set",
    description: "Portable cornhole boards perfect for tailgating and backyard fun. All-weather construction with carrying case included.",
    price: 12999,
    originalPrice: 15999,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    category: "boards",
    brand: "TailgateKing",
    rating: 4.6,
    reviews: 89,
    inStock: true,
    affiliateUrl: "https://amazon.in/tailgate-boards",
    tags: ["portable", "outdoor", "beginner"],
  },
  {
    id: "cornhole-board-3",
    name: "LED Light-Up Cornhole Boards",
    description: "Play day or night with integrated LED lighting system. Remote controlled with multiple color modes.",
    price: 24999,
    image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400",
    category: "boards",
    brand: "NightOwl",
    rating: 4.7,
    reviews: 56,
    inStock: true,
    affiliateUrl: "https://amazon.in/led-cornhole",
    featured: true,
    tags: ["LED", "night play", "premium"],
  },

  // Bags
  {
    id: "cornhole-bag-1",
    name: "ACL Pro Cornhole Bags (Set of 8)",
    description: "Official ACL approved bags with dual-sided design. One side fast, one side slow for perfect control.",
    price: 4999,
    originalPrice: 5999,
    image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400",
    category: "bags",
    brand: "BagMaster",
    rating: 4.9,
    reviews: 234,
    inStock: true,
    affiliateUrl: "https://amazon.in/pro-cornhole-bags",
    featured: true,
    tags: ["ACL approved", "professional", "dual-sided"],
  },
  {
    id: "cornhole-bag-2",
    name: "All-Weather Resin Bags",
    description: "Waterproof resin-filled bags that won't get waterlogged. Perfect for outdoor tournaments.",
    price: 3499,
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
    category: "bags",
    brand: "AllWeather",
    rating: 4.5,
    reviews: 167,
    inStock: true,
    affiliateUrl: "https://amazon.in/weatherproof-bags",
    tags: ["waterproof", "outdoor", "resin"],
  },
  {
    id: "cornhole-bag-3",
    name: "Beginner Practice Bag Set",
    description: "Perfect for beginners learning the game. Soft feel and forgiving design for developing skills.",
    price: 1999,
    image: "https://images.unsplash.com/photo-1553531889-e6cf4d692b1b?w=400",
    category: "bags",
    brand: "StarterPro",
    rating: 4.3,
    reviews: 98,
    inStock: true,
    affiliateUrl: "https://amazon.in/practice-bags",
    tags: ["beginner", "practice", "affordable"],
  },

  // Accessories
  {
    id: "cornhole-acc-1",
    name: "Digital Score Tower",
    description: "Professional scoreboard with LED display. Keeps track of scores for both teams with easy reset.",
    price: 2999,
    image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400",
    category: "accessories",
    brand: "ScoreKeeper",
    rating: 4.7,
    reviews: 145,
    inStock: true,
    affiliateUrl: "https://amazon.in/score-tower",
    tags: ["scoreboard", "digital", "tournament"],
  },
  {
    id: "cornhole-acc-2",
    name: "Cornhole Board Lights Kit",
    description: "LED strip lights that attach to any cornhole board. 16 color modes with remote control.",
    price: 1499,
    originalPrice: 1999,
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400",
    category: "accessories",
    brand: "GlowGear",
    rating: 4.4,
    reviews: 78,
    inStock: true,
    affiliateUrl: "https://amazon.in/board-lights",
    tags: ["LED", "night play", "universal"],
  },
  {
    id: "cornhole-acc-3",
    name: "Board Maintenance Kit",
    description: "Complete kit for maintaining your boards. Includes wax, polish, and cleaning supplies.",
    price: 999,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    category: "accessories",
    brand: "BoardCare",
    rating: 4.2,
    reviews: 45,
    inStock: true,
    affiliateUrl: "https://amazon.in/board-maintenance",
    tags: ["maintenance", "care", "essential"],
  },

  // Apparel
  {
    id: "cornhole-apparel-1",
    name: "Pro Player Jersey",
    description: "Breathable athletic jersey designed for cornhole tournaments. Moisture-wicking fabric with team customization.",
    price: 1999,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
    category: "apparel",
    brand: "CornholeWear",
    rating: 4.5,
    reviews: 67,
    inStock: true,
    affiliateUrl: "https://amazon.in/cornhole-jersey",
    tags: ["jersey", "tournament", "athletic"],
  },
];

// Darts Products
export const dartsCategories: ProductCategory[] = [
  { id: "darts", name: "Darts", description: "Steel and soft tip darts", icon: "🎯" },
  { id: "boards", name: "Dartboards", description: "Bristle and electronic boards", icon: "🎯" },
  { id: "flights", name: "Flights & Shafts", description: "Customization parts", icon: "✨" },
  { id: "accessories", name: "Accessories", description: "Cases, mats, and lighting", icon: "⚡" },
];

export const dartsProducts: Product[] = [
  // Darts
  {
    id: "dart-1",
    name: "Professional Tungsten Darts (24g)",
    description: "90% tungsten barrel darts with precision grip. Used by PDC professionals worldwide.",
    price: 5999,
    originalPrice: 7499,
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400",
    category: "darts",
    brand: "DartPro",
    rating: 4.9,
    reviews: 312,
    inStock: true,
    affiliateUrl: "https://amazon.in/pro-tungsten-darts",
    featured: true,
    tags: ["tungsten", "professional", "PDC"],
  },
  {
    id: "dart-2",
    name: "Steel Tip Dart Set (22g)",
    description: "Beginner-friendly steel tip darts with brass barrels. Perfect for learning the game.",
    price: 1499,
    image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400",
    category: "darts",
    brand: "StarterDarts",
    rating: 4.4,
    reviews: 189,
    inStock: true,
    affiliateUrl: "https://amazon.in/steel-tip-darts",
    tags: ["beginner", "steel tip", "affordable"],
  },
  {
    id: "dart-3",
    name: "Soft Tip Electronic Darts (18g)",
    description: "Lightweight soft tip darts designed for electronic dartboards. Includes spare tips.",
    price: 2499,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
    category: "darts",
    brand: "SoftThrow",
    rating: 4.6,
    reviews: 156,
    inStock: true,
    affiliateUrl: "https://amazon.in/soft-tip-darts",
    tags: ["soft tip", "electronic", "indoor"],
  },

  // Dartboards
  {
    id: "dartboard-1",
    name: "Championship Bristle Dartboard",
    description: "Official tournament bristle dartboard with staple-free bullseye. Self-healing sisal fiber.",
    price: 8999,
    originalPrice: 10999,
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400",
    category: "boards",
    brand: "Winmau",
    rating: 4.9,
    reviews: 267,
    inStock: true,
    affiliateUrl: "https://amazon.in/bristle-dartboard",
    featured: true,
    tags: ["tournament", "bristle", "professional"],
  },
  {
    id: "dartboard-2",
    name: "Electronic Dartboard with LED Display",
    description: "Automatic scoring for up to 8 players. 40+ game variations with voice prompts.",
    price: 12999,
    image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400",
    category: "boards",
    brand: "ElectroDart",
    rating: 4.5,
    reviews: 134,
    inStock: true,
    affiliateUrl: "https://amazon.in/electronic-dartboard",
    tags: ["electronic", "LED", "multiplayer"],
  },
  {
    id: "dartboard-3",
    name: "Cabinet Dartboard Set",
    description: "Complete dartboard set with wooden cabinet. Includes darts, board, and storage.",
    price: 15999,
    originalPrice: 18999,
    image: "https://images.unsplash.com/photo-1553531889-e6cf4d692b1b?w=400",
    category: "boards",
    brand: "HomePro",
    rating: 4.7,
    reviews: 98,
    inStock: true,
    affiliateUrl: "https://amazon.in/cabinet-dartboard",
    tags: ["cabinet", "complete set", "home"],
  },

  // Flights & Shafts
  {
    id: "flight-1",
    name: "Pro Flights Pack (50 pcs)",
    description: "Premium polyester dart flights in assorted designs. Standard shape for consistent flight.",
    price: 999,
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
    category: "flights",
    brand: "FlightKing",
    rating: 4.6,
    reviews: 234,
    inStock: true,
    affiliateUrl: "https://amazon.in/dart-flights",
    tags: ["flights", "bulk", "assorted"],
  },
  {
    id: "flight-2",
    name: "Aluminum Shaft Set (10 pcs)",
    description: "Lightweight aluminum shafts with locking holes. Multiple length options available.",
    price: 799,
    image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400",
    category: "flights",
    brand: "ShaftPro",
    rating: 4.4,
    reviews: 145,
    inStock: true,
    affiliateUrl: "https://amazon.in/dart-shafts",
    tags: ["shafts", "aluminum", "locking"],
  },

  // Accessories
  {
    id: "dart-acc-1",
    name: "Dart Case (Holds 6 Sets)",
    description: "Hard shell carrying case with foam interior. Perfect for tournament players.",
    price: 1999,
    image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400",
    category: "accessories",
    brand: "DartCase",
    rating: 4.7,
    reviews: 89,
    inStock: true,
    affiliateUrl: "https://amazon.in/dart-case",
    tags: ["case", "storage", "tournament"],
  },
  {
    id: "dart-acc-2",
    name: "Throw Line Mat",
    description: "Official competition throw line mat with non-slip backing. 2.37m regulation distance.",
    price: 1499,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
    category: "accessories",
    brand: "ThrowLine",
    rating: 4.5,
    reviews: 67,
    inStock: true,
    affiliateUrl: "https://amazon.in/throw-line",
    tags: ["throw line", "regulation", "competition"],
  },
  {
    id: "dart-acc-3",
    name: "Dartboard Surround Ring",
    description: "Protects walls from stray darts. Easy to install with any dartboard.",
    price: 2499,
    image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=400",
    category: "accessories",
    brand: "WallGuard",
    rating: 4.6,
    reviews: 112,
    inStock: true,
    affiliateUrl: "https://amazon.in/dart-surround",
    tags: ["protection", "wall guard", "essential"],
  },
];

// Helper function to get products by sport
export function getProductsBySport(sport: string): Product[] {
  return sport === "cornhole" ? cornholeProducts : dartsProducts;
}

// Helper function to get categories by sport
export function getCategoriesBySport(sport: string): ProductCategory[] {
  return sport === "cornhole" ? cornholeCategories : dartsCategories;
}

// Helper function to format price in INR
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}
