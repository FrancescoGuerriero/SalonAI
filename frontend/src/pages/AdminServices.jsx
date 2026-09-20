import ServicesPage from "./ServicesPage.jsx";

/*
 * Preserve the restored /admin/services URL while using the canonical,
 * permission-aware service-management workspace. This keeps Administrator
 * visibility without reviving the legacy unrestricted CRUD editor.
 */
export default function AdminServices() {
  return <ServicesPage />;
}
