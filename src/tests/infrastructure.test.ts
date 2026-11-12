import assert from "node:assert/strict";
import { test } from "node:test";
import * as pulumi from "@pulumi/pulumi";

const resources: pulumi.runtime.MockResourceArgs[] = [];
let markResourcesReady: () => void;
const resourcesReady = new Promise<void>((resolve) => {
  markResourcesReady = resolve;
});
pulumi.runtime.setMocks(
  {
    newResource(args) {
      resources.push(args);
      if (args.type === "aws:autoscaling/policy:Policy") {
        markResourcesReady();
      }
      return {
        id: `${args.name}-id`,
        state: {
          ...args.inputs,
          arn: `arn:aws:mock:${args.name}`,
          name: args.name,
          dnsName: "lab.example.com",
          latestVersion: 1,
        },
      };
    },
    call(args) {
      if (args.token === "aws:index/getAvailabilityZones:getAvailabilityZones") {
        return { names: ["us-east-1a", "us-east-1b"] };
      }
      if (args.token === "aws:ssm/getParameter:getParameter") {
        return { value: "ami-mock" };
      }
      return args.inputs;
    },
  },
  "pulumi-load-balancer-aws",
  "test",
  false,
);

test("networking, security, and scaling meet the template requirements", async () => {
  // Also wait for resources that are not directly referenced by stack outputs.
  await pulumi.runtime.runInPulumiStack(async () => {
    await import("../index.js");
  });
  await resourcesReady;
  const find = (type: string) => {
    const resource = resources.find((item) => item.type === type);
    assert.ok(resource, `Missing resource: ${type}`);
    return resource.inputs;
  };
  const asg = find("aws:autoscaling/group:Group");
  assert.equal(asg.minSize, 1);
  assert.equal(asg.desiredCapacity, 2);
  assert.equal(asg.maxSize, 4);
  assert.equal(asg.healthCheckType, "ELB");
  assert.deepEqual(asg.targetGroupArns, ["arn:aws:mock:web-targets"]);
  assert.equal(asg.vpcZoneIdentifiers.length, 2);
  const subnets = resources.filter((item) => item.type === "aws:ec2/subnet:Subnet");
  assert.deepEqual(subnets.map((item) => item.inputs.availabilityZone).sort(), [
    "us-east-1a",
    "us-east-1b",
  ]);
  const webSg = resources.find((item) => item.name === "web-sg")!.inputs;
  assert.deepEqual(webSg.ingress, [
    { protocol: "tcp", fromPort: 80, toPort: 80, securityGroups: ["alb-sg-id"] },
  ]);
  const template = find("aws:ec2/launchTemplate:LaunchTemplate");
  assert.deepEqual(template.iamInstanceProfile, { arn: "arn:aws:mock:web-instance-profile" });
  const role = find("aws:iam/role:Role");
  assert.deepEqual(JSON.parse(role.assumeRolePolicy).Statement, [
    {
      Effect: "Allow",
      Principal: { Service: "ec2.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ]);
  assert.equal(
    find("aws:iam/rolePolicyAttachment:RolePolicyAttachment").policyArn,
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  );
  assert.equal(find("aws:iam/instanceProfile:InstanceProfile").role, "web-ssm-role");
  assert.equal(template.metadataOptions.httpTokens, "required");
  const script = Buffer.from(template.userData, "base64").toString();
  assert.equal(
    script,
    `#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd
echo "<h1>Hello World from $(hostname -f)</h1>" > /var/www/html/index.html
`,
  );
  assert.equal(find("aws:lb/targetGroup:TargetGroup").healthCheck.path, "/");
  assert.equal(
    find("aws:lb/listener:Listener").defaultActions[0].targetGroupArn,
    "arn:aws:mock:web-targets",
  );
  assert.equal(find("aws:autoscaling/policy:Policy").targetTrackingConfiguration.targetValue, 60);
});
