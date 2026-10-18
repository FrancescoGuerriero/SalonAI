import {
  scopedRotaShiftMutationTarget,
} from "../../services/staffRotaMutationAuthorityService.js";

export async function requireScopedRotaShiftMutation(
  request,
  response,
  next
) {
  await scopedRotaShiftMutationTarget(
    request.params.shiftId,
    request.effectiveAuthority,
    request.body || {}
  );

  return next();
}

export default {
  requireScopedRotaShiftMutation,
};
