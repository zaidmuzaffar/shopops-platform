# Terraform state lives in S3, not on the laptop.
# The bucket name is passed at init time, so the AWS account ID never appears in Git:
#   terraform init -backend-config="bucket=<state bucket name>"
terraform {
  backend "s3" {
    key          = "shopops/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
