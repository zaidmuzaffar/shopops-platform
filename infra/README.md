# Terraform — Phase 3

Infrastructure as code for ShopOps on AWS. Only free resources are created here.

| File | Purpose |
|---|---|
| `versions.tf` | Pins Terraform and the AWS provider |
| `providers.tf` | AWS region and default tags on every resource |
| `variables.tf` | Inputs (region, alert email, budget limit) |
| `network.tf` | VPC, 2 public + 2 private subnets, internet gateway, route tables, locked default security group |
| `security_groups.tf` | Web, app and database security groups (each tier only reachable from the one in front) |
| `state.tf` | Encrypted, versioned, private S3 bucket for remote state |
| `github_oidc.tf` | GitHub OIDC provider and a read-only CI role (no stored keys) |
| `budgets.tf` | Monthly cost budget with alerts at $1, $5 and the forecast limit |
| `outputs.tf` | Values printed after `apply` |

## Run

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # then put your email in it
terraform init      # download the AWS provider
terraform fmt       # format the code
terraform validate  # check the syntax
terraform plan      # preview: what will be created
terraform apply     # create it (type "yes")
```

Never created here: EC2, NAT Gateway, load balancers, EKS, RDS, Elastic IPs.
