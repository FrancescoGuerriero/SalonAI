import { useCallback, useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";
import {
  listSellerConnections, diagnoseSellerConnection, getSellerImportStatus,
  stageSellerRecords, getSellerReconciliation, getSellerOrderLinks,
  getSellerOwnershipBatch, reviewSellerOrderLink,
} from "../../Services/sellerChannelApi.js";

const label = (value) => String(value || "").replaceAll("_", " ");
const safeError = (error) => error?.response?.data?.message ||
  "The seller operation could not be completed.";

export default function SellerChannelsPanel() {
  const { user } = useAuth();
  const canRead = hasPermission(user, "feature-control:read");
  const canOrderRead = hasPermission(user, "order:read");
  const canStage = hasPermission(user, "feature-control:update");
  const canReview = hasPermission(user, "order:update");
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState("");
  const [diagnostic, setDiagnostic] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [orders, setOrders] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const records = await listSellerConnections();
      setConnections(records);
      setSelected((old) => records.some((connection) => connection.id === old) ?
        old : records[0]?.id || "");
      setError("");
    } catch (e) {
      setError(safeError(e));
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setDiagnostic(null);
    setImportStatus(null);
    setInventory(null);
    setOrders(null);
    setBatch(null);
    setNotice("");
  }, [selected]);

  async function run(action, work) {
    if (!selected || busy) return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(safeError(e));
    } finally {
      setBusy("");
    }
  }

  if (!canRead) {
    return <p className="mt-4 text-sm text-stone-600">
      Seller account operations require feature-control read permission.
    </p>;
  }

  return (
    <section aria-label="Amazon and eBay seller operations"
      className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-black">Amazon &amp; eBay seller operations</h2>
          <p className="mt-1 text-sm text-stone-600">
            Account diagnostics, imports and operator review. Marketplace writes are not activated.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || !!busy}
          className="rounded-lg border border-black/20 px-3 py-2 text-sm font-semibold disabled:opacity-50">
          Refresh connections
        </button>
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <p className="mt-3 text-sm text-stone-600">Loading accounts…</p> : null}
      {!loading && !connections.length ? (
        <p className="mt-4 text-sm text-stone-600">
          No connected seller accounts are available for this business.
          Configure Amazon Seller Central or eBay through the Integration Platform.
        </p>
      ) : null}

      {connections.length ? (
        <>
          <label htmlFor="seller-connection" className="mt-4 block text-sm font-semibold">
            Connected seller account
          </label>
          <select id="seller-connection" value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-1 w-full rounded-lg border border-black/20 p-2 text-sm sm:max-w-md">
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {label(connection.provider)} — {connection.connectionKey}
              </option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy}
              onClick={() => run("diagnose", async () => {
                setDiagnostic(await diagnoseSellerConnection(selected));
              })}
              className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold disabled:opacity-50">
              Test read access
            </button>
            <button type="button" disabled={!!busy}
              onClick={() => run("status", async () => {
                setImportStatus(await getSellerImportStatus(selected));
              })}
              className="rounded-lg border border-black/20 px-3 py-2 text-sm disabled:opacity-50">
              Import status
            </button>
            <button type="button" disabled={!!busy}
              onClick={() => run("inventory", async () => {
                setInventory(await getSellerReconciliation(selected));
              })}
              className="rounded-lg border border-black/20 px-3 py-2 text-sm disabled:opacity-50">
              Inventory differences
            </button>
            {canOrderRead ? (
              <button type="button" disabled={!!busy}
                onClick={() => run("orders", async () => {
                  setOrders(await getSellerOrderLinks(selected));
                  setBatch(await getSellerOwnershipBatch(selected));
                })}
                className="rounded-lg border border-black/20 px-3 py-2 text-sm disabled:opacity-50">
                Review order links
              </button>
            ) : null}
            {canStage ? ["listings", "orders"].map((kind) => (
              <button type="button" key={kind} disabled={!!busy}
                onClick={() => run(kind, async () => {
                  await stageSellerRecords(selected, kind);
                  setNotice(`Marketplace ${kind} staged for operator review. No Commerce records updated.`);
                  setImportStatus(await getSellerImportStatus(selected));
                })}
                className="rounded-lg border border-black/20 px-3 py-2 text-sm disabled:opacity-50">
                Stage {kind}
              </button>
            )) : null}
          </div>
        </>
      ) : null}

      {diagnostic ? (
        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <h3 className="text-sm font-bold">Account read diagnostics</h3>
          <p className="mt-1 text-xs text-stone-600">
            {diagnostic.allReadChecksPassed ?
              "Listing and order reads succeeded at this check." :
              "At least one provider read could not be confirmed."}
            {" "}Write permissions and production acceptance remain unverified.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {(diagnostic.checks || []).map((check) => (
              <li key={check.kind}>{label(check.kind)}: {label(check.status)}
                {check.errorCode ? ` (${check.errorCode})` : ""}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {importStatus ? (
        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <h3 className="text-sm font-bold">Source staging status</h3>
          <p className="mt-1 text-xs text-stone-600">
            Source records are retained separately from Commerce and Inventory.
          </p>
          <pre className="mt-2 overflow-auto text-xs whitespace-pre-wrap">
            {JSON.stringify(importStatus, null, 2)}
          </pre>
        </div>
      ) : null}

      {inventory ? (
        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <h3 className="text-sm font-bold">Inventory reconciliation — dry run</h3>
          <p className="mt-1 text-xs text-stone-600">
            {inventory.locationSelected ? "Location-scoped review" :
              "No trusted stock location selected; quantity comparisons cannot be accepted."}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {(inventory.records || []).map((row, i) => (
              <li key={`${row.sku}-${i}`}>
                {row.sku || "Missing SKU"}: {label(row.state)}
                {row.quantityDifference != null ? ` (difference ${row.quantityDifference})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {orders ? (
        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <h3 className="text-sm font-bold">Order association review</h3>
          <p className="mt-1 text-xs text-stone-600">
            These references are not verified order associations. Approval and order execution are disabled.
          </p>
          <ul className="mt-3 space-y-3">
            {(orders.records || []).map((row) => (
              <li key={row.externalOrderId} className="rounded-lg border border-black/10 p-3 text-sm">
                <p className="font-semibold">{row.externalOrderId} — {label(row.linkStatus)}</p>
                <p className="text-xs text-stone-600">
                  Proposed Commerce ID: {row.proposedCommerceOrderId || "none"}
                </p>
                {row.reviewReason ? (
                  <p className="text-xs text-stone-600">Hold: {label(row.reviewReason)}</p>
                ) : null}
                {canReview && ["proposal_pending_verification", "reviewed_hold"].includes(row.linkStatus) ? (
                  <button type="button" disabled={!!busy}
                    onClick={() => run(row.externalOrderId, async () => {
                      const holding = row.linkStatus !== "reviewed_hold";
                      await reviewSellerOrderLink(selected, row.externalOrderId,
                        holding ? "hold" : "reopen",
                        holding ? "correspondence_unproven" : "");
                      setOrders(await getSellerOrderLinks(selected));
                      setBatch(await getSellerOwnershipBatch(selected));
                      setNotice(holding ? "Proposal placed on review hold." :
                        "Proposal reopened for verification.");
                    })}
                    className="mt-2 rounded-lg border border-black/20 px-3 py-1 text-xs disabled:opacity-50">
                    {row.linkStatus === "reviewed_hold" ? "Reopen review" : "Hold for correspondence"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {batch ? (
            <p className="mt-3 text-xs text-stone-600">
              Ownership preflight: {batch.summary?.proposalsInspected || 0} proposals examined,
              {" "}{batch.summary?.reviewedHold || 0} held. Zero associations approved.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-5 text-xs text-stone-600">
        Listing publication, stock writeback, order ingestion, fulfilment updates and refunds
        require separate provider-side authorization and production acceptance.
      </p>
    </section>
  );
}
