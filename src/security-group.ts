import * as aws from "@pulumi/aws";
import { tags } from "./config";
import { vpc } from "./network";

// Allow public HTTP requests to the ALB and outbound HTTP traffic to targets within the VPC.
export const albSecurityGroup = new aws.ec2.SecurityGroup("alb-sg", {
  vpcId: vpc.id,
  description: "Public HTTP access to the ALB",
  ingress: [{ protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] }],
  egress: [{ protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: [vpc.cidrBlock] }],
  tags,
});

// Allow incoming HTTP only from the ALB security group, preventing direct public access to Apache.
// Allow outbound traffic for package installation; no inbound SSH rule is added.
export const instanceSecurityGroup = new aws.ec2.SecurityGroup("web-sg", {
  vpcId: vpc.id,
  description: "HTTP access from the ALB only, without public SSH access",
  ingress: [{ protocol: "tcp", fromPort: 80, toPort: 80, securityGroups: [albSecurityGroup.id] }],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
  tags,
});
