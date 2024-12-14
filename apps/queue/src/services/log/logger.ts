import pino from "pino";
import { env } from "../../config";

export const logger = pino({
  level: env.LOG_LEVEL || "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "yyyy-mm-dd HH:MM:ss",
      // messageKey: "msg",
      // levelFirst: true,
      customLevels: "error:30,warn:40,info:50,debug:60,trace:70",
      customColors: "error:red,warn:yellow,info:blue,debug:green,trace:gray",
    },
  },
  timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
  formatters: {
    bindings: () => ({}),
    level: (label) => ({ level: label.toUpperCase() }),
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
2;
