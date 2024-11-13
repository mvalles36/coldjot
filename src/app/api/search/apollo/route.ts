import { auth } from "@/auth";
import { saveToFile } from "@/lib/utils";
import { NextResponse } from "next/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = "https://api.apollo.io/api/v1";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { domain, role } = await request.json();

    // const response = await fetch(`${APOLLO_API_URL}/people/match`, {
    //   method: "POST",
    //   headers: {
    //     accept: "application/json",
    //     "Cache-Control": "no-cache",
    //     "Content-Type": "application/json",
    //     "x-api-key": APOLLO_API_KEY,
    //   },
    //   body: JSON.stringify({
    //     domain: domain,
    //     reveal_personal_emails: true,
    //     reveal_phone_number: false,
    //     organization_titles: role ? [role] : undefined,
    //   }),
    // });

    // const url = 'https://api.apollo.io/api/v1/mixed_people/search?q_organization_domains=depexel.com';

    const response = await fetch(`${APOLLO_API_URL}/mixed_people/search`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_organization_domains: domain,
        reveal_personal_emails: true,
        // reveal_phone_number: false,
        organization_titles: role ? [role] : undefined,
      }),
    });

    console.log("Apollo API Response:", response);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Apollo API Error:", errorData);
      throw new Error("Apollo API request failed");
    }

    const data = await response.json();
    saveToFile("./json/apollo-response.json", data);
    console.log("Apollo API Data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Apollo search failed:", error);
    return NextResponse.json(
      { error: "Failed to search contacts" },
      { status: 500 }
    );
  }
}
