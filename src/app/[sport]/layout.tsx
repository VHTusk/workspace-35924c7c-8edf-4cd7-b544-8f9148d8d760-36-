import SportHeader from "@/components/layout/sport-header";

export default async function SportLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const themeClass = isCornhole ? "theme-cornhole" : "theme-darts";

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const sportBadgeClass = isCornhole ? "border-green-500 text-green-600" : "border-teal-500 text-teal-600";

  // Pass icon names as strings, not component references
  const navigation = [
    { icon: "Home", label: "Home", href: `/${sport}` },
    { icon: "Trophy", label: "Tournaments", href: `/${sport}/tournaments` },
    { icon: "TrendingUp", label: "Leaderboard", href: `/${sport}/leaderboard` },
    { icon: "ShoppingBag", label: "Store", href: `/${sport}/store` },
    { icon: "BookOpen", label: "Rules", href: `/${sport}/rules` },
  ];

  return (
    <div className={`flex min-h-screen flex-col ${themeClass}`}>
      {/* Header with client-side auth */}
      <SportHeader
        sport={sport}
        sportName={sportName}
        primaryBtnClass={primaryBtnClass}
        sportBadgeClass={sportBadgeClass}
        navigation={navigation}
      />

      {/* Main Content */}
      <main id="main-content" className="flex-1 pt-16">
        {children}
      </main>
    </div>
  );
}
