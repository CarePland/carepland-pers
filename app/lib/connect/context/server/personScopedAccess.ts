import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "../../../platform/server/supabase";
import {
  type ReceiverShellBindingRecord,
  ReceiverShellBindingError,
  verifyReceiverShellBinding,
} from "../../receiverShell/claimStore";

import { verifyConnectPersonAccessForRequest } from "./mainConnectUserContext";

export const receiverDeviceIdHeader = "x-carepland-receiver-device-id";
export const receiverInstallIdHeader = "x-carepland-receiver-install-id";

type UserAccess = Awaited<ReturnType<typeof verifyConnectPersonAccessForRequest>>;

export type ConnectPersonScopedAccess =
  | {
      accessToken: string;
      accessType: "user";
      careCircleId: string;
      createdByUserId: string;
      mainConnectUserPersonId: string;
      supabase: SupabaseClient;
      userContext: UserAccess["userContext"];
    }
  | {
      accessToken: "";
      accessType: "receiver_device";
      careCircleId: string;
      createdByUserId: null;
      mainConnectUserPersonId: string;
      receiverContactDisplayName?: string;
      receiverContactIsReceiverUser?: boolean;
      receiverContactUserId?: string;
      receiverDeviceId: string;
      receiverInstallId: string;
      supabase: SupabaseClient;
      userContext: null;
    };

type ReadConnectPersonScopedAccessOptions = {
  body?: Record<string, unknown>;
  createReceiverClient?: () => SupabaseClient;
  createUserClient?: (accessToken: string) => SupabaseClient;
  receiverIndexPath?: string;
  verifyUserAccess?: typeof verifyConnectPersonAccessForRequest;
};

type ReadReceiverDeviceScopedAccessOptions = {
  body?: Record<string, unknown>;
  receiverIndexPath?: string;
};

export class ReceiverDeviceAccessError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code = "receiver_setup_required") {
    super(message);
    this.name = "ReceiverDeviceAccessError";
    this.status = status;
    this.code = code;
  }
}

export async function readConnectPersonScopedAccess(
  request: Request,
  personId: string,
  options: ReadConnectPersonScopedAccessOptions = {}
): Promise<ConnectPersonScopedAccess> {
  const requestedPersonId = personId.trim();
  const receiverCredentials = receiverDeviceCredentialsFromRequest(
    request,
    options.body
  );

  if (receiverCredentials.hasAnyCredential) {
    if (!receiverCredentials.receiverDeviceId || !receiverCredentials.receiverInstallId) {
      throw new ReceiverDeviceAccessError("Receiver setup is incomplete.", 401);
    }

    try {
      const binding = await verifyReceiverShellBinding(
        {
          receiverDeviceId: receiverCredentials.receiverDeviceId,
          receiverInstallId: receiverCredentials.receiverInstallId,
        },
        { indexPath: options.receiverIndexPath }
      );
      const boundPersonId = binding.mainConnectUserPersonId?.trim() || "";
      const careCircleId = binding.careCircleId?.trim() || "";

      if (!boundPersonId || !careCircleId) {
        throw new ReceiverDeviceAccessError(
          "Receiver setup is required before this device can access CarePland.",
          409
        );
      }

      if (requestedPersonId && requestedPersonId !== boundPersonId) {
        throw new ReceiverDeviceAccessError(
          "This Receiver is not approved for that person.",
          403,
          "receiver_person_mismatch"
        );
      }

      return {
        accessToken: "",
        accessType: "receiver_device",
        careCircleId,
        createdByUserId: null,
        mainConnectUserPersonId: boundPersonId,
        receiverContactDisplayName: binding.receiverContactDisplayName,
        receiverContactIsReceiverUser: binding.receiverContactIsReceiverUser,
        receiverContactUserId: binding.receiverContactUserId,
        receiverDeviceId: binding.receiverDeviceId,
        receiverInstallId: binding.receiverInstallId,
        supabase: (options.createReceiverClient ?? createSupabaseServiceClient)(),
        userContext: null,
      };
    } catch (error) {
      if (error instanceof ReceiverDeviceAccessError) {
        throw error;
      }
      if (error instanceof ReceiverShellBindingError) {
        throw new ReceiverDeviceAccessError(
          "Receiver setup is required before this device can access CarePland.",
          receiverSetupStatus(error.status)
        );
      }
      throw error;
    }
  }

  const verifyUserAccess =
    options.verifyUserAccess ?? verifyConnectPersonAccessForRequest;
  const userAccess = await verifyUserAccess(requestedPersonId, request);
  return {
    accessToken: userAccess.accessToken,
    accessType: "user",
    careCircleId: userAccess.careCircleId,
    createdByUserId: userAccess.userContext.userId,
    mainConnectUserPersonId: userAccess.mainConnectUserPersonId,
    supabase: (options.createUserClient ?? createSupabaseUserClient)(
      userAccess.accessToken
    ),
    userContext: userAccess.userContext,
  };
}

export async function readReceiverDeviceScopedAccess(
  request: Request,
  options: ReadReceiverDeviceScopedAccessOptions = {}
): Promise<ReceiverShellBindingRecord> {
  const receiverCredentials = receiverDeviceCredentialsFromRequest(
    request,
    options.body
  );

  if (!receiverCredentials.receiverDeviceId || !receiverCredentials.receiverInstallId) {
    throw new ReceiverDeviceAccessError("Receiver setup is incomplete.", 401);
  }

  try {
    return await verifyReceiverShellBinding(
      {
        receiverDeviceId: receiverCredentials.receiverDeviceId,
        receiverInstallId: receiverCredentials.receiverInstallId,
      },
      { indexPath: options.receiverIndexPath }
    );
  } catch (error) {
    if (error instanceof ReceiverShellBindingError) {
      throw new ReceiverDeviceAccessError(
        "Receiver setup is required before this device can access CarePland.",
        receiverSetupStatus(error.status)
      );
    }
    throw error;
  }
}

export function receiverDeviceCredentialsFromRequest(
  request: Request,
  body?: Record<string, unknown>
) {
  const url = new URL(request.url);
  const receiverDeviceId =
    headerValue(request, receiverDeviceIdHeader) ||
    stringValue(body?.receiverDeviceId) ||
    url.searchParams.get("receiverDeviceId")?.trim() ||
    "";
  const receiverInstallId =
    headerValue(request, receiverInstallIdHeader) ||
    stringValue(body?.receiverInstallId) ||
    url.searchParams.get("receiverInstallId")?.trim() ||
    "";

  return {
    hasAnyCredential: Boolean(receiverDeviceId || receiverInstallId),
    receiverDeviceId,
    receiverInstallId,
  };
}

export function receiverDeviceSetupRequiredBody(error: ReceiverDeviceAccessError) {
  return {
    error: error.message,
    ok: false,
    receiverSetupRequired: error.code === "receiver_setup_required",
  };
}

function receiverSetupStatus(status: number) {
  if (status === 403) return 403;
  if (status === 409) return 409;
  return 401;
}

function headerValue(request: Request, name: string) {
  return request.headers.get(name)?.trim() || "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
