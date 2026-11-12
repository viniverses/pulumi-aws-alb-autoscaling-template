import * as pulumi from "@pulumi/pulumi";
import { minSize, desiredCapacity, maxSize } from "./config";
import { vpc, subnets } from "./network";
import { alb } from "./load-balancer";
import { targetGroup } from "./target-group";
import { autoScalingGroup } from "./auto-scaling";

export const url = pulumi.interpolate`http://${alb.dnsName}`;
export const loadBalancerDns = alb.dnsName;
export const targetGroupArn = targetGroup.arn;
export const autoScalingGroupName = autoScalingGroup.name;
export const vpcId = vpc.id;
export const subnetIds = subnets.map((subnet) => subnet.id);
export const capacityLimits = { min: minSize, initialDesired: desiredCapacity, max: maxSize };
