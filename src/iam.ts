import * as aws from "@pulumi/aws";
import { tags } from "./config";
import { logger } from "./lib/logger";

logger.info("iam", "Configuring EC2 permissions for Systems Manager Session Manager access.");

// Create a role that EC2 instances can assume to communicate with Systems Manager.
const instanceRole = new aws.iam.Role("web-ssm-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ec2.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  tags,
});

// Grant the SSM Agent the permissions required to register instances and establish sessions.
const ssmPolicyAttachment = new aws.iam.RolePolicyAttachment("web-ssm-policy", {
  role: instanceRole.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
});

// Expose the role through an instance profile that the Launch Template can assign to EC2 instances.
// Attach SSM permissions before creating the profile used by new instances.
export const instanceProfile = new aws.iam.InstanceProfile(
  "web-instance-profile",
  {
    role: instanceRole.name,
    tags,
  },
  { dependsOn: [ssmPolicyAttachment] },
);
