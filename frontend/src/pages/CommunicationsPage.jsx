import {
  MessageCircle,
  Send,
} from "lucide-react";

import CustomerContactAnalyticsPanel from "../components/dashboard/CustomerContactAnalyticsPanel";

export default function CommunicationsPage() {
  return (
    <main className="space-y-8 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <MessageCircle size={27} />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Customer Communications
              </h1>

              <p className="mt-2 max-w-2xl text-gray-600">
                Manage customer contact records, re-engagement
                campaigns, delivery statuses, and communication
                performance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Send
                className="text-blue-700"
                size={20}
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Communications Centre
              </p>

              <p className="text-sm font-semibold text-gray-800">
                Email, SMS, WhatsApp and Phone
              </p>
            </div>
          </div>
        </div>
      </header>

      <CustomerContactAnalyticsPanel
        defaultDays={30}
        recordsPerPage={15}
      />
    </main>
  );
}