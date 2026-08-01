import * as waitlistService from "./waitlistService.js";

/*
|--------------------------------------------------------------------------
| Create waiting-list entry
|--------------------------------------------------------------------------
*/

export async function create(
  request,
  response
) {
  const entry =
    await waitlistService.createEntry(
      request.body,
      request.user
    );

  return response
    .status(201)
    .json(entry);
}

/*
|--------------------------------------------------------------------------
| List and retrieve entries
|--------------------------------------------------------------------------
*/

export async function list(
  request,
  response
) {
  const result =
    await waitlistService.listEntries(
      request.query
    );

  return response
    .status(200)
    .json(result);
}

export async function get(
  request,
  response
) {
  const entry =
    await waitlistService.getEntry(
      request.params.id
    );

  return response
    .status(200)
    .json(entry);
}

export async function summary(
  request,
  response
) {
  const result =
    await waitlistService.getSummary();

  return response
    .status(200)
    .json(result);
}

/*
|--------------------------------------------------------------------------
| Update waiting-list entry
|--------------------------------------------------------------------------
*/

export async function update(
  request,
  response
) {
  const entry =
    await waitlistService.updateEntry(
      request.params.id,
      request.body,
      request.user
    );

  return response
    .status(200)
    .json(entry);
}

/*
|--------------------------------------------------------------------------
| Match customers to an available slot
|--------------------------------------------------------------------------
*/

export async function matches(
  request,
  response
) {
  const items =
    await waitlistService.matchAvailableSlot(
      request.query
    );

  return response
    .status(200)
    .json({
      items,
      total: items.length,
    });
}

/*
|--------------------------------------------------------------------------
| Convert waiting-list entry into appointment
|--------------------------------------------------------------------------
*/

export async function convert(
  request,
  response
) {
  const result =
    await waitlistService.convertToAppointment(
      request.params.id,
      request.body,
      request.user
    );

  return response
    .status(201)
    .json({
      message:
        "Waiting-list entry converted into an appointment.",
      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| Expire stale entries manually
|--------------------------------------------------------------------------
*/

export async function expire(
  request,
  response
) {
  const now =
    request.body?.now ||
    request.query?.now ||
    new Date();

  const parsedDate =
    new Date(now);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    const error =
      new Error(
        "The expiry date is invalid."
      );

    error.statusCode = 400;
    error.status = 400;

    throw error;
  }

  const result =
    await waitlistService.expireStaleEntries(
      parsedDate
    );

  return response
    .status(200)
    .json({
      message:
        `${result.expired} waiting-list entr${
          result.expired === 1
            ? "y"
            : "ies"
        } expired.`,
      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| Delete waiting-list entry
|--------------------------------------------------------------------------
*/

export async function remove(
  request,
  response
) {
  const options = {
    ...request.query,
    ...(
      request.body &&
      typeof request.body ===
        "object"
        ? request.body
        : {}
    ),
  };

  const result =
    await waitlistService.deleteEntry(
      request.params.id,
      options
    );

  return response
    .status(200)
    .json(result);
}

export default {
  create,
  list,
  get,
  summary,
  update,
  matches,
  convert,
  expire,
  remove,
};