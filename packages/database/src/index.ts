import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Configure Prisma Client with environment-specific settings
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

// Keep the connection alive in development
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export * from "@prisma/client";
