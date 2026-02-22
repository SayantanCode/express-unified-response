// src/utils/logger.ts
import chalk from "chalk";

export const internalLogger = {
  // Use this for "Developer Experience" logs that shouldn't show in prod
  debug: (msg: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`${chalk.gray("[debug]")} ${msg}`);
    }
  },
  info: (msg: string) => console.log(`${chalk.cyan("info")} - ${msg}`),
  warn: (msg: string) => console.warn(`${chalk.yellow("warn")} - ${msg}`),
  error: (msg: string) => console.error(`${chalk.red("error")} - ${msg}`),

  // This helps with the adapter safety we built
  adapterError: (adapterName: string, err: any) => {
    console.error(
      `${chalk.bgRed.white(" ADAPTER ERROR ")} ${chalk.red(`Error in [${adapterName}]:`)}`,
      err,
    );
  },
};
