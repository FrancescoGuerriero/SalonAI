import express from "express";

import {
  addTags,
  completeFollowUp,
  createNote,
  deleteNote,
  getNote,
  getNoteStatistics,
  getTagSummary,
  listNotes,
  removeTags,
  reopenFollowUp,
  replaceTags,
  restoreNote,
  updateNote,
  updatePinnedStatus,
} from "../controllers/customerNoteController.js";

import {
  getFollowUpSummary,
  listFollowUps,
  scheduleFollowUp,
} from "../controllers/customerFollowUpController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

const readCustomers =
  requirePermissions(
    "customer:read"
  );

const updateCustomers =
  requirePermissions(
    "customer:update"
  );

router.use(protect);

/*
|--------------------------------------------------------------------------
| Global follow-up queue
|--------------------------------------------------------------------------
*/

router.get(
  "/follow-ups/summary",
  readCustomers,
  getFollowUpSummary
);

router.get(
  "/follow-ups",
  readCustomers,
  listFollowUps
);

router.patch(
  "/follow-ups/:noteId/schedule",
  updateCustomers,
  scheduleFollowUp
);

/*
|--------------------------------------------------------------------------
| Customer tag summary and profile tags
|--------------------------------------------------------------------------
*/

router.get(
  "/tags/summary",
  readCustomers,
  getTagSummary
);

router.put(
  "/customers/:customerId/tags",
  updateCustomers,
  replaceTags
);

router.patch(
  "/customers/:customerId/tags/add",
  updateCustomers,
  addTags
);

router.patch(
  "/customers/:customerId/tags/remove",
  updateCustomers,
  removeTags
);

/*
|--------------------------------------------------------------------------
| Customer note statistics and collection
|--------------------------------------------------------------------------
*/

router.get(
  "/customers/:customerId/statistics",
  readCustomers,
  getNoteStatistics
);

router
  .route(
    "/customers/:customerId"
  )
  .get(
    readCustomers,
    listNotes
  )
  .post(
    updateCustomers,
    createNote
  );

/*
|--------------------------------------------------------------------------
| Note operations
|--------------------------------------------------------------------------
*/

router.patch(
  "/:noteId/pinned",
  updateCustomers,
  updatePinnedStatus
);

router.patch(
  "/:noteId/follow-up/complete",
  updateCustomers,
  completeFollowUp
);

router.patch(
  "/:noteId/follow-up/reopen",
  updateCustomers,
  reopenFollowUp
);

router.patch(
  "/:noteId/restore",
  requirePermissions(
    "customer:archive"
  ),
  restoreNote
);

router
  .route(
    "/:noteId"
  )
  .get(
    readCustomers,
    getNote
  )
  .patch(
    updateCustomers,
    updateNote
  )
  .delete(
    requirePermissions(
      "customer:delete"
    ),
    deleteNote
  );

export default router;
