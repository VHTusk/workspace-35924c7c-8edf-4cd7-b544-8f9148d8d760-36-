/**
 * VALORHIVE Terraform Outputs
 * All outputs from the infrastructure
 */

# ============================================
# VPC Outputs
# ============================================

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}

# ============================================
# Database Outputs
# ============================================

output "database_endpoint" {
  description = "Writer endpoint for the database cluster"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = true
}

output "database_reader_endpoint" {
  description = "Reader endpoint for the database cluster"
  value       = aws_rds_cluster.main.reader_endpoint
  sensitive   = true
}

output "database_port" {
  description = "The database port"
  value       = 5432
}

output "database_name" {
  description = "The database name"
  value       = "valorhive"
}

output "database_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.database.arn
}

# ============================================
# Redis Outputs
# ============================================

output "redis_endpoint" {
  description = "Primary endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "The Redis port"
  value       = 6379
}

output "redis_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis credentials"
  value       = aws_secretsmanager_secret.redis.arn
}

# ============================================
# S3 Outputs
# ============================================

output "s3_uploads_bucket" {
  description = "Name of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.arn
}

output "s3_media_bucket" {
  description = "Name of the media S3 bucket"
  value       = aws_s3_bucket.media.bucket
}

output "s3_media_bucket_arn" {
  description = "ARN of the media S3 bucket"
  value       = aws_s3_bucket.media.arn
}

output "s3_backups_bucket" {
  description = "Name of the backups S3 bucket"
  value       = aws_s3_bucket.backups.bucket
}

output "s3_backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = aws_s3_bucket.backups.arn
}

# ============================================
# CloudFront Outputs
# ============================================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.arn
}

# ============================================
# ACM Certificate Outputs
# ============================================

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "acm_certificate_domain" {
  description = "Domain name of the ACM certificate"
  value       = aws_acm_certificate.main.domain_name
}

# ============================================
# Security Group Outputs
# ============================================

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
}

output "database_security_group_id" {
  description = "ID of the database security group"
  value       = aws_security_group.database.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

# ============================================
# NAT Gateway Outputs
# ============================================

output "nat_gateway_id" {
  description = "ID of the NAT Gateway"
  value       = aws_nat_gateway.main.id
}

output "nat_gateway_public_ip" {
  description = "Public IP of the NAT Gateway"
  value       = aws_eip.nat[0].public_ip
}

# ============================================
# WAF Outputs
# ============================================

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "waf_web_acl_name" {
  description = "Name of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.name
}

output "waf_web_acl_capacity" {
  description = "Web ACL capacity units consumed"
  value       = aws_wafv2_web_acl.main.capacity
}

output "waf_log_group_name" {
  description = "Name of the CloudWatch Log Group for WAF logs"
  value       = aws_cloudwatch_log_group.waf.name
}

output "waf_log_group_arn" {
  description = "ARN of the CloudWatch Log Group for WAF logs"
  value       = aws_cloudwatch_log_group.waf.arn
}

output "waf_s3_logs_bucket" {
  description = "Name of the S3 bucket for long-term WAF log storage"
  value       = aws_s3_bucket.waf_logs.bucket
}

output "waf_s3_logs_bucket_arn" {
  description = "ARN of the S3 bucket for long-term WAF log storage"
  value       = aws_s3_bucket.waf_logs.arn
}

output "waf_allowlist_ip_set_id" {
  description = "ID of the WAF IP set for allowlisting"
  value       = aws_wafv2_ip_set.allowlist.id
}

output "waf_allowlist_ip_set_arn" {
  description = "ARN of the WAF IP set for allowlisting"
  value       = aws_wafv2_ip_set.allowlist.arn
}

output "waf_blocklist_ip_set_id" {
  description = "ID of the WAF IP set for blocklisting"
  value       = aws_wafv2_ip_set.blocklist.id
}

output "waf_blocklist_ip_set_arn" {
  description = "ARN of the WAF IP set for blocklisting"
  value       = aws_wafv2_ip_set.blocklist.arn
}

output "waf_cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms for WAF monitoring"
  value = {
    blocked_requests = aws_cloudwatch_metric_alarm.waf_blocked_requests.arn
    rate_limit       = aws_cloudwatch_metric_alarm.waf_high_rate_limit.arn
  }
}

# ============================================
# CloudWatch Outputs
# ============================================

output "cloudwatch_app_log_group_name" {
  description = "Name of the CloudWatch Log Group for application logs"
  value       = aws_cloudwatch_log_group.app.name
}

output "cloudwatch_worker_log_group_name" {
  description = "Name of the CloudWatch Log Group for worker logs"
  value       = aws_cloudwatch_log_group.worker.name
}

# ============================================
# Environment Summary
# ============================================

output "environment_summary" {
  description = "Summary of the deployed environment"
  value = {
    project     = var.project_name
    environment = var.environment
    region      = var.aws_region
    domain      = var.domain_name
    waf_enabled = var.waf_enabled
  }
}
