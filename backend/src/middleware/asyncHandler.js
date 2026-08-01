export default function asyncHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("asyncHandler requires a middleware function.");
  }

  return function wrappedAsyncHandler(request, response, next) {
    return Promise.resolve(handler(request, response, next)).catch(next);
  };
}
