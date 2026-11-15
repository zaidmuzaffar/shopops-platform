output "budget_name" {
  description = "Name of the monthly cost budget."
  value       = aws_budgets_budget.monthly.name
}

output "vpc_id" {
  description = "ID of the ShopOps VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (one per Availability Zone)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (one per Availability Zone)."
  value       = aws_subnet.private[*].id
}

output "security_group_ids" {
  description = "Security group IDs per tier."
  value = {
    web = aws_security_group.web.id
    app = aws_security_group.app.id
    db  = aws_security_group.db.id
  }
}

output "state_bucket" {
  description = "S3 bucket that holds the Terraform state."
  value       = aws_s3_bucket.tfstate.bucket
}

output "github_actions_role_arn" {
  description = "Role ARN for GitHub Actions (aws-actions/configure-aws-credentials)."
  value       = aws_iam_role.github_actions.arn
}
