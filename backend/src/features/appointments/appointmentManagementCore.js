import mongoose from "mongoose";

/*
 * This file preserves the pre-segmentation appointment-management implementation.
 * The canonical appointmentManagementService.js now wraps it only where provider
 * occupancy needs to be segment-aware; retrieval, status, reminders and reporting
 * remain delegated to this established core.
 */

export * from "./appointmentManagementCoreLegacy.js";
export { default } from "./appointmentManagementCoreLegacy.js";
