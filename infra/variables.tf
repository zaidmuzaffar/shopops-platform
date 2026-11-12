variable "aws_region" {
  description = "AWS region for all regional resources."
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email address that receives budget alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly spending limit in USD. Alerts fire at $1, $5 and this amount."
  type        = number
  default     = 20
}

variable "vpc_cidr" {
  description = "IP range of the ShopOps VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the CI role."
  type        = string
  default     = "zaidmuzaffar/shopops-platform"
}
