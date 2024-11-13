import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import fs from "fs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function saveToFile(filePath: string, data: any) {
  if (process.env.NODE_ENV === "development") {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }
  return;
}
