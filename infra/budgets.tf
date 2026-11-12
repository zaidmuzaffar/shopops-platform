# Safety net first: before creating anything else, make sure any spend is noticed.
# AWS Budgets: the first two budgets in an account are free.
resource "aws_budgets_budget" "monthly" {
  name         = "shopops-monthly-cost"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Count spend BEFORE credits are applied. With include_credit = true,
  # free credits would hide real usage and the alerts would never fire.
  cost_types {
    include_credit = false
    include_refund = false
  }

  # Alert 1: the very first real dollar.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 1
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Alert 2: something is clearly running that should not be.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 5
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Alert 3: at this pace the month will reach the full limit.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
