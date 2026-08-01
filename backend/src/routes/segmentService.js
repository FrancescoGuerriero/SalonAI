import * as service from "./reportService.js";

export async function summary(req, res) {
  res.json(
    await service.reportSummary(req.query)
  );
}

export async function appointmentsCsv(req, res) {
  const csv = await service.appointmentsCsv(
    req.query
  );

  res.setHeader(
    "Content-Type",
    "text/csv; charset=utf-8"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="salonai-appointments.csv"'
  );
  res.send(csv);
}

export async function communicationsCsv(req, res) {
  const csv = await service.communicationsCsv(
    req.query
  );

  res.setHeader(
    "Content-Type",
    "text/csv; charset=utf-8"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="salonai-communications.csv"'
  );
  res.send(csv);
}

export async function workbook(req, res) {
  const buffer =
    await service.managementWorkbook(req.query);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="salonai-management-report.xlsx"'
  );
  res.send(Buffer.from(buffer));
}
