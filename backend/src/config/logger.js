function serializeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    stack:
      process.env.NODE_ENV === "production"
        ? undefined
        : error?.stack,
  };
}

function emit(level, message, context = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const output = JSON.stringify(record);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info(message, context) {
    emit("info", message, context);
  },
  warn(message, context) {
    emit("warn", message, context);
  },
  error(message, error, context = {}) {
    emit("error", message, {
      ...context,
      error: serializeError(error),
    });
  },
};
