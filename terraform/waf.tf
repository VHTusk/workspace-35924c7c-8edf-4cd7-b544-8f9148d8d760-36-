/**
 * VALORHIVE AWS WAF Configuration
 * Web Application Firewall for protection against common attacks
 * 
 * This configuration includes:
 * - Managed rule groups for common attack patterns
 * - Custom rate-based rules for login and API endpoints
 * - Geographic blocking capability
 * - Request size restrictions
 * - WAF logging to CloudWatch and S3
 */

# ============================================
# WAF Web ACL
# ============================================

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-${var.environment}-web-acl"
  description = "WAF Web ACL for VALORHIVE ${var.environment} environment"
  scope       = "CLOUDFRONT" # Use CLOUDFRONT for global, REGIONAL for ALB

  default_action {
    allow {}
  }

  # ============================================
  # Managed Rule Groups
  # ============================================

  # AWS Core Rule Set - Protection against common web exploits
  managed_rule_group_statement {
    name        = "AWSManagedRulesCommonRuleSet"
    priority    = 10
    vendor_name = "AWS"

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection Protection
  managed_rule_group_statement {
    name        = "AWSManagedRulesSQLiRuleSet"
    priority    = 20
    vendor_name = "AWS"

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Known Bad Inputs Protection
  managed_rule_group_statement {
    name        = "AWSManagedRulesKnownBadInputsRuleSet"
    priority    = 30
    vendor_name = "AWS"

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Bot Control - Managed bot protection
  managed_rule_group_statement {
    name        = "AWSManagedRulesBotControlRuleSet"
    priority    = 40
    vendor_name = "AWS"

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesBotControlRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Anonymous IP List - Block requests from anonymizing services
  managed_rule_group_statement {
    name        = "AWSManagedRulesAnonymousIpList"
    priority    = 50
    vendor_name = "AWS"

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesAnonymousIpListMetric"
      sampled_requests_enabled   = true
    }
  }

  # ============================================
  # Custom Rules
  # ============================================

  # Rate-based rule for login endpoints (100 requests per 5 minutes per IP)
  dynamic "rate_based_statement" {
    for_each = var.waf_enabled ? [1] : []
    content {
      limit              = var.login_rate_limit
      aggregate_key_type = "IP"

      scope_down_statement {
        and_statement {
          statement {
            byte_match_statement {
              field_to_match {
                uri_path {}
              }
              positional_constraint = "STARTS_WITH"
              search_string         = "/api/auth/login"
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
          statement {
            byte_match_statement {
              field_to_match {
                method {}
              }
              positional_constraint = "EXACTLY"
              search_string         = "POST"
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
        }
      }
    }
  }

  # Rule: Block oversized body requests (>1MB)
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "BlockOversizedBody"
      priority = 100
      action {
        block {}
      }
      statement {
        size_constraint_statement {
          field_to_match {
            body {}
          }
          comparison_operator = "GT"
          size                = 1048576 # 1MB in bytes
          text_transformation {
            priority = 0
            type     = "NONE"
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "BlockOversizedBodyMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: API Rate Limiting (1000 requests per minute per IP)
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "ApiRateLimit"
      priority = 110
      action {
        block {
          custom_response {
            response_code = 429
            response_header {
              name  = "X-RateLimit-Limit"
              value = tostring(var.rate_limit_requests)
            }
            response_header {
              name  = "X-RateLimit-Reset"
              value = tostring(var.rate_limit_period)
            }
          }
        }
      }
      statement {
        rate_based_statement {
          limit              = var.rate_limit_requests
          aggregate_key_type = "IP"
          scope_down_statement {
            byte_match_statement {
              field_to_match {
                uri_path {}
              }
              positional_constraint = "STARTS_WITH"
              search_string         = "/api/"
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "ApiRateLimitMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: Geographic Blocking
  dynamic "rule" {
    for_each = length(var.blocked_countries) > 0 ? [1] : []
    content {
      name     = "GeoBlockRule"
      priority = 120
      action {
        block {
          custom_response {
            response_code = 403
            response_header {
              name  = "X-Block-Reason"
              value = "GeoRestriction"
            }
          }
        }
      }
      statement {
        geo_match_statement {
          country_codes = var.blocked_countries
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "GeoBlockMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: Block requests without User-Agent header (bot detection)
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "BlockMissingUserAgent"
      priority = 130
      action {
        block {}
      }
      statement {
        size_constraint_statement {
          field_to_match {
            single_header {
              name = "user-agent"
            }
          }
          comparison_operator = "EQ"
          size                = 0
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "BlockMissingUserAgentMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: Block known malicious IP patterns
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "BlockSuspiciousPatterns"
      priority = 140
      action {
        block {}
      }
      statement {
        or_statement {
          statement {
            byte_match_statement {
              field_to_match {
                uri_path {}
              }
              positional_constraint = "CONTAINS"
              search_string         = "../"
              text_transformation {
                priority = 0
                type     = "URL_DECODE"
              }
            }
          }
          statement {
            byte_match_statement {
              field_to_match {
                uri_path {}
              }
              positional_constraint = "CONTAINS"
              search_string         = "..\\"
              text_transformation {
                priority = 0
                type     = "URL_DECODE"
              }
            }
          }
          statement {
            byte_match_statement {
              field_to_match {
                uri_path {}
              }
              positional_constraint = "CONTAINS"
              search_string         = "; DROP"
              text_transformation {
                priority = 0
                type     = "URL_DECODE"
              }
              text_transformation {
                priority = 1
                type     = "LOWERCASE"
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "BlockSuspiciousPatternsMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: Rate limit for registration endpoints
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "RegistrationRateLimit"
      priority = 150
      action {
        block {
          custom_response {
            response_code = 429
            response_header {
              name  = "X-RateLimit-Reason"
              value = "TooManyRegistrations"
            }
          }
        }
      }
      statement {
        rate_based_statement {
          limit              = var.registration_rate_limit
          aggregate_key_type = "IP"
          scope_down_statement {
            and_statement {
              statement {
                byte_match_statement {
                  field_to_match {
                    uri_path {}
                  }
                  positional_constraint = "STARTS_WITH"
                  search_string         = "/api/auth/register"
                  text_transformation {
                    priority = 0
                    type     = "NONE"
                  }
                }
              }
              statement {
                byte_match_statement {
                  field_to_match {
                    method {}
                  }
                  positional_constraint = "EXACTLY"
                  search_string         = "POST"
                  text_transformation {
                    priority = 0
                    type     = "NONE"
                  }
                }
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "RegistrationRateLimitMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rule: Rate limit for password reset endpoints
  dynamic "rule" {
    for_each = var.waf_enabled ? [1] : []
    content {
      name     = "PasswordResetRateLimit"
      priority = 160
      action {
        block {
          custom_response {
            response_code = 429
            response_header {
              name  = "X-RateLimit-Reason"
              value = "TooManyPasswordResets"
            }
          }
        }
      }
      statement {
        rate_based_statement {
          limit              = var.password_reset_rate_limit
          aggregate_key_type = "IP"
          scope_down_statement {
            and_statement {
              statement {
                byte_match_statement {
                  field_to_match {
                    uri_path {}
                  }
                  positional_constraint = "STARTS_WITH"
                  search_string         = "/api/auth/reset-password"
                  text_transformation {
                    priority = 0
                    type     = "NONE"
                  }
                }
              }
              statement {
                byte_match_statement {
                  field_to_match {
                    method {}
                  }
                  positional_constraint = "EXACTLY"
                  search_string         = "POST"
                  text_transformation {
                    priority = 0
                    type     = "NONE"
                  }
                }
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "PasswordResetRateLimitMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${var.project_name}-${var.environment}-waf-metric"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-web-acl"
  }
}

# ============================================
# WAF Logging Configuration
# ============================================

# CloudWatch Log Group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  name              = "/aws/wafv2/${var.project_name}-${var.environment}/web-acl"
  retention_in_days = var.waf_log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-logs"
  }
}

# IAM role for WAF to write to CloudWatch
resource "aws_iam_role" "waf_logging" {
  name = "${var.project_name}-${var.environment}-waf-logging-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-logging-role"
  }
}

resource "aws_iam_role_policy" "waf_logging" {
  name = "${var.project_name}-${var.environment}-waf-logging-policy"
  role = aws_iam_role.waf_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.waf.arn}:*"
      }
    ]
  })
}

# WAF Logging Configuration - CloudWatch
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  logging_filter {
    default_behavior = "KEEP"

    filter {
      behavior = "KEEP"
      requirement = "MEETS_ANY"

      condition {
        action_condition {
          action = "BLOCK"
        }
      }

      condition {
        action_condition {
          action = "COUNT"
        }
      }
    }
  }
}

# ============================================
# S3 Bucket for Long-term WAF Log Storage
# ============================================

resource "aws_s3_bucket" "waf_logs" {
  bucket = "${var.project_name}-${var.environment}-waf-logs"

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-logs"
  }
}

resource "aws_s3_bucket_versioning" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    id     = "waf-logs-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = var.waf_log_retention_days * 12 # Keep for longer in S3
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# S3 bucket policy for WAF logging
resource "aws_s3_bucket_policy" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSLogDeliveryWrite"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.waf_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AWSLogDeliveryAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.waf_logs.arn
      }
    ]
  })
}

# ============================================
# WAF Association with CloudFront
# ============================================

resource "aws_wafv2_web_acl_association" "cloudfront" {
  resource_arn = aws_cloudfront_distribution.cdn.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ============================================
# CloudWatch Alarms for WAF
# ============================================

resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  alarm_name          = "${var.project_name}-${var.environment}-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.waf_blocked_alert_threshold
  alarm_description   = "Alert when WAF blocks more than ${var.waf_blocked_alert_threshold} requests in 5 minutes"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = "Global"
  }

  alarm_actions = [] # Add SNS topic ARN for notifications

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-blocked-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "waf_high_rate_limit" {
  alarm_name          = "${var.project_name}-${var.environment}-waf-rate-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RateBasedRuleBlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "60"
  statistic           = "Sum"
  threshold           = var.waf_rate_limit_alert_threshold
  alarm_description   = "Alert when rate limiting triggers frequently"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = "Global"
  }

  alarm_actions = [] # Add SNS topic ARN for notifications

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-rate-limit-alarm"
  }
}

# ============================================
# WAF IP Set for Allowlisting/Blocklisting
# ============================================

resource "aws_wafv2_ip_set" "allowlist" {
  name               = "${var.project_name}-${var.environment}-allowlist"
  description        = "IP addresses to explicitly allow"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.waf_allowlist_ips

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-allowlist"
  }
}

resource "aws_wafv2_ip_set" "blocklist" {
  name               = "${var.project_name}-${var.environment}-blocklist"
  description        = "IP addresses to explicitly block"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.waf_blocklist_ips

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-blocklist"
  }
}

# ============================================
# Rule Group for Allowlist/Blocklist
# ============================================

# Note: We'll add rules to the main Web ACL to use these IP sets
# For now, they're created and ready to be referenced
