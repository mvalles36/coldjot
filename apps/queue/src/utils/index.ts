export * from "./email";

// Sleep utility
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// URL and tracking utilities
export const getAppBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) {
    console.warn("NEXT_PUBLIC_APP_URL is not set, using fallback URL");
    console.log("process.env.PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL;
    }
    return process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://app.mailjot.com";
  }
  return url;
};
