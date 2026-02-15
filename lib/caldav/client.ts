import { DAVClient, DAVCalendar, DAVCalendarObject } from "tsdav";
import { CalDavAccount, CalDavCalendar } from "@prisma/client";
import { decryptPassword } from "./crypto";
import { CalDavConnectionError, CalDavAuthError } from "./errors";
import { serverRequiresDigest, createDigestFetch } from "./digest-auth";

export interface CalDavResource {
  href: string;
  etag: string;
  icalData: string;
}

export interface DiscoveredCalendar {
  url: string;
  displayName: string | null;
  color: string | null;
  ctag: string | null;
  syncToken: string | null;
  componentType: "VTODO" | "VEVENT";
}

/**
 * Create an authenticated DAVClient from a CalDavAccount.
 */
export async function createCalDavClient(
  account: CalDavAccount,
): Promise<DAVClient> {
  try {
    const password = decryptPassword(
      account.encryptedPassword,
      account.passwordIV,
    );

    const useDigest = await serverRequiresDigest(account.serverUrl);

    if (useDigest) {
      const digestFetch = createDigestFetch(account.username, password);
      const client = new DAVClient({
        serverUrl: account.serverUrl,
        credentials: {
          username: account.username,
          password,
        },
        authMethod: "Custom",
        authFunction: async () => ({}),
        defaultAccountType: "caldav",
        fetch: digestFetch,
      });

      await client.login();
      return client;
    }

    const client = new DAVClient({
      serverUrl: account.serverUrl,
      credentials: {
        username: account.username,
        password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    await client.login();

    return client;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("401") || error.message.includes("auth"))
    ) {
      throw new CalDavAuthError();
    }
    throw new CalDavConnectionError(
      `Failed to connect to CalDAV server: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Discover calendars on the server.
 */
export async function discoverCalendars(
  client: DAVClient,
): Promise<DiscoveredCalendar[]> {
  try {
    const calendars = await client.fetchCalendars();

    console.log(`[caldav-discovery] Found ${calendars.length} calendar(s)`);
    for (const cal of calendars) {
      const name = typeof cal.displayName === "string" ? cal.displayName : "(unnamed)";
      const components = cal.components?.join(", ") || "none reported";
      console.log(`[caldav-discovery]   - "${name}" url=${cal.url} components=[${components}]`);
    }

    return calendars.map((cal: DAVCalendar) => {
      // Determine component type from supported components
      const supportsTodo = cal.components?.includes("VTODO");
      const componentType = supportsTodo ? "VTODO" : "VEVENT";

      const displayName = typeof cal.displayName === "string"
        ? cal.displayName
        : null;

      return {
        url: cal.url,
        displayName,
        color: null,
        ctag: (cal.ctag as string) || null,
        syncToken: (cal.syncToken as string) || null,
        componentType: componentType as "VTODO" | "VEVENT",
      };
    });
  } catch (error) {
    throw new CalDavConnectionError(
      `Failed to discover calendars: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Fetch changed resources since last sync.
 * Uses full fetch (etag comparison done by caller).
 */
export async function fetchChangedResources(
  client: DAVClient,
  calendar: CalDavCalendar,
): Promise<{
  resources: CalDavResource[];
  deletedHrefs: string[];
  newSyncToken: string | null;
}> {
  try {
    // tsdav defaults to VEVENT filter — we must pass the correct filter
    // for the calendar's component type so VTODOs are actually fetched
    const compFilter =
      calendar.componentType === "VTODO"
        ? {
            "comp-filter": {
              _attributes: { name: "VCALENDAR" },
              "comp-filter": {
                _attributes: { name: "VTODO" },
              },
            },
          }
        : {
            "comp-filter": {
              _attributes: { name: "VCALENDAR" },
              "comp-filter": {
                _attributes: { name: "VEVENT" },
              },
            },
          };

    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendar.calendarUrl },
      filters: [compFilter],
    });

    const resources: CalDavResource[] = (objects || [])
      .filter((obj: DAVCalendarObject) => obj.data)
      .map((obj: DAVCalendarObject) => ({
        href: obj.url,
        etag: obj.etag || "",
        icalData: obj.data,
      }));

    return {
      resources,
      deletedHrefs: [],
      newSyncToken: null,
    };
  } catch (error) {
    throw new CalDavConnectionError(
      `Failed to fetch resources: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Fetch a single resource by href.
 */
export async function fetchResource(
  client: DAVClient,
  calendarUrl: string,
  href: string,
): Promise<{ icalData: string; etag: string } | null> {
  try {
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      objectUrls: [href],
    });

    if (objects && objects.length > 0 && objects[0].data) {
      return {
        icalData: objects[0].data,
        etag: objects[0].etag || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create or update a resource on the server.
 */
export async function putResource(
  client: DAVClient,
  calendarUrl: string,
  href: string,
  icalData: string,
  etag?: string,
): Promise<{ newEtag: string; href: string }> {
  try {
    const result = await client.createCalendarObject({
      calendar: { url: calendarUrl },
      filename: href.split("/").pop() || `${Date.now()}.ics`,
      iCalString: icalData,
      headers: etag ? { "If-Match": etag } : undefined,
    });

    // createCalendarObject returns a Response
    const newEtag = (result as Response).headers?.get?.("etag") || "";

    return {
      newEtag,
      href,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("412")
    ) {
      throw new Error("PRECONDITION_FAILED");
    }
    throw new CalDavConnectionError(
      `Failed to put resource: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Delete a resource from the server.
 */
export async function deleteResource(
  client: DAVClient,
  href: string,
  etag?: string,
): Promise<void> {
  try {
    await client.deleteCalendarObject({
      calendarObject: {
        url: href,
        etag: etag || undefined,
      },
    });
  } catch (error) {
    throw new CalDavConnectionError(
      `Failed to delete resource: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
