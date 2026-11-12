provider "aws" {
  region = var.aws_region

  # Every resource Terraform creates gets these tags automatically,
  # so in the AWS console it is always clear what belongs to this project.
  default_tags {
    tags = {
      Project   = "shopops"
      ManagedBy = "terraform"
      Ticket    = "PLAT-101"
    }
  }
}
