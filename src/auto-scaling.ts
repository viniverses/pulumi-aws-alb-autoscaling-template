import * as aws from "@pulumi/aws";
import { minSize, desiredCapacity, maxSize, cpuTarget, tags } from "./config";
import { subnets, routeAssociations } from "./network";
import { listener } from "./load-balancer";
import { targetGroup } from "./target-group";
import { launchTemplate } from "./ec2";
import { logger } from "./lib/logger";

logger.info(
  "auto-scaling",
  `Configuring ELB health checks and CPU target tracking at ${cpuTarget}% within ${minSize}-${maxSize} instances.`,
);

// Create an ASG that launches instances across both subnets within the configured capacity limits.
// Register instances with the target group automatically and replace unhealthy instances using ELB checks.
export const autoScalingGroup = new aws.autoscaling.Group(
  "web-asg",
  {
    minSize,
    desiredCapacity,
    maxSize,
    vpcZoneIdentifiers: subnets.map((subnet) => subnet.id),
    targetGroupArns: [targetGroup.arn],
    launchTemplate: {
      id: launchTemplate.id,
      version: launchTemplate.latestVersion.apply(String),
    },
    healthCheckType: "ELB",
    healthCheckGracePeriod: 300,
    defaultInstanceWarmup: 180,
    minElbCapacity: minSize,
    waitForCapacityTimeout: "15m",
    instanceRefresh: {
      strategy: "Rolling",
      preferences: {
        minHealthyPercentage: 0,
        maxHealthyPercentage: 100,
        instanceWarmup: "180",
      },
    },
    tags: Object.entries(tags).map(([key, value]) => ({ key, value, propagateAtLaunch: true })),
  },
  {
    dependsOn: [listener, ...routeAssociations],
    // The scaling policy controls desired capacity after creation.
    ignoreChanges: ["desiredCapacity"],
  },
);

// Adjust the ASG's desired capacity to keep average CPU utilization near the configured target.
// Respect the group's minimum and maximum sizes and allow new instances time to warm up.
new aws.autoscaling.Policy("cpu-target", {
  autoscalingGroupName: autoScalingGroup.name,
  policyType: "TargetTrackingScaling",
  estimatedInstanceWarmup: 180,
  targetTrackingConfiguration: {
    predefinedMetricSpecification: { predefinedMetricType: "ASGAverageCPUUtilization" },
    targetValue: cpuTarget,
  },
});
