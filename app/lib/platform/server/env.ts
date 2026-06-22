export class MissingServerEnvError extends Error {
  constructor(readonly variableNames: string[]) {
    super(`Missing required server environment: ${variableNames.join(", ")}`);
    this.name = "MissingServerEnvError";
  }
}

type EnvSource = Record<string, string | undefined>;

function requireEnvValue(variableName: string, source: EnvSource) {
  const value = source[variableName]?.trim();

  if (!value) {
    throw new MissingServerEnvError([variableName]);
  }

  return value;
}

function collectMissingEnv(variableNames: string[], source: EnvSource) {
  return variableNames.filter((variableName) => !source[variableName]?.trim());
}

export function isMissingServerEnvError(error: unknown) {
  return error instanceof MissingServerEnvError;
}

export function getSupabaseAnonConfig(source: EnvSource = process.env) {
  const requiredNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missingNames = collectMissingEnv(requiredNames, source);

  if (missingNames.length > 0) {
    throw new MissingServerEnvError(missingNames);
  }

  return {
    anonKey: requireEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", source),
    url: requireEnvValue("NEXT_PUBLIC_SUPABASE_URL", source),
  };
}

export function getSupabaseServiceConfig(source: EnvSource = process.env) {
  const anonConfig = getSupabaseAnonConfig(source);
  const serviceRoleKey = requireEnvValue("SUPABASE_SERVICE_ROLE_KEY", source);

  return {
    ...anonConfig,
    serviceRoleKey,
  };
}
