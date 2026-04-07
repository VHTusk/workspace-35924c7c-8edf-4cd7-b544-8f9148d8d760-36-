import { Metadata } from "next";
import { TournamentListClient } from "./tournament-list-client";

export const metadata: Metadata = {
  title: "Tournaments | VALORHIVE",
  description: "Discover and follow Cornhole and Darts tournaments across India. View brackets, results, and more.",
  keywords: ["cornhole tournaments", "darts tournaments", "India sports", "tournament brackets"],
};

export default function TournamentsPage() {
  return <TournamentListClient />;
}
