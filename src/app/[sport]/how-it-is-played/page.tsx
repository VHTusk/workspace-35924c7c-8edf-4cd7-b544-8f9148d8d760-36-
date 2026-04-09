import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SportGuide = {
  title: string;
  intro: string;
  setup: string[];
  positions: string[];
  scoring: string[];
  format: string[];
  notes: string[];
};

const guides: Record<string, SportGuide> = {
  cornhole: {
    title: "Cornhole Rules and Playing Positions",
    intro:
      "Cornhole is played by throwing bags at the opposite board. Tournament scoring, side positions, and match flow stay structured so every official result can be recorded cleanly.",
    setup: [
      "Two boards are placed facing each other on level ground.",
      "Standard tournament distance is 27 feet from front edge to front edge.",
      "Each player or team uses four bags of one color.",
      "The foul line is the front edge of the board.",
    ],
    positions: [
      "Singles: both players stand at opposite boards and throw toward each other.",
      "Doubles: partners stand at opposite boards and alternate throws.",
      "Players stay in their assigned lane for the full frame unless officials direct otherwise.",
      "A throw must be released before crossing the foul line.",
    ],
    scoring: [
      "Bag through the hole: 3 points.",
      "Bag resting on the board at the end of the frame: 1 point.",
      "Cancellation scoring applies, so only the point difference is added each frame.",
      "Most formats play to 21 points unless the event briefing states otherwise.",
    ],
    format: [
      "Players or teams alternate throws until all eight bags are played.",
      "The next frame begins from the opposite board.",
      "Tournament matches may be single game, best-of series, or bracket rounds depending on the event.",
    ],
    notes: [
      "Foot faults, time limits, and conduct rules are controlled by the tournament director.",
      "Official match result entry on ValorHive follows the final tournament scorecard.",
    ],
  },
  darts: {
    title: "Darts Rules and Playing Positions",
    intro:
      "Darts is played from a fixed throwing line toward a regulation dartboard. Competitive matches use defined scoring formats so rankings and results stay consistent.",
    setup: [
      "A regulation dartboard is mounted with the bullseye centered at 5 ft 8 in from the floor.",
      "The throwing line, or oche, is 7 ft 9.25 in from the face of the board.",
      "Players throw in turns of three darts.",
      "Tournament areas keep the throw lane clear for the active player.",
    ],
    positions: [
      "Only the active player stands at the oche during a turn.",
      "Opponents wait behind the marked play area until the turn is complete.",
      "The player must not step over the oche while throwing.",
      "Darts are retrieved only after the turn is scored.",
    ],
    scoring: [
      "Score is based on the number segment hit and whether it lands in single, double, or treble.",
      "Most competitive formats use 501 with double-out unless the event specifies another format.",
      "Bust rules apply when a player reduces below the required finish condition.",
      "The match winner is determined by legs or sets based on the tournament format.",
    ],
    format: [
      "A turn consists of up to three darts.",
      "Players alternate turns until one player completes the required finish.",
      "Tournament matches may use round robin, knockout, or bracket-based progression.",
    ],
    notes: [
      "Exact leg, set, and finish conditions are confirmed in the tournament brief.",
      "Only officially recorded match outcomes count toward ValorHive rankings.",
    ],
  },
};

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function HowItIsPlayedPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const guide = guides[sport] ?? guides.cornhole;
  const isCornhole = sport === "cornhole";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section
        className={cn(
          "rounded-2xl border px-5 py-6 shadow-sm md:px-8 md:py-8",
          isCornhole
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-cyan-200 bg-cyan-50/60",
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "border-current/30",
              isCornhole ? "text-emerald-700" : "text-cyan-700",
            )}
          >
            How it is played?
          </Badge>
          <Badge variant="secondary">{sport.toUpperCase()}</Badge>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-4xl">
          {guide.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {guide.intro}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <GuideSection title="Setup" items={guide.setup} />
        <GuideSection title="Player Positions" items={guide.positions} />
        <GuideSection title="Scoring" items={guide.scoring} />
        <GuideSection title="Match Format" items={guide.format} />
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {guide.notes.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
