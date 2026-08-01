export function createServiceError(
  message,
  statusCode = 400,
  details
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

export function assertFound(value, message = "Record not found.") {
  if (!value) {
    throw createServiceError(message, 404);
  }

  return value;
}
