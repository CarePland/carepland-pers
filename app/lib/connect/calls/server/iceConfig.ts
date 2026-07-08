export type ConnectIceConfig = {
  hasTurnServer: boolean;
  iceServerCount: number;
  iceServers: RTCIceServer[];
  source: "default" | "public_env" | "server_env";
};

type IceEnv = Record<string, string | undefined>;

const defaultIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

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
