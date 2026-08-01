export default class AppError extends Error {
  constructor(
    message,
    {
      statusCode = 500,
      code = "INTERNAL_ERROR",
      details,
      expose = statusCode < 500,
      cause,
    } = {}
  ) {
    super(message, { cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}
