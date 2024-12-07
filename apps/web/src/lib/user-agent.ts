import { NextRequest } from "next/server";
// import UAParser from "ua-parser-js";
import { UAParser } from "ua-parser-js";

interface UserAgentInfo {
  browser: string;
  device: string;
  os: string;
  userAgent: string;
}

export function getUserAgent(req: NextRequest): UserAgentInfo {
  const userAgent = req.headers.get("user-agent") || "";
  const { browser, os, device } = UAParser(userAgent);

  return {
    browser: browser.name || "unknown",
    device: device.type || "desktop",
    os: os.name || "unknown",
    userAgent,
  };
}
