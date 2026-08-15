import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  History,
  Package,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import dataImportService from "../Services/dataImportService.js";
import { downloadCsv, parseCsv } from "../utils/csv.js";
import "../styles/dataImport.css";

const MAXIMUM_ROWS = 10_000;
const MAXIMUM_FILE_BYTES = 15_000_000;
const API_BATCH_ROWS = 500;

const CONFIG = {
  customers: {
    label: "Customers",
    singular: "customer",
    icon: Users,
    templateFile: "SalonAI_customer_import_template.csv",
    requiredHeaders: ["firstName", "lastName"],
    columns: [
      "firstName", "lastName", "email", "phone", "title", "preferredName",
      "dateOfBirth", "gender", "addressLine1", "addressLine2", "city", "county",
      "postcode", "country", "preferredChannel", "emailConsent", "smsConsent",
      "status", "tags", "notes",
    ],
    guidance: "Use YYYY-MM-DD dates, separate tags with |, and use yes or no for consent fields.",
  },
  products: {
    label: "Products",
    singular: "product",
    icon: Package,
    templateFile: "SalonAI_product_import_template.csv",
    requiredHeaders: ["name", "sku", "price"],
    columns: [
      "name", "sku", "brand", "category", "size", "description", "price",
      "costPrice", "stockQuantity", "reorderLevel", "imageUrl", "featured", "active",
    ],
    guidance: "Use GBP values without currency symbols, whole numbers for stock, and HTTPS image links.",
  },
};

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function splitIntoBatches(items, size = API_BATCH_ROWS) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function aggregatePreview(previews = [], entityType, duplicatePolicy) {
  const results = previews.flatMap((item) => item?.results || []);
  const summary = previews.reduce(
    (totals, item) => {
      totals.total += Number(item?.summary?.total || 0);
      totals.creates += Number(item?.summary?.creates || 0);
      totals.updates += Number(item?.summary?.updates || 0);
      totals.skipped += Number(item?.summary?.skipped || 0);
      totals.errors += Number(item?.summary?.errors || 0);
      return totals;
    },
    { total: 0, creates: 0, updates: 0, skipped: 0, errors: 0 }
  );

  return {
    entityType,
    duplicatePolicy,
    summary,
    results,
    canCommit:
      summary.errors === 0 &&
      summary.creates + summary.updates > 0,
  };
}

function aggregateImports(imports = [], entityType, duplicatePolicy, fileName) {
  const results = imports.flatMap((item) => item?.results || []);
  const summary = imports.reduce(
    (totals, item) => {
      totals.total += Number(item?.summary?.total || 0);
      totals.created += Number(item?.summary?.created || 0);
      totals.updated += Number(item?.summary?.updated || 0);
      totals.skipped += Number(item?.summary?.skipped || 0);
      totals.failed += Number(item?.summary?.failed || 0);
      return totals;
    },
    { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 }
  );

  return {
    entityType,
    duplicatePolicy,
    fileName,
    status:
      summary.failed === 0
        ? "completed"
        : summary.created + summary.updated > 0
          ? "partial"
          : "failed",
    summary,
    results,
    batchCount: imports.length,
  };
}

