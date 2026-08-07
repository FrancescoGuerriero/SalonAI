function csvError(message) {
  const error = new Error(message);
  error.name = "CsvFormatError";
  return error;
}

export function parseCsv(source) {
  const text = String(source ?? "");
  if (!text.trim()) throw csvError("The CSV file is empty.");

  const matrix = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (quoted) throw csvError("The CSV file contains an unclosed quoted value.");
  if (cell || row.length) {
    row.push(cell);
    matrix.push(row);
  }

  const nonEmptyRows = matrix.filter((values) => values.some((value) => String(value).trim()));
  if (!nonEmptyRows.length) throw csvError("The CSV file is empty.");

  const headers = nonEmptyRows[0].map((value, index) => {
    const textValue = String(value);
    const withoutBom = index === 0 && textValue.startsWith("\uFEFF")
      ? textValue.slice(1)
      : textValue;

    return withoutBom.trim();
  });
  if (headers.some((header) => !header)) throw csvError("Every CSV column must have a header.");

  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    throw csvError(`Duplicate CSV header: ${duplicateHeaders[0]}.`);
  }

  const rows = nonEmptyRows.slice(1).map((values, index) => {
    if (values.length > headers.length && values.slice(headers.length).some((value) => String(value).trim())) {
      throw csvError(`CSV row ${index + 2} contains more values than the header row.`);
    }
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, columnIndex) => {
      record[header] = String(values[columnIndex] ?? "").trim();
    });
    return record;
  });

  if (!rows.length) throw csvError("The CSV file contains headers but no data rows.");
  return { headers, rows };
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function stringifyCsv(records, headers) {
  const columns = Array.isArray(headers) && headers.length
    ? headers
    : Object.keys(records?.[0] || {}).filter((header) => header !== "__rowNumber");
  return [
    columns.map(escapeCsvValue).join(","),
    ...(records || []).map((record) =>
      columns.map((header) => escapeCsvValue(record?.[header])).join(",")
    ),
  ].join("\r\n");
}

export function downloadCsv(fileName, records, headers) {
  const blob = new Blob(["\uFEFF", stringifyCsv(records, headers)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
