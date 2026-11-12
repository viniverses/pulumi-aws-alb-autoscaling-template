import * as aws from "@pulumi/aws";
import { tags } from "./config";
import { logger } from "./lib/logger";

logger.info(
  "network",
  "Configuring a dedicated VPC and two public subnets across availability zones.",
);

const zoneNames = aws.getAvailabilityZonesOutput({ state: "available" }).names.apply((names) => {
  if (names.length < 2) {
    throw new Error("This template requires two availability zones in the selected region.");
  }
  return names.slice(0, 2);
});

// Create a dedicated VPC to isolate the template resources without relying on the default VPC.
// Enable DNS support and hostnames so instances can resolve names within the network.
export const vpc = new aws.ec2.Vpc("lab-vpc", {
  cidrBlock: "10.42.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags,
});

// Attach an Internet Gateway to the VPC to support internet access for the public ALB
// and outbound connections from EC2 instances with public IPv4 addresses.
const internetGateway = new aws.ec2.InternetGateway("pulumi-igw", { vpcId: vpc.id, tags });

// Create a shared route table that sends traffic outside the VPC to the Internet Gateway.
// Subnets become public when this table is associated with them.
const publicRoutes = new aws.ec2.RouteTable("public-routes", {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: internetGateway.id }],
  tags,
});

// Create one public subnet in each of two availability zones for the ALB and EC2 instances.
// Assign public IPv4 addresses to instances so they can download packages without a NAT Gateway.
export const subnets = [0, 1].map(
  (index) =>
    new aws.ec2.Subnet(`public-${index + 1}`, {
      vpcId: vpc.id,
      cidrBlock: `10.42.${index + 1}.0/24`,
      availabilityZone: zoneNames.apply((names) => names[index]),
      mapPublicIpOnLaunch: true,
      tags,
    }),
);

// Associate each subnet with the public route table so its resources can use the Internet Gateway.
export const routeAssociations = subnets.map(
  (subnet, index) =>
    new aws.ec2.RouteTableAssociation(`public-route-${index + 1}`, {
      subnetId: subnet.id,
      routeTableId: publicRoutes.id,
    }),
);
