import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateOrgSession } from "@/lib/auth";
import {
  listCorporateDepartments,
  parseCorporateSport,
} from "@/lib/corporate-departments";

// GET: List all departments for an organization with employee counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const { orgId } = await params;

    // Validate user has access to this org
    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only CORPORATE organizations have departments
    if (session.org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Only corporate organizations have departments" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sport = parseCorporateSport(searchParams.get("sport"));

    if (!sport) {
      return NextResponse.json({ error: "Valid sport parameter required" }, { status: 400 });
    }

    const departments = await listCorporateDepartments(orgId, sport);

    // Calculate summary stats
    const summary = {
      totalDepartments: departments.length,
      totalEmployees: departments.reduce((sum, d) => sum + d.totalEmployees, 0),
      totalActivePlayers: departments.reduce((sum, d) => sum + d.activePlayers, 0),
      totalPoints: departments.reduce((sum, d) => sum + d.totalPoints, 0),
    };

    return NextResponse.json({
      success: true,
      departments,
      summary,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new department
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    const { orgId } = await params;

    // Validate user has access to this org
    if (session.org.id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only CORPORATE organizations have departments
    if (session.org.type !== "CORPORATE") {
      return NextResponse.json({ error: "Only corporate organizations have departments" }, { status: 400 });
    }

    return NextResponse.json({
      error:
        "Departments are derived from employee records in the current system. Add employees with a department name to create a department.",
    }, { status: 400 });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
