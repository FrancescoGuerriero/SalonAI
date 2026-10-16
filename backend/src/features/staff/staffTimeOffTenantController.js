import {
  scopedTimeOffList,
} from "../../services/staffTimeOffAuthorityService.js";

export async function listTimeOff(
  req,
  res
) {
  res.json({
    items:
      await scopedTimeOffList(
        req.query,
        req.effectiveAuthority
      ),
  });
}

export default {
  listTimeOff,
};
