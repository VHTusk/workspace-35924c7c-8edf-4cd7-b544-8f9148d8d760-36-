/**
 * VALORHIVE Terraform Variables
 * All configuration variables for the infrastructure
 */

# ============================================
# General Configuration
# ============================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "valorhive"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "valorhive.com"
}

# ============================================
# VPC Configuration
# ============================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# ============================================
# Database Configuration
# ============================================

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

# ============================================
# Redis Configuration
# ============================================

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_cluster_size" {
  description = "Number of nodes in Redis cluster"
  type        = number
  default     = 3
}

# ============================================
# EKS Configuration
# ============================================

variable "eks_cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS nodes"
  type        = string
  default     = "m6i.2xlarge"
}

variable "eks_node_count" {
  description = "Number of EKS nodes"
  type        = number
  default     = 3
}

variable "eks_node_min_size" {
  description = "Minimum EKS node count"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Maximum EKS node count"
  type        = number
  default     = 10
}

# ============================================
# WAF Configuration
# ============================================

variable "waf_enabled" {
  description = "Enable WAF protection"
  type        = bool
  default     = true
}

variable "blocked_countries" {
  description = "List of country codes to block (ISO 3166-1 alpha-2 codes)"
  type        = list(string)
  default     = []
  # Example: ["CN", "RU", "KP"] to block China, Russia, North Korea
}

variable "rate_limit_requests" {
  description = "Maximum number of requests per rate limit period per IP for API endpoints"
  type        = number
  default     = 1000
}

variable "rate_limit_period" {
  description = "Rate limit evaluation period in seconds"
  type        = number
  default     = 300
}

variable "login_rate_limit" {
  description = "Maximum login attempts per 5 minutes per IP"
  type        = number
  default     = 100
}

variable "registration_rate_limit" {
  description = "Maximum registration attempts per 5 minutes per IP"
  type        = number
  default     = 10
}

variable "password_reset_rate_limit" {
  description = "Maximum password reset requests per 5 minutes per IP"
  type        = number
  default     = 5
}

variable "waf_log_retention_days" {
  description = "Number of days to retain WAF logs in CloudWatch"
  type        = number
  default     = 30
}

variable "waf_blocked_alert_threshold" {
  description = "Number of blocked requests to trigger an alert"
  type        = number
  default     = 100
}

variable "waf_rate_limit_alert_threshold" {
  description = "Number of rate-limited requests to trigger an alert"
  type        = number
  default     = 50
}

variable "waf_allowlist_ips" {
  description = "List of IP addresses to explicitly allow (CIDR notation)"
  type        = list(string)
  default     = []
  # Example: ["192.168.1.0/24", "10.0.0.1/32"]
}

variable "waf_blocklist_ips" {
  description = "List of IP addresses to explicitly block (CIDR notation)"
  type        = list(string)
  default     = []
  # Example: ["192.168.100.0/24"]
}

variable "waf_max_body_size_bytes" {
  description = "Maximum request body size in bytes (default 1MB)"
  type        = number
  default     = 1048576
}

variable "waf_enable_bot_control" {
  description = "Enable AWS Bot Control managed rule group (additional charges apply)"
  type        = bool
  default     = true
}

variable "waf_enable_account_takeover_protection" {
  description = "Enable account takeover prevention features"
  type        = bool
  default     = true
}
