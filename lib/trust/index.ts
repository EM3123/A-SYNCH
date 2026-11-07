/**
 * A-SYNCH Trust Layer. The model proposes; the Trust Layer verifies.
 *
 *   import { verifyBrief, screenEvidence, canAccess } from "@/lib/trust";
 *
 * See docs/security/TRUST_LAYER.md for every rule and decision.
 */
export { verifyBrief, validateBrief, parseModelBrief, safeHandoffBrief } from "@/lib/trust/verify";
export type { VerifyInput, VerifyResult, TrustAudit, AuditCheck } from "@/lib/trust/verify";
export {
  canAccess,
  screenEvidence,
  isQuarantined,
  scanInjection,
  isStale,
  detectAuthorityRequest,
  findApprovalClaims,
  findLeaks,
} from "@/lib/trust/checks";
export { CORVID_PEOPLE, CORVID_EVIDENCE, getExpertise, getMetadata } from "@/lib/trust/context";
export { DEMO_NOW, FRESHNESS_HOURS, trustNow } from "@/lib/trust/policy";
