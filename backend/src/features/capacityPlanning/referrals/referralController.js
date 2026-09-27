// Compatibility exports retained for historical capacity-planning imports.
// Canonical referral business logic lives in features/premium/referrals.
export {
  createReferral,
  getMyReferrals,
  listReferrals,
  qualifyReferral,
} from "../../premium/referrals/referralController.js";
