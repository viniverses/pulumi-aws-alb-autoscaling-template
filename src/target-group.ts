import * as aws from "@pulumi/aws";
import { tags } from "./config";
import { vpc } from "./network";

// Create the pool of EC2 targets that receive HTTP traffic from the ALB on port 80.
// Check the Apache home page for HTTP 200 responses and allow 30 seconds for connection draining.
export const targetGroup = new aws.lb.TargetGroup("web-targets", {
  vpcId: vpc.id,
  port: 80,
  protocol: "HTTP",
  targetType: "instance",
  deregistrationDelay: 30,
  healthCheck: {
    enabled: true,
    path: "/",
    port: "traffic-port",
    protocol: "HTTP",
    matcher: "200",
    interval: 5,
    timeout: 2,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
  },
  tags,
});
