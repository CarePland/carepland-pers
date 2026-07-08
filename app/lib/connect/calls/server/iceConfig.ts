export type ConnectIceConfig = {
  hasTurnServer: boolean;
  iceServerCount: number;
  iceServers: RTCIceServer[];
  source: "default" | "public_env" | "server_env" | "twilio";
};

type IceEnv = Record<string, string | undefined>;
type FetchIceToken = (
  input: string,
  init: {
    headers: Record<string, string>;
    method: "POST";
    signal?: AbortSignal;
  }
) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

const defaultIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const twilioTokenTimeoutMs = 5000;

export async function resolveConnectIceConfig(options: {
  env?: IceEnv;
  fetchIceToken?: FetchIceToken;
} = {}): Promise<ConnectIceConfig> {
  const env = options.env ?? process.env;
  const twilioIceConfig = await twilioIceConfigFromEnv(env, options.fetchIceToken);
  if (twilioIceConfig) return twilioIceConfig;

  return connectIceConfigFromEnv(env);
}

export function connectIceConfigFromEnv(env: IceEnv = process.env): ConnectIceConfig {
  const serverEnvServers = configuredIceServersFromEnv(env, {
    iceServersJsonKey: "CONNECT_ICE_SERVERS_JSON",
    source: "server_env",
    stunUrlsKey: "CONNECT_STUN_URLS",
    turnCredentialKey: "CONNECT_TURN_CREDENTIAL",
    turnUrlsKey: "CONNECT_TURN_URLS",
    turnUsernameKey: "CONNECT_TURN_USERNAME",
  });
  if (serverEnvServers) return serverEnvServers;

  const publicEnvServers = configuredIceServersFromEnv(env, {
    iceServersJsonKey: "NEXT_PUBLIC_CONNECT_ICE_SERVERS_JSON",
    source: "public_env",
    stunUrlsKey: "NEXT_PUBLIC_CONNECT_STUN_URLS",
    turnCredentialKey: "NEXT_PUBLIC_CONNECT_TURN_CREDENTIAL",
    turnUrlsKey: "NEXT_PUBLIC_CONNECT_TURN_URLS",
    turnUsernameKey: "NEXT_PUBLIC_CONNECT_TURN_USERNAME",
  });
  if (publicEnvServers) return publicEnvServers;

  return toIceConfig(defaultIceServers, "default");
}

export async function twilioIceConfigFromEnv(
  env: IceEnv = process.env,
  fetchIceToken: FetchIceToken = fetch
) {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), twilioTokenTimeoutMs);
  try {
    const response = await fetchIceToken(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        accountSid
      )}/Tokens.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
        method: "POST",
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      console.warn("[connect:calls:ice-config] Twilio token request failed", {
        source: "twilio",
        status: response.status,
      });
      return null;
    }

    const payload = await response.json().catch(() => null);
    const iceServers = parseTwilioIceServers(payload);
    if (iceServers.length === 0) {
      console.warn("[connect:calls:ice-config] Twilio token response had no ICE servers", {
        source: "twilio",
      });
      return null;
    }

    return toIceConfig(iceServers, "twilio");
  } catch (error) {
    console.warn("[connect:calls:ice-config] Twilio token request unavailable", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      source: "twilio",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function iceServerUsesTurn(server: RTCIceServer) {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
  return urls.some((url) => String(url || "").startsWith("turn:"));
}

function configuredIceServersFromEnv(
  env: IceEnv,
  keys: {
    iceServersJsonKey: string;
    source: ConnectIceConfig["source"];
    stunUrlsKey: string;
    turnCredentialKey: string;
    turnUrlsKey: string;
    turnUsernameKey: string;
  }
) {
  const jsonServers = parseIceServersJson(env[keys.iceServersJsonKey]);
  if (jsonServers.length > 0) return toIceConfig(jsonServers, keys.source);

  const stunUrls = splitIceUrls(env[keys.stunUrlsKey]);
  const turnUrls = splitIceUrls(env[keys.turnUrlsKey]);
  if (stunUrls.length === 0 && turnUrls.length === 0) return null;

  const servers: RTCIceServer[] = [];
  if (stunUrls.length > 0) servers.push({ urls: stunUrls });
  if (turnUrls.length > 0) {
    servers.push({
      credential: env[keys.turnCredentialKey],
      urls: turnUrls,
      username: env[keys.turnUsernameKey],
    });
  }

  return toIceConfig(servers, keys.source);
}

function toIceConfig(
  iceServers: RTCIceServer[],
  source: ConnectIceConfig["source"]
): ConnectIceConfig {
  return {
    hasTurnServer: iceServers.some(iceServerUsesTurn),
    iceServerCount: iceServers.length,
    iceServers,
    source,
  };
}

function parseIceServersJson(value: string | undefined) {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isIceServer);
  } catch {
    return [];
  }
}

function parseTwilioIceServers(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const iceServers = (payload as { ice_servers?: unknown; iceServers?: unknown }).ice_servers ??
    (payload as { iceServers?: unknown }).iceServers;
  if (!Array.isArray(iceServers)) return [];

  return iceServers.filter(isIceServer);
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const urls = (value as { urls?: unknown }).urls;
  if (typeof urls === "string") return Boolean(urls.trim());
  if (Array.isArray(urls)) {
    return urls.some((url) => typeof url === "string" && Boolean(url.trim()));
  }
  return false;
}

function splitIceUrls(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}
