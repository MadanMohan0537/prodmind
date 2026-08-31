export class ConnectorError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ConnectorError";
    this.details = details;
  }
}

export const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function fetchWithRetry(url, options = {}, policy = {}) {
  const retries = policy.retries ?? 3;
  const baseDelay = policy.baseDelay ?? 250;
  const fetcher = policy.fetcher ?? fetch;
  const sleeper = policy.sleeper ?? wait;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetcher(url, options);
      if (response.ok) return response;
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === retries) throw new ConnectorError(`Connector request failed with ${response.status}`, { url, status: response.status });
      const retryAfter = Number(response.headers.get("Retry-After")) * 1000;
      await sleeper(retryAfter || baseDelay * 2 ** attempt + Math.random() * 100);
    } catch (error) {
      if (attempt === retries || error instanceof ConnectorError) throw error;
      await sleeper(baseDelay * 2 ** attempt + Math.random() * 100);
    }
  }
  throw new ConnectorError("Retry policy exhausted", { url });
}

export class JsonApiConnector {
  constructor({ name, endpoint, headers = {}, mapRecord, nextPage, extractItems, fetcher = fetch }) {
    this.name = name;
    this.endpoint = endpoint;
    this.headers = headers;
    this.mapRecord = mapRecord;
    this.nextPage = nextPage;
    this.extractItems = extractItems;
    this.fetcher = fetcher;
  }

  async *records({ cursor, signal } = {}) {
    let url = cursor || this.endpoint;
    while (url) {
      const response = await fetchWithRetry(url, { headers: this.headers, signal }, { fetcher: this.fetcher });
      const payload = await response.json();
      const items = this.extractItems
        ? this.extractItems(payload)
        : Array.isArray(payload) ? payload : payload.items || payload.results || payload.data || [];
      for (const item of items) {
        yield { ...this.mapRecord(item), source: this.name, metadata: { connector: this.name, originalId: item.id } };
      }
      url = this.nextPage ? this.nextPage(payload, response) : null;
    }
  }
}

export function createZendeskConnector({ subdomain, token, email, fetcher, cursor, startTime }) {
  const authorization = `Basic ${btoa(`${email}/token:${token}`)}`;
  const endpoint = cursor
    ? `https://${subdomain}.zendesk.com/api/v2/incremental/tickets/cursor.json?cursor=${encodeURIComponent(cursor)}`
    : `https://${subdomain}.zendesk.com/api/v2/incremental/tickets/cursor.json?start_time=${startTime ?? Math.floor(Date.now() / 1000) - 3600}`;
  const state = { cursor: cursor || null };
  const connector = new JsonApiConnector({
    name: "zendesk",
    endpoint,
    headers: { Authorization: authorization, Accept: "application/json" },
    fetcher,
    extractItems: payload => (payload.tickets || []).filter(item => item.description || item.subject),
    mapRecord: item => ({
      id: `zendesk-${item.id}`,
      text: item.description || item.subject,
      customer: String(item.requester_id || "Anonymous"),
      createdAt: item.created_at
    }),
    nextPage: payload => {
      if (payload.after_cursor) state.cursor = payload.after_cursor;
      return payload.end_of_stream ? null : payload.after_url;
    }
  });
  connector.state = state;
  return connector;
}
