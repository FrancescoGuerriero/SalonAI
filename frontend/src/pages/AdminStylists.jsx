import StaffProfileEditorPage from "./StaffProfileEditorPage.jsx";

/*
 * Keep the legacy administrator URL as a compatibility alias, but render the
 * canonical role-aware staff-profile workspace so SalonAI has one profile
 * management workflow instead of two contradictory editors.
 */
export default function AdminStylists() {
  return <StaffProfileEditorPage />;
}
