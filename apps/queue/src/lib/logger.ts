import pino from "pino";
import { env } from "../config";

export const logger = pino({
  level: env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:standard",
    },
  },
  base: {
    env: env.NODE_ENV,
  },
});
