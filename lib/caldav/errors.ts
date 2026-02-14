import { BaseServerError } from "@/lib/customError";

export class CalDavConnectionError extends BaseServerError {
  constructor(message = "Failed to connect to CalDAV server") {
    super(message, 502);
  }
}

export class CalDavAuthError extends BaseServerError {
  constructor(message = "CalDAV authentication failed") {
    super(message, 401);
  }
}

export class CalDavSyncError extends BaseServerError {
  constructor(message = "CalDAV sync failed") {
    super(message, 500);
  }
}
