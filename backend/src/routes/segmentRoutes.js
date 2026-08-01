import {
  Router,
} from "express";

import {
  createRevenueForecastSnapshot,
  deleteRevenueForecastSnapshot,
  getRevenueForecast,
  getRevenueForecastSnapshot,
  listRevenueForecastSnapshots,
} from "./revenueForecastController.js";

const router =
  Router();

router.get(
  "/",
  getRevenueForecast
);

router
  .route("/snapshots")
  .get(
    listRevenueForecastSnapshots
  )
  .post(
    createRevenueForecastSnapshot
  );

router
  .route(
    "/snapshots/:snapshotId"
  )
  .get(
    getRevenueForecastSnapshot
  )
  .delete(
    deleteRevenueForecastSnapshot
  );

export default router;
