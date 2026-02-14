import { createHash, randomBytes } from "crypto";

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

/**
 * Parse a WWW-Authenticate: Digest header into its components.
 */
function parseDigestChallenge(header: string): DigestChallenge | null {
  if (!header.startsWith("Digest ")) return null;
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  if (!params.realm || !params.nonce) return null;
  return {
    realm: params.realm,
    nonce: params.nonce,
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

/**
 * Compute the Digest Authorization header value.
 */
function computeDigestAuth(
  challenge: DigestChallenge,
  method: string,
  uri: string,
  username: string,
  password: string,
): string {
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  let nc: string | undefined;
  let cnonce: string | undefined;

  if (challenge.qop?.includes("auth")) {
    nc = "00000001";
    cnonce = randomBytes(8).toString("hex");
    response = md5(
      `${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`,
    );
  } else {
    response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
  }

  let header = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;

  if (challenge.qop?.includes("auth")) {
    header += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  }
  if (challenge.opaque) {
    header += `, opaque="${challenge.opaque}"`;
  }
  if (challenge.algorithm) {
    header += `, algorithm=${challenge.algorithm}`;
  }

  return header;
}

/**
 * Create a fetch wrapper that handles HTTP Digest authentication.
 * On a 401 with a Digest challenge, it retries with the proper Authorization header.
 */
export function createDigestFetch(
  username: string,
  password: string,
): typeof fetch {
  let cachedChallenge: DigestChallenge | null = null;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";
    const uri = new URL(url).pathname;

    // If we have a cached challenge, use it right away
    if (cachedChallenge) {
      const authHeader = computeDigestAuth(cachedChallenge, method, uri, username, password);
      const headers = new Headers(init?.headers);
      headers.set("Authorization", authHeader);
      const response = await fetch(input, { ...init, headers });
      if (response.status !== 401) return response;
      // Challenge may have expired, fall through to re-negotiate
    }

    // First request (or cache expired) — may get a 401 challenge
    const firstResponse = await fetch(input, init);
    if (firstResponse.status !== 401) return firstResponse;

    const wwwAuth = firstResponse.headers.get("www-authenticate");
    if (!wwwAuth) return firstResponse;

    const challenge = parseDigestChallenge(wwwAuth);
    if (!challenge) return firstResponse;

    cachedChallenge = challenge;

    const authHeader = computeDigestAuth(challenge, method, uri, username, password);
    const headers = new Headers(init?.headers);
    headers.set("Authorization", authHeader);

    return fetch(input, { ...init, headers });
  };
}

/**
 * Detect whether a server requires Digest auth by making a probe request.
 * Returns true if the server responds with a Digest WWW-Authenticate header.
 */
export async function serverRequiresDigest(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(serverUrl, { method: "OPTIONS" });
    if (response.status === 401) {
      const wwwAuth = response.headers.get("www-authenticate") || "";
      return wwwAuth.includes("Digest");
    }
    return false;
  } catch {
    return false;
  }
}
