/**
 * VALORHIVE Challenger Mode Components
 * 
 * Components for Challenger Mode district-based participation system.
 * 
 * Components:
 * - ChallengerPermissionWrapper: Wraps action buttons with permission checks
 * - PermissionGuard: Simple guard that hides/shows content based on permissions
 * - PermissionSwitch: Renders different content based on permission state
 * 
 * @module challenger
 */

export {
  ChallengerPermissionWrapper,
  PermissionGuard,
  PermissionSwitch,
  type ChallengerAction,
  type PermissionWrapperProps,
} from "./permission-wrapper";
