import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : process.env.LOG_LEVEL === "debug"
          ? ["query", "error", "warn"]
          : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

// Re-export all Prisma types
export * from "@prisma/client";
