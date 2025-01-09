export * from "./email";
import { AppUrlEnum, AppUrlType } from "@coldjot/types";
// Sleep utility
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getBaseUrl = (type: AppUrlType = AppUrlEnum.API) => {
  // API URL
  if (type === AppUrlEnum.API) {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.log("API URL", apiUrl);
      return "http://localhost:3001";
    }
    return apiUrl;
  }

  // TRACKING URL
  if (type === AppUrlEnum.TRACKING) {
    const trackingUrl = process.env.TRACK_API_URL;
    if (!trackingUrl) {
      console.log("TRACKING URL", trackingUrl);
      return "https://coldjot.loca.lt";
    }
    return trackingUrl;
  }

  // WEB URL
  const webAppUrl = process.env.WEB_APP_URL;

  if (!webAppUrl) {
    console.log("WEB APP URL", webAppUrl);
    return "http://localhost:3000";
  }
  return webAppUrl;
};
