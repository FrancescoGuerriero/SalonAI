import {
  scopedWeeklyAvailability,
} from "../../services/staffAvailabilityAuthorityService.js";

export async function week(
  req,
  res
) {
  res.json({
    items:
      await scopedWeeklyAvailability(
        req.params.staffId,
        req.effectiveAuthority
      ),
  });
}

export default {
  week,
};
