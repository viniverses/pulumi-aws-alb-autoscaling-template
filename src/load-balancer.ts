import * as aws from "@pulumi/aws";
import { logger } from "./lib/logger";
import { tags } from "./config";
import { subnets, routeAssociations } from "./network";
import { albSecurityGroup } from "./security-group";
import { targetGroup } from "./target-group";

logger.info(
  "load-balancer",
  "Configuring the public HTTP listener and forwarding traffic to the target group.",
);

// Create an internet-facing Application Load Balancer across both public subnets.
// Wait for the subnet route associations so the ALB has internet connectivity.
export const alb = new aws.lb.LoadBalancer(
  "web-alb",
  {
    loadBalancerType: "application",
    internal: false,
    securityGroups: [albSecurityGroup.id],
    subnets: subnets.map((subnet) => subnet.id),
    tags,
  },
  { dependsOn: routeAssociations },
);

// Accept HTTP requests on port 80 and forward them to healthy EC2 targets in the target group.
export const listener = new aws.lb.Listener("http", {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [{ type: "forward", targetGroupArn: targetGroup.arn }],
  tags,
});
