import * as pulumi from "@pulumi/pulumi";
import { logger } from "./lib/logger";

const config = new pulumi.Config();
export const minSize = config.getNumber("minSize") ?? 1;
export const desiredCapacity = config.getNumber("desiredCapacity") ?? 2;
export const maxSize = config.getNumber("maxSize") ?? 4;
export const cpuTarget = config.getNumber("cpuTarget") ?? 60;
export const instanceType = config.get("instanceType") ?? "t2.micro";

if (
  ![minSize, desiredCapacity, maxSize].every(Number.isInteger) ||
  minSize < 1 ||
  minSize > desiredCapacity ||
  desiredCapacity > maxSize ||
  maxSize > 4
) {
  throw new Error("Use integers satisfying 1 <= minSize <= desiredCapacity <= maxSize <= 4.");
}

if (!Number.isFinite(cpuTarget) || cpuTarget <= 0 || cpuTarget > 100) {
  throw new Error("cpuTarget must be greater than 0 and less than or equal to 100.");
}

export const tags = { Project: pulumi.getProject(), Stack: pulumi.getStack() };

logger.info(
  "config",
  `Stack: ${pulumi.getStack()} | Capacity: ${minSize}/${desiredCapacity}/${maxSize} (min/initial/max) | CPU target: ${cpuTarget}%`,
);
