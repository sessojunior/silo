import { config } from "../config/index";

export type RestConsumerInstance = {
  groupId: string;
  instanceId: string;
  baseUri: string;
};

const JSON_V2 = "application/vnd.kafka.v2+json";
const JSON_RECORDS = "application/vnd.kafka.json.v2+json";

function baseUrl() {
  const url = config.kafka.restProxyUrl;
  if (!url) throw new Error("KAFKA_REST_PROXY_URL not configured");
  return url.replace(/\/$/, "");
}

function buildHeaders(contentType?: string, accept?: string) {
  const h: Record<string, string> = {};
  if (contentType) h["Content-Type"] = contentType;
  if (accept) h["Accept"] = accept;
  const auth = config.kafka.restProxyAuth;
  if (auth && auth.length > 0) {
    h["Authorization"] = auth;
  }
  return h;
}

export async function createRestConsumer(
  groupId: string,
  instanceName?: string,
  offsetReset: "earliest" | "latest" = "latest",
) {
  const url = baseUrl();
  const name = instanceName || `inst-${Math.random().toString(16).slice(2)}`;
  const body = {
    name,
    format: "json",
    "auto.offset.reset": offsetReset,
    "auto.commit.enable": "false",
  } as Record<string, unknown>;

  const res = await fetch(`${url}/consumers/${groupId}`, {
    method: "POST",
    headers: buildHeaders(JSON_V2, JSON_V2),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`createRestConsumer failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const d = data as Record<string, unknown>;
  const instanceId = (d.instance_id || d.instanceId || name) as string;
  const base_uri = (d.base_uri ||
    d.baseUri ||
    `/consumers/${groupId}/instances/${instanceId}`) as string;
  const base = base_uri.startsWith("http")
    ? base_uri
    : `${url}${base_uri.startsWith("/") ? base_uri : `/${base_uri}`}`;
  return { groupId, instanceId, baseUri: base } as RestConsumerInstance;
}

export async function subscribeRest(
  instance: RestConsumerInstance,
  topics: string[],
) {
  const res = await fetch(`${instance.baseUri}/subscription`, {
    method: "POST",
    headers: buildHeaders(JSON_V2, JSON_V2),
    body: JSON.stringify({ topics }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`subscribeRest failed: ${res.status} ${txt}`);
  }
}

export type RestRecord = {
  topic: string;
  partition: number;
  offset: string;
  key?: string | null;
  value?: unknown;
};

export async function fetchRecordsRest(
  instance: RestConsumerInstance,
  timeoutMs = 10000,
): Promise<RestRecord[]> {
  const res = await fetch(`${instance.baseUri}/records?timeout=${timeoutMs}`, {
    method: "GET",
    headers: buildHeaders(undefined, JSON_RECORDS),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fetchRecordsRest failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    topic: r.topic as string,
    partition: r.partition as number,
    offset: r.offset as string,
    key: (r.key as string | null | undefined) ?? null,
    value: r.value as unknown,
  })) as RestRecord[];
}

export async function commitOffsetsRest(
  instance: RestConsumerInstance,
  offsets: Array<{ topic: string; partition: number; offset: string }>,
) {
  const res = await fetch(`${instance.baseUri}/offsets`, {
    method: "POST",
    headers: buildHeaders(JSON_V2, JSON_V2),
    body: JSON.stringify({ offsets }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`commitOffsetsRest failed: ${res.status} ${txt}`);
  }
}

export async function deleteRestConsumer(instance: RestConsumerInstance) {
  const res = await fetch(instance.baseUri, {
    method: "DELETE",
    headers: buildHeaders(undefined, JSON_V2),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`deleteRestConsumer failed: ${res.status} ${txt}`);
  }
}

export async function produceRecordRest(
  topic: string,
  value: string | object,
  key?: string,
) {
  const url = baseUrl();
  const res = await fetch(`${url}/topics/${topic}`, {
    method: "POST",
    headers: buildHeaders("application/vnd.kafka.json.v2+json", JSON_V2),
    body: JSON.stringify({ records: [{ key: key ?? null, value }] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`produceRecordRest failed: ${res.status} ${txt}`);
  }
}
