import pino from "pino";
import { env } from "../../config";
import path from "path";

// Get the caller file name
const getCallerFile = () => {
  const err = new Error();
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = err.stack as unknown as NodeJS.CallSite[];
  Error.prepareStackTrace = undefined;

  // Find the first caller that isn't this file or pino
  const caller = stack.find((call) => {
    const fileName = call.getFileName();
    return (
      fileName &&
      !fileName.includes("logger.ts") &&
      !fileName.includes("node_modules/pino")
    );
  });

  return caller ? path.basename(caller.getFileName() || "") : "unknown";
};

// Create a fixed-width formatter for the file name
const formatFileName = (fileName: string) => {
  const maxWidth = 40; // Adjust this value based on your longest filename
  const dots = "-".repeat(maxWidth - fileName.length - 2); // -2 for the brackets
  return `${fileName} ${dots}`;
};

export const logger = pino({
  level: env.LOG_LEVEL || "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname,fileName,paddedFileName",
      translateTime: "yyyy-mm-dd HH:MM:ss",
      messageFormat: "{paddedFileName} {msg}",
      customLevels: "error:30,warn:40,info:50,debug:60,trace:70",
      customColors: "error:red,warn:yellow,info:blue,debug:green,trace:gray",
    },
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: () => ({}),
  },
  mixin() {
    const fileName = getCallerFile();
    return {
      fileName,
      paddedFileName: formatFileName(fileName),
    };
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
