# Remote state bucket. Terraform's memory (the state file) moves here from the
# laptop, so CI and any teammate see the same state. Costs a fraction of a cent.

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "tfstate" {
  # Bucket names are global across all AWS accounts; the account ID makes it unique.
  bucket = "shopops-tfstate-${data.aws_caller_identity.current.account_id}"

  # Deleting this bucket would make Terraform forget everything it manages.
  lifecycle {
    prevent_destroy = true
  }

  tags = { Name = "shopops-tfstate" }
}

# Every change to the state keeps the previous version, so a bad write can be undone.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# State can contain sensitive values: it must never be public.
resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
