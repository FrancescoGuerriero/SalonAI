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

/*
|--------------------------------------------------------------------------
| Authentication and authorisation
|--------------------------------------------------------------------------
|
| Customer notes may contain sensitive consultation, allergy, complaint or
| safeguarding information. Every route therefore requires an authenticated
| salon-management account.
|
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| Global follow-up queue
|--------------------------------------------------------------------------
|
| These static routes must remain before dynamic note routes such as
| /:noteId. Private notes are limited to administrators and their authors.
|
*/

router.get(
  requirePermissions(
    "customer:read"
  ),
  "/follow-ups/summary",
  getFollowUpSummary
);

router.get(
  requirePermissions(
    "customer:read"
  ),
  "/follow-ups",
  listFollowUps
);

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/follow-ups/:noteId/schedule",
  scheduleFollowUp
);

/*
|--------------------------------------------------------------------------
| Customer tag summary
|--------------------------------------------------------------------------
|
| Static routes must remain before dynamic note routes such as /:noteId.
|
*/

router.get(
  requirePermissions(
    "customer:read"
  ),
  "/tags/summary",
  getTagSummary
);

/*
|--------------------------------------------------------------------------
| Customer profile tags
|--------------------------------------------------------------------------
*/

router.put(
  requirePermissions(
    "customer:update"
  ),
  "/customers/:customerId/tags",
  replaceTags
);

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/customers/:customerId/tags/add",
  addTags
);

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/customers/:customerId/tags/remove",
  removeTags
);

/*
|--------------------------------------------------------------------------
| Customer note statistics
|--------------------------------------------------------------------------
*/

router.get(
  requirePermissions(
    "customer:read"
  ),
  "/customers/:customerId/statistics",
  getNoteStatistics
);

/*
|--------------------------------------------------------------------------
| Customer note collection
|--------------------------------------------------------------------------
*/

router
  .route("/customers/:customerId")
  .get(
    requirePermissions(
      "customer:read"
    ),
    listNotes
  )
  .post(
    requirePermissions(
      "customer:update"
    ),
    createNote
  );

/*
|--------------------------------------------------------------------------
| Note pinning
|--------------------------------------------------------------------------
*/

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/:noteId/pinned",
  updatePinnedStatus
);

/*
|--------------------------------------------------------------------------
| Note follow-up management
|--------------------------------------------------------------------------
*/

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/:noteId/follow-up/complete",
  completeFollowUp
);

router.patch(
  requirePermissions(
    "customer:update"
  ),
  "/:noteId/follow-up/reopen",
  reopenFollowUp
);

/*
|--------------------------------------------------------------------------
| Deleted-note restoration
|--------------------------------------------------------------------------
|
| Only administrators may restore a soft-deleted customer note.
|
*/

router.patch(
  "/:noteId/restore",
  requirePermissions(
    "customer:archive"
  ),
  restoreNote
);

/*
|--------------------------------------------------------------------------
| Individual customer note
|--------------------------------------------------------------------------
*/

router
  .route("/:noteId")
  .get(
    requirePermissions(
      "customer:read"
    ),
    getNote
  )
  .patch(
    requirePermissions(
      "customer:update"
    ),
    updateNote
  )
  .delete(
    requirePermissions(
      "customer:delete"
    ),
    deleteNote
  );

export default router;
