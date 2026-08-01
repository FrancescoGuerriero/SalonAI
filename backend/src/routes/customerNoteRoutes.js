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
  adminOnly,
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

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
router.use(managementOnly);

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
  "/follow-ups/summary",
  getFollowUpSummary
);

router.get(
  "/follow-ups",
  listFollowUps
);

router.patch(
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
  "/tags/summary",
  getTagSummary
);

/*
|--------------------------------------------------------------------------
| Customer profile tags
|--------------------------------------------------------------------------
*/

router.put(
  "/customers/:customerId/tags",
  replaceTags
);

router.patch(
  "/customers/:customerId/tags/add",
  addTags
);

router.patch(
  "/customers/:customerId/tags/remove",
  removeTags
);

/*
|--------------------------------------------------------------------------
| Customer note statistics
|--------------------------------------------------------------------------
*/

router.get(
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
  .get(listNotes)
  .post(createNote);

/*
|--------------------------------------------------------------------------
| Note pinning
|--------------------------------------------------------------------------
*/

router.patch(
  "/:noteId/pinned",
  updatePinnedStatus
);

/*
|--------------------------------------------------------------------------
| Note follow-up management
|--------------------------------------------------------------------------
*/

router.patch(
  "/:noteId/follow-up/complete",
  completeFollowUp
);

router.patch(
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
  adminOnly,
  restoreNote
);

/*
|--------------------------------------------------------------------------
| Individual customer note
|--------------------------------------------------------------------------
*/

router
  .route("/:noteId")
  .get(getNote)
  .patch(updateNote)
  .delete(deleteNote);

export default router;
