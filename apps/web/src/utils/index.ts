// Sleep utility
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// URL and tracking utilities
export const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) {
    console.warn("NEXT_PUBLIC_APP_URL is not set, using fallback URL");
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL;
    }
    return process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://app.zkmail.io";
  }
  return url;
};