function SummaryCard({ label, value, tone = "default" }) {
  return (
    <article className={`import-summary-card import-summary-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function DataImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = CONFIG[searchParams.get("type")] ? searchParams.get("type") : "customers";
  const [entityType, setEntityType] = useState(initialType);
  const [duplicatePolicy, setDuplicatePolicy] = useState("skip");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const config = CONFIG[entityType];
  const EntityIcon = config.icon;

  const loadHistory = useCallback(async () => {
    try {
      const response = await dataImportService.history({ limit: 12 });
      setHistory(response.items || []);
    } catch (requestError) {
      setError(errorMessage(requestError, "Import history could not be loaded."));
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const missingHeaders = useMemo(() => {
    const required = [...config.requiredHeaders];
    if (entityType === "customers" && !headers.includes("email") && !headers.includes("phone")) {
      required.push("email or phone");
    }
    return required.filter((header) =>
      header === "email or phone" ? true : !headers.includes(header)
    );
  }, [config.requiredHeaders, entityType, headers]);

  function resetFile() {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setPreview(null);
    setCommitResult(null);
    setReviewed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectEntityType(nextType) {
    setEntityType(nextType);
    setSearchParams(nextType === "customers" ? {} : { type: nextType });
    setDuplicatePolicy("skip");
    setError("");
    resetFile();
  }

  async function selectFile(event) {
    const file = event.target.files?.[0];
    setError("");
    setPreview(null);
    setCommitResult(null);
    setReviewed(false);
    if (!file) return;

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Choose a CSV file ending in .csv.");
      }
      if (file.size > MAXIMUM_FILE_BYTES) {
        throw new Error("The CSV file is too large. The maximum file size is 15 MB.");
      }
      const parsed = parseCsv(await file.text());
      if (parsed.rows.length > MAXIMUM_ROWS) {
        throw new Error(`A single upload can contain at most ${MAXIMUM_ROWS.toLocaleString("en-GB")} rows.`);
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    } catch (fileError) {
      resetFile();
      setError(errorMessage(fileError, "The CSV file could not be read."));
    }
  }

  function downloadTemplate() {
    downloadCsv(config.templateFile, [], config.columns);
  }

  function batchPayload(batchRows, batchIndex) {
    const suffix = rows.length > API_BATCH_ROWS
      ? `-batch-${batchIndex + 1}`
      : "";

    return {
      entityType,
      duplicatePolicy,
      fileName: `${fileName}${suffix}`,
      rows: batchRows,
    };
  }

  async function validateImport() {
    if (!rows.length) {
      setError("Choose a CSV file before validating it.");
      return;
    }
    if (missingHeaders.length) {
      setError(`Missing required CSV header${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.`);
      return;
    }

    try {
      setBusy("preview");
      setError("");
      setReviewed(false);
      setCommitResult(null);

      const batches = splitIntoBatches(rows);
      const previews = [];

      for (let index = 0; index < batches.length; index += 1) {
        const response = await dataImportService.preview(
          batchPayload(batches[index], index)
        );
        previews.push(response.preview);
      }

      setPreview(
        aggregatePreview(
          previews,
          entityType,
          duplicatePolicy
        )
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "The import could not be validated."));
    } finally {
      setBusy("");
    }
  }

  async function commitImport() {
    if (!preview?.canCommit || !reviewed) return;
    try {
      setBusy("commit");
      setError("");

      const batches = splitIntoBatches(rows);
      const imports = [];

      for (let index = 0; index < batches.length; index += 1) {
        const response = await dataImportService.commit(
          batchPayload(batches[index], index)
        );
        imports.push(response.import);
      }

      setCommitResult(
        aggregateImports(
          imports,
          entityType,
          duplicatePolicy,
          fileName
        )
      );
      setPreview(null);
      setReviewed(false);
      await loadHistory();
    } catch (requestError) {
      const serverPreview = requestError?.response?.data?.details?.preview;
      if (serverPreview) setPreview(serverPreview);
      setError(errorMessage(requestError, "The records could not be imported."));
    } finally {
      setBusy("");
    }
  }

  function downloadResultReport() {
    if (!commitResult?.results) return;
    const records = commitResult.results.map((result) => ({
      rowNumber: result.rowNumber,
      action: result.action,
      status: result.status,
      name: result.displayName,
      identifier: result.identity,
      code: result.code,
      message: result.message,
    }));
    downloadCsv(
      `SalonAI_${entityType}_import_result_${new Date().toISOString().slice(0, 10)}.csv`,
      records,
      ["rowNumber", "action", "status", "name", "identifier", "code", "message"]
    );
  }

  const resultRows = preview?.results || commitResult?.results || [];
  const summary = preview?.summary || commitResult?.summary || null;
  const completed = Boolean(commitResult);

  return (
    <main className="page data-import-page">
      <section className="data-import-hero">
        <div>
          <span className="data-import-eyebrow">Secure data management</span>
          <h1>Import customers and products</h1>
          <p>
            Validate every row before it reaches SalonAI, control duplicate handling and retain an auditable result.
          </p>
        </div>
        <Upload aria-hidden="true" size={46} />
      </section>

      <nav className="data-import-tabs" aria-label="Import type">
        {Object.entries(CONFIG).map(([type, item]) => {
          const Icon = item.icon;
          return (
            <button
              key={type}
              type="button"
              className={entityType === type ? "is-active" : ""}
              aria-pressed={entityType === type}
              onClick={() => selectEntityType(type)}
            >
              <Icon size={18} /> {item.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="data-import-alert data-import-alert-error" role="alert">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {commitResult && (
        <div className="data-import-alert data-import-alert-success" role="status">
          <CheckCircle2 size={20} />
          <span>
            Import {commitResult.status}. {commitResult.summary.created} created, {commitResult.summary.updated} updated,
            {` ${commitResult.summary.skipped}`} skipped and {commitResult.summary.failed} failed.
          </span>
        </div>
      )}

      <section className="data-import-workspace">
        <article className="data-import-panel">
          <div className="data-import-panel-heading">
            <div className="data-import-step">1</div>
            <div>
              <h2>Prepare the {config.singular} CSV</h2>
              <p>Start from the SalonAI template so every heading is recognised.</p>
            </div>
          </div>
          <button type="button" className="data-import-secondary" onClick={downloadTemplate}>
            <Download size={17} /> Download {config.label.toLowerCase()} template
          </button>
          <p className="data-import-guidance">{config.guidance}</p>
          {entityType === "customers" && (
            <p className="data-import-privacy">
              <ShieldCheck size={17} /> Imported profiles do not receive login accounts, and blank consent fields remain opted out.
            </p>
          )}
        </article>

        <article className="data-import-panel">
          <div className="data-import-panel-heading">
            <div className="data-import-step">2</div>
            <div>
              <h2>Upload and choose duplicate handling</h2>
              <p>
                CSV only, up to {MAXIMUM_ROWS.toLocaleString("en-GB")} data rows and 15 MB.
                Large uploads are validated and imported in secure {API_BATCH_ROWS}-row batches.
              </p>
            </div>
          </div>

          <label className="data-import-file-control">
            <Upload size={22} />
            <span>{fileName || "Choose CSV file"}</span>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={selectFile} />
          </label>

          {rows.length > 0 && (
            <p className="data-import-file-meta">
              <strong>{fileName}</strong> · {rows.length.toLocaleString("en-GB")} row{rows.length === 1 ? "" : "s"} · {headers.length} columns
            </p>
          )}

          <label className="data-import-select-label">
            Existing records
            <select
              value={duplicatePolicy}
              onChange={(event) => {
                setDuplicatePolicy(event.target.value);
                setPreview(null);
                setCommitResult(null);
                setReviewed(false);
              }}
            >
              <option value="skip">Keep existing records and skip matches</option>
              <option value="update">Update existing records from the CSV</option>
            </select>
          </label>

          {entityType === "products" && duplicatePolicy === "update" && (
            <p className="data-import-guidance">
              Existing stock will be set to the CSV quantity and recorded as an inventory adjustment.
            </p>
          )}

          <button
            type="button"
            className="data-import-primary"
            onClick={validateImport}
            disabled={!rows.length || busy !== ""}
          >
            {busy === "preview" ? <RefreshCw className="is-spinning" size={17} /> : <FileCheck2 size={17} />}
            {busy === "preview" ? "Validating…" : "Validate and preview"}
          </button>
        </article>
      </section>

      {summary && (
        <section className="data-import-review" aria-live="polite">
          <div className="data-import-review-heading">
            <div>
              <span className="data-import-eyebrow">{completed ? "Import result" : "Validation preview"}</span>
              <h2>{completed ? "Completed row outcomes" : "Review before importing"}</h2>
            </div>
            {completed && (
              <button type="button" className="data-import-secondary" onClick={downloadResultReport}>
                <Download size={17} /> Download result report
              </button>
            )}
          </div>

          <div className="data-import-summary-grid">
            <SummaryCard label="Rows" value={summary.total} />
            <SummaryCard label={completed ? "Created" : "To create"} value={summary.created ?? summary.creates ?? 0} tone="gold" />
            <SummaryCard label={completed ? "Updated" : "To update"} value={summary.updated ?? summary.updates ?? 0} tone="sand" />
            <SummaryCard label="Skipped" value={summary.skipped} />
            <SummaryCard label={completed ? "Failed" : "Errors"} value={summary.failed ?? summary.errors ?? 0} tone={(summary.failed ?? summary.errors) ? "dark" : "default"} />
          </div>

          <div className="data-import-table-wrap">
            <table className="data-import-table">
              <thead>
                <tr><th>CSV row</th><th>Record</th><th>Identifier</th><th>Action</th><th>Result</th></tr>
              </thead>
              <tbody>
                {resultRows.map((result) => (
                  <tr key={`${result.rowNumber}-${result.identity}-${result.action}`}>
                    <td>{result.rowNumber}</td>
                    <td><strong>{result.displayName || "Invalid row"}</strong></td>
                    <td>{result.identity || "—"}</td>
                    <td><span className={`data-import-badge data-import-badge-${result.action}`}>{titleCase(result.action)}</span></td>
                    <td>{result.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!completed && preview && (
            <div className="data-import-commit-panel">
              {preview.summary.errors > 0 ? (
                <p><AlertTriangle size={18} /> Correct the CSV errors and validate the file again.</p>
              ) : preview.canCommit ? (
                <>
                  <label>
                    <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                    I have reviewed the preview and authorise this import.
                  </label>
                  <button
                    type="button"
                    className="data-import-primary"
                    onClick={commitImport}
                    disabled={!reviewed || busy !== ""}
                  >
                    {busy === "commit" ? <RefreshCw className="is-spinning" size={17} /> : <EntityIcon size={17} />}
                    {busy === "commit" ? "Importing…" : `Import ${config.label.toLowerCase()}`}
                  </button>
                </>
              ) : (
                <p><ShieldCheck size={18} /> All matching records will be skipped. No database changes are available.</p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="data-import-history">
        <div className="data-import-review-heading">
          <div>
            <span className="data-import-eyebrow">Audit trail</span>
            <h2>Recent imports</h2>
          </div>
          <button type="button" className="data-import-secondary" onClick={loadHistory}>
            <History size={17} /> Refresh history
          </button>
        </div>
        {history.length ? (
          <div className="data-import-table-wrap">
            <table className="data-import-table">
              <thead><tr><th>Date</th><th>File</th><th>Type</th><th>Result</th><th>Requested by</th></tr></thead>
              <tbody>
                {history.map((job) => (
                  <tr key={job._id}>
                    <td>{formatDateTime(job.createdAt)}</td>
                    <td><strong>{job.fileName}</strong></td>
                    <td>{titleCase(job.entityType)}</td>
                    <td>
                      <span className={`data-import-badge data-import-badge-${job.status}`}>{titleCase(job.status)}</span>
                      <small>{job.summary?.created || 0} created · {job.summary?.updated || 0} updated · {job.summary?.failed || 0} failed</small>
                    </td>
                    <td>{job.requestedBy?.name || job.requestedBy?.email || "Administrator"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="data-import-empty"><History size={26} /><p>No completed imports yet.</p></div>
        )}
      </section>
    </main>
  );
}
