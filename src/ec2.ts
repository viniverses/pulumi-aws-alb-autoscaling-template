import * as aws from "@pulumi/aws";
import { readFileSync } from "node:fs";
import { instanceType, tags } from "./config";
import { instanceSecurityGroup } from "./security-group";
import { logger } from "./lib/logger";
import { instanceProfile } from "./iam";

// Resolve the official x86_64 AMI for the region using an AWS public parameter.
const ami = aws.ssm.getParameterOutput({
  name: "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64",
});

// Pulumi runs the program from the project directory.
const userData = readFileSync("src/data/ec2-user-data.sh", "utf8");
logger.info(
  "ec2",
  `Configuring the ${instanceType} launch template with Apache user data and required IMDSv2.`,
);

// Define how the ASG launches EC2 instances, including the AMI, instance type, and security group.
// Bootstrap Apache with user data, require IMDSv2, and use an encrypted root volume deleted on termination.
export const launchTemplate = new aws.ec2.LaunchTemplate("web-template", {
  imageId: ami.value,
  instanceType,
  iamInstanceProfile: { arn: instanceProfile.arn },
  vpcSecurityGroupIds: [instanceSecurityGroup.id],
  userData: Buffer.from(userData).toString("base64"),
  metadataOptions: { httpEndpoint: "enabled", httpTokens: "required" },
  monitoring: { enabled: true },
  blockDeviceMappings: [
    {
      deviceName: "/dev/xvda",
      ebs: {
        volumeSize: 8,
        volumeType: "gp3",
        encrypted: "true",
        deleteOnTermination: "true",
      },
    },
  ],
  tagSpecifications: [{ resourceType: "instance", tags: { ...tags, Name: "pulumi-web" } }],
  tags,
});
