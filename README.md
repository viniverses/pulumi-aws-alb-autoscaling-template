![AWS Load Balancer — EC2 Auto Scaling, Pulumi and TypeScript](https://i.ibb.co/nsbrFM7x/Screenshot-49.png)

# AWS Template: Pulumi, ALB, and EC2 Auto Scaling

A reusable TypeScript template for an AWS Application Load Balancer, Target Group, and EC2 Auto Scaling Group. Starts with **2 instances**, scales between **1 and 4**, and targets **60% average CPU utilization**.

## Architecture

Request flow: browser -> ALB:80 -> Target Group -> Apache:80 on healthy EC2 instances.

- Dedicated VPC with two public subnets across availability zones; no NAT Gateway.
- Amazon Linux 2023 instances with Apache, IMDSv2, and encrypted gp3 storage.
- EC2 accepts HTTP only from the ALB. Terminal access uses Session Manager; SSH is not enabled.
- Health checks run every 5 seconds with a 2-second timeout. The ASG replaces unhealthy instances and scales capacity up or down.

This template uses HTTP and public instance IPs. Instance refreshes can interrupt service. Adapt networking, TLS, and availability settings before production use.

## Prerequisites

- Node.js compatible with ESLint 10 (`^20.19.0`, `^22.13.0`, or `>=24`), pnpm, Pulumi CLI 3, and AWS CLI.
- An AWS profile with permissions for EC2/VPC, ELB, Auto Scaling, CloudWatch, SSM parameter reads, and IAM. See [deployment permissions](docs/iam-permissions.md).
- A region with two available zones and quota for four instances of the chosen type.

## Deploy

Run from the project root in PowerShell. Replace `default` with your AWS profile:

```powershell
$env:AWS_PROFILE = "default"
aws sts get-caller-identity

pnpm install
pnpm lint
pnpm typecheck
pnpm test

pulumi login
pulumi stack select dev --create
pulumi config set aws:profile default
pulumi config set aws:region us-east-1
pulumi preview
pulumi up
pulumi stack output url
```

Verify the AWS account before deploying. Review the preview and confirm `pulumi up`. Initialization takes a few minutes. Open the output URL using **HTTP**. No `.env` file is required. Use a separate stack for each AWS account.

## Configuration

Values configured in `Pulumi.dev.yaml`:

| Key               | Value       | Purpose                                      |
| ----------------- | ----------- | -------------------------------------------- |
| `aws:profile`     | `default`   | AWS CLI profile                              |
| `aws:region`      | `us-east-1` | Deployment region                            |
| `minSize`         | `1`         | Minimum instance count                       |
| `desiredCapacity` | `2`         | Initial instance count                       |
| `maxSize`         | `4`         | Maximum instance count                       |
| `instanceType`    | `t2.micro`  | Instance type compatible with the x86_64 AMI |
| `cpuTarget`       | `60`        | Target average CPU percentage                |

Change a value with `pulumi config set cpuTarget 50`, then run `pulumi up`. Capacity values must be integers satisfying `1 <= minSize <= desiredCapacity <= maxSize <= 4`.

After creation, `desiredCapacity` uses `ignoreChanges` so deployments preserve scaling decisions. Adjust live desired capacity through the AWS CLI or console.

## Test

1. Open the application URL and check the hostname in the response.
2. Inspect target health in **EC2 -> Target Groups -> Targets**.
3. Open an instance terminal through **EC2 -> Instances -> Connect -> Session Manager**.
4. To test CPU scaling, start with two healthy instances. Copy [cpu-load-test.sh](src/data/cpu-load-test.sh) to each one and run it in both Linux terminals:

```bash
bash cpu-load-test.sh --seconds 600 --percent 75
```

The script requires Python 3 and generates temporary CPU load for 10 minutes. Watch **Auto Scaling Groups -> Activity** and CloudWatch alarms. Scaling uses the group's average CPU and can take several minutes; it does not guarantee exactly one additional instance. Under low load, capacity may return to one.

See [troubleshooting](docs/troubleshooting.md) for connection, health check, and scaling issues.

## Cleanup

ALB, EC2, EBS, public IPv4 addresses, detailed monitoring, and network usage can incur charges. Remove the deployed resources when finished:

```powershell
pulumi destroy
```

Wait for successful deletion. The stack configuration remains available for reuse. To remove an empty stack as well, run `pulumi stack rm dev`.
