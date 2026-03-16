import { NextResponse } from "next/server";
import crypto from "crypto";

const HMAC_SECRET = process.env.AT_HMAC_SECRET || "";

const DEMO_USER = {
  id: "user-1",
  email: "demo@nexuscrm.com",
  name: "Demo User",
};

export async function GET() {
  if (!HMAC_SECRET) {
    return NextResponse.json({ error: "HMAC secret not configured" }, { status: 500 });
  }

  const hmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(DEMO_USER.id)
    .digest("hex");

  return NextResponse.json({
    ...DEMO_USER,
    hmac,
  });
}
