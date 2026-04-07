import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

// Initialize ZAI instance (reuse across requests)
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Intent detection patterns
const INTENT_PATTERNS = {
  refund: /refund|money back|payment return|reimbursement|cancel.*payment/i,
  match: /match|game|when.*play|schedule|next.*match|court|time.*match/i,
  kyc: /kyc|verification|document|verify|aadhaar|pan|id.*proof/i,
  tournament: /tournament|competition|event|register|join.*tournament/i,
  leaderboard: /leaderboard|ranking|rank|position|top.*player/i,
  subscription: /subscription|plan|upgrade|renew|expire|payment/i,
  dispute: /dispute|complaint|issue|problem|report|wrong.*score/i,
  help: /help|support|assist|how.*do|what.*is|guide|tutorial/i,
};

// System prompt for VALORHIVE assistant
const SYSTEM_PROMPT = `You are VALORHIVE Support Assistant, a helpful AI for a multi-sport tournament platform in India. You help players and organizers with:

KEY AREAS:
1. Refunds & Payments - Check status, explain policies (Refund Engine v3.49.0)
2. Match Schedules - Tournament brackets, court assignments, check-ins (Venue Flow v3.47.0)
3. KYC Verification - Document requirements, verification status (KYC Layer v3.65.0)
4. Tournaments - Registration, brackets, scoring, results
5. Leaderboards - Rankings, points, ELO ratings
6. Corporate Dashboard - Employee linking, departments, analytics (v3.67.0)
7. Admin Hierarchy - Explain roles from Super Admin to Tournament Director (v3.46.0)

IMPORTANT RULES:
- Be concise but helpful (max 150 words unless asked for details)
- If you don't know specific user data, guide them to check their dashboard
- For payment issues, always mention the Refund Policy and timeline
- For live venue issues, recommend contacting the Tournament Director
- Never display full KYC document numbers (only last 4 digits)
- Escalate to human support if issue is complex or involves money disputes
- Use Indian Rupee (Rs.) for currency
- Be friendly but professional

RESPONSE FORMAT:
- Use bullet points for lists
- Include relevant links when helpful: /dashboard, /tournaments, /help
- Mention specific system versions when relevant (e.g., "Refund Engine v3.49.0")
- If user seems frustrated, acknowledge and offer to escalate

CURRENT CONTEXT:
- Platform: VALORHIVE (Multi-sport tournament platform)
- Sports: Cornhole, Darts
- Region: India
- Today's date: ${new Date().toLocaleDateString('en-IN')}`;

// Detect intent from user message
function detectIntent(message: string): { intent: string; confidence: number } {
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(message)) {
      return { intent, confidence: 0.8 };
    }
  }
  return { intent: "general", confidence: 0.5 };
}

// Get contextual data based on intent
async function getContextualData(intent: string, _userId?: string, _orgId?: string): Promise<string> {
  let context = "";

  try {
    switch (intent) {
      case "refund":
        context += "\nRefund Policy: Full refund within 24h of payment, 50% within 48h, no refund after tournament starts.";
        break;

      case "match":
        // In production, you would check user's upcoming matches
        break;

      case "kyc":
        context += "\nKYC documents accepted: Aadhaar Card, PAN Card, Passport, Voter ID.";
        context += "\nOCR confidence threshold: 85% for auto-approval, below requires manual review.";
        break;

      case "tournament":
        try {
          const activeTournaments = await db.tournament.findMany({
            where: { status: "REGISTRATION_OPEN", isPublic: true },
            take: 5,
            orderBy: { startDate: "asc" },
            select: { name: true, startDate: true, city: true },
          });
          if (activeTournaments.length > 0) {
            context += `\nOpen tournaments: ${activeTournaments.map(t => 
              `${t.name} (${t.city || 'TBD'}) - ${t.startDate.toLocaleDateString()}`
            ).join(', ')}`;
          }
        } catch {
          // Ignore database errors for context
        }
        break;

      case "leaderboard":
        context += "\nLeaderboard ranks players by ELO rating. Points earned for match wins and tournament placements.";
        break;
    }
  } catch (error) {
    console.error("Error getting contextual data:", error);
  }

  return context;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Detect intent
    const { intent, confidence } = detectIntent(message);

    // Get contextual data
    const contextData = await getContextualData(intent);

    // Build messages for AI
    const messages = [
      { role: "assistant" as const, content: SYSTEM_PROMPT + contextData },
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Get AI response
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content || 
      "I'm sorry, I couldn't process your request. Please try again or contact support@valorhive.com";

    // Determine data source
    let dataSource = "AI Knowledge Base";
    if (contextData) {
      dataSource = "Live System Data";
    }

    return NextResponse.json({
      success: true,
      response,
      intent,
      confidence,
      dataSource,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process message",
        response: "I'm having trouble right now. Please try again in a moment or contact support@valorhive.com",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for chat session info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  return NextResponse.json({
    success: true,
    sessionId: sessionId || null,
    status: "ready",
    features: [
      "refund_status",
      "match_schedule",
      "kyc_verification",
      "tournament_info",
      "leaderboard",
      "subscription",
      "general_help",
    ],
  });
}
