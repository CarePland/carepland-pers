package com.carepland.connectreceiver;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import java.util.UUID;

final class ReceiverConfigStore {
    private static final String PREFS_NAME = "carepland_receiver";
    private static final String KEY_RECEIVER_URL = "receiver_url";
    private static final String KEY_SETUP_CODE = "setup_code";
    private static final String KEY_DEVICE_PROFILE = "device_profile";
    private static final String KEY_HARDWARE_PROFILE = "hardware_profile";
    private static final String KEY_UI_LAYOUT = "ui_layout";
    private static final String KEY_INSTALL_ID = "install_id";
    private static final String KEY_RECEIVER_DEVICE_ID = "receiver_device_id";
    private static final String KEY_SETUP_CLAIM = "setup_claim";
    private static final String KEY_BINDING_STATUS = "binding_status";
    private static final String KEY_PROVISIONED_AT_MS = "provisioned_at_ms";
    private static final String KEY_LAST_RECOVERY_ACTION = "last_recovery_action";
    private static final String KEY_LAST_RECOVERY_AT_MS = "last_recovery_at_ms";
    private static final String KEY_RECEIVER_MODE = "receiver_mode";
    private static final String KEY_PROVISIONING_COMPLETED_AT_MS = "provisioning_completed_at_ms";
    private static final String KEY_CAPABILITY_FULLSCREEN = "capability_fullscreen";
    private static final String KEY_CAPABILITY_MICROPHONE = "capability_microphone";
    private static final String KEY_CAPABILITY_KIOSK = "capability_kiosk";
    private static final String KEY_CAPABILITY_KEEP_AWAKE = "capability_keep_awake";
    private static final String KEY_CAPABILITY_BOOT_START = "capability_boot_start";
    private static final String KEY_CAPABILITY_BATTERY_OPTIMIZATION = "capability_battery_optimization";
    private static final String KEY_CAPABILITY_UPDATE_CHECKS = "capability_update_checks";

    private ReceiverConfigStore() {}

    static ReceiverConfig load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String defaultUrl = context.getString(R.string.default_receiver_url);
        String receiverUrl = prefs.getString(KEY_RECEIVER_URL, defaultUrl);
        String setupCode = prefs.getString(KEY_SETUP_CODE, "");
        String deviceProfile = prefs.getString(KEY_DEVICE_PROFILE, "");
        String hardwareProfile = prefs.getString(KEY_HARDWARE_PROFILE, "");
        String uiLayout = prefs.getString(KEY_UI_LAYOUT, "");
        String installId = installId(context, prefs);
        String receiverDeviceId = prefs.getString(KEY_RECEIVER_DEVICE_ID, "");
        String setupClaim = prefs.getString(KEY_SETUP_CLAIM, "");
        String bindingStatus = prefs.getString(KEY_BINDING_STATUS, "");
        long provisionedAtMs = prefs.getLong(KEY_PROVISIONED_AT_MS, 0L);
        String lastRecoveryAction = prefs.getString(KEY_LAST_RECOVERY_ACTION, "");
        long lastRecoveryAtMs = prefs.getLong(KEY_LAST_RECOVERY_AT_MS, 0L);
        String receiverMode = prefs.getString(KEY_RECEIVER_MODE, "");
        long provisioningCompletedAtMs = prefs.getLong(KEY_PROVISIONING_COMPLETED_AT_MS, 0L);

        return new ReceiverConfig(
                receiverUrl,
                setupCode,
                deviceProfile,
                hardwareProfile,
                uiLayout,
                installId,
                receiverDeviceId,
                setupClaim,
                firstNonBlank(bindingStatus, inferredBindingStatus(setupCode, setupClaim, receiverDeviceId)),
                provisionedAtMs,
                lastRecoveryAction,
                lastRecoveryAtMs,
                receiverMode,
                provisioningCompletedAtMs,
                prefs.getString(KEY_CAPABILITY_FULLSCREEN, "unknown"),
                prefs.getString(KEY_CAPABILITY_MICROPHONE, "unknown"),
                prefs.getString(KEY_CAPABILITY_KIOSK, "unknown"),
                prefs.getString(KEY_CAPABILITY_KEEP_AWAKE, "unknown"),
                prefs.getString(KEY_CAPABILITY_BOOT_START, "unknown"),
                prefs.getString(KEY_CAPABILITY_BATTERY_OPTIMIZATION, "unknown"),
                prefs.getString(KEY_CAPABILITY_UPDATE_CHECKS, "unknown")
        );
    }

    static void saveProvisioningUri(Context context, Uri uri) {
        if (uri == null) {
            return;
        }

        SharedPreferences.Editor editor =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        String receiverUrl = firstNonBlank(
                uri.getQueryParameter("receiver_url"),
                uri.getQueryParameter("receiverUrl"),
                uri.getQueryParameter("url")
        );
        String setupCode = firstNonBlank(
                uri.getQueryParameter("code"),
                uri.getQueryParameter("setup_code"),
                uri.getQueryParameter("setupCode"),
                uri.getQueryParameter("token")
        );
        String setupClaim = firstNonBlank(
                uri.getQueryParameter("claim"),
                uri.getQueryParameter("app_claim"),
                uri.getQueryParameter("appClaim"),
                uri.getQueryParameter("nativeClaim"),
                uri.getQueryParameter("native_claim")
        );
        String deviceProfile = firstNonBlank(
                uri.getQueryParameter("device"),
                uri.getQueryParameter("device_profile"),
                uri.getQueryParameter("deviceProfile")
        );
        String hardwareProfile = firstNonBlank(
                uri.getQueryParameter("hardwareProfile"),
                uri.getQueryParameter("hardware_profile"),
                uri.getQueryParameter("profile")
        );
        String uiLayout = firstNonBlank(
                uri.getQueryParameter("uiLayout"),
                uri.getQueryParameter("ui_layout"),
                uri.getQueryParameter("layout")
        );
        String receiverDeviceId = firstNonBlank(
                uri.getQueryParameter("receiverDeviceId"),
                uri.getQueryParameter("receiver_device_id"),
                uri.getQueryParameter("receiverId"),
                uri.getQueryParameter("receiver_id")
        );

        if (isAllowedReceiverUrl(receiverUrl)) {
            editor.putString(KEY_RECEIVER_URL, receiverUrl.trim());
        }
        if (isPresent(setupCode)) {
            editor.putString(KEY_SETUP_CODE, setupCode.trim());
        }
        if (isPresent(setupClaim)) {
            editor.putString(KEY_SETUP_CLAIM, setupClaim.trim());
        }
        if (isPresent(deviceProfile)) {
            editor.putString(KEY_DEVICE_PROFILE, deviceProfile.trim());
        }
        if (isPresent(hardwareProfile)) {
            editor.putString(KEY_HARDWARE_PROFILE, hardwareProfile.trim());
        }
        if (isPresent(uiLayout)) {
            editor.putString(KEY_UI_LAYOUT, uiLayout.trim());
        }
        if (isPresent(receiverDeviceId)) {
            editor.putString(KEY_RECEIVER_DEVICE_ID, receiverDeviceId.trim());
        }
        editor.putString(
                KEY_BINDING_STATUS,
                inferredBindingStatus(setupCode, setupClaim, receiverDeviceId)
        );
        editor.putString(KEY_INSTALL_ID, installId(context));
        editor.putLong(KEY_PROVISIONED_AT_MS, System.currentTimeMillis());
        editor.apply();
    }

    static Uri receiverUri(Context context) {
        ReceiverConfig config = load(context);
        Uri baseUri = Uri.parse(config.receiverUrl);
        Uri.Builder builder = baseUri.buildUpon();

        if (isPresent(config.setupCode) && baseUri.getQueryParameter("setupCode") == null) {
            builder.appendQueryParameter("setupCode", config.setupCode);
        }
        if (isPresent(config.setupClaim) && baseUri.getQueryParameter("setupClaim") == null) {
            builder.appendQueryParameter("setupClaim", config.setupClaim);
        }
        if (isPresent(config.deviceProfile) && baseUri.getQueryParameter("device") == null) {
            builder.appendQueryParameter("device", config.deviceProfile);
        }
        if (isPresent(config.hardwareProfile) && baseUri.getQueryParameter("hardwareProfile") == null) {
            builder.appendQueryParameter("hardwareProfile", config.hardwareProfile);
        }
        if (isPresent(config.uiLayout) && baseUri.getQueryParameter("uiLayout") == null) {
            builder.appendQueryParameter("uiLayout", config.uiLayout);
        }
        if (isPresent(config.installId) && baseUri.getQueryParameter("receiverInstallId") == null) {
            builder.appendQueryParameter("receiverInstallId", config.installId);
        }
        if (isPresent(config.receiverDeviceId) && baseUri.getQueryParameter("receiverDeviceId") == null) {
            builder.appendQueryParameter("receiverDeviceId", config.receiverDeviceId);
        }
        if (isPresent(config.bindingStatus) && baseUri.getQueryParameter("receiverBindingStatus") == null) {
            builder.appendQueryParameter("receiverBindingStatus", config.bindingStatus);
        }
        if (baseUri.getQueryParameter("nativeShell") == null) {
            builder.appendQueryParameter("nativeShell", "android");
        }

        return builder.build();
    }

    static boolean hasProvisioning(Context context) {
        ReceiverConfig config = load(context);
        return isPresent(config.setupCode)
                || isPresent(config.setupClaim)
                || isPresent(config.receiverDeviceId)
                || !config.receiverUrl.equals(context.getString(R.string.default_receiver_url));
    }

    static boolean hasClaimOrBinding(Context context) {
        ReceiverConfig config = load(context);
        return isPresent(config.setupClaim) || isPresent(config.receiverDeviceId);
    }

    static boolean hasCompletedProvisioningWizard(Context context) {
        return load(context).provisioningCompletedAtMs > 0L;
    }

    static boolean isDedicatedReceiverMode(Context context) {
        ReceiverConfig config = load(context);
        return config.provisioningCompletedAtMs > 0L && "dedicated".equals(config.receiverMode);
    }

    static void saveProvisioningProfile(
            Context context,
            String receiverMode,
            CapabilityStatuses capabilityStatuses
    ) {
        SharedPreferences.Editor editor =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_RECEIVER_MODE, normalizedReceiverMode(receiverMode));
        editor.putLong(KEY_PROVISIONING_COMPLETED_AT_MS, System.currentTimeMillis());
        editor.putString(KEY_CAPABILITY_FULLSCREEN, normalizedCapabilityStatus(capabilityStatuses.fullscreen));
        editor.putString(KEY_CAPABILITY_MICROPHONE, normalizedCapabilityStatus(capabilityStatuses.microphone));
        editor.putString(KEY_CAPABILITY_KIOSK, normalizedCapabilityStatus(capabilityStatuses.kiosk));
        editor.putString(KEY_CAPABILITY_KEEP_AWAKE, normalizedCapabilityStatus(capabilityStatuses.keepAwake));
        editor.putString(KEY_CAPABILITY_BOOT_START, normalizedCapabilityStatus(capabilityStatuses.bootStart));
        editor.putString(
                KEY_CAPABILITY_BATTERY_OPTIMIZATION,
                normalizedCapabilityStatus(capabilityStatuses.batteryOptimization)
        );
        editor.putString(KEY_CAPABILITY_UPDATE_CHECKS, normalizedCapabilityStatus(capabilityStatuses.updateChecks));
        editor.apply();
    }

    static void saveBinding(
            Context context,
            String receiverDeviceId,
            String bindingStatus,
            String deviceProfile,
            String hardwareProfile,
            String uiLayout
    ) {
        SharedPreferences.Editor editor =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        if (isPresent(receiverDeviceId)) {
            editor.putString(KEY_RECEIVER_DEVICE_ID, receiverDeviceId.trim());
        }
        editor.putString(KEY_BINDING_STATUS, firstNonBlank(bindingStatus, "bound"));
        if (isPresent(deviceProfile)) {
            editor.putString(KEY_DEVICE_PROFILE, deviceProfile.trim());
        }
        if (isPresent(hardwareProfile)) {
            editor.putString(KEY_HARDWARE_PROFILE, hardwareProfile.trim());
        }
        if (isPresent(uiLayout)) {
            editor.putString(KEY_UI_LAYOUT, uiLayout.trim());
        }
        editor.remove(KEY_SETUP_CLAIM);
        editor.remove(KEY_SETUP_CODE);
        editor.putLong(KEY_PROVISIONED_AT_MS, System.currentTimeMillis());
        editor.apply();
    }

    static void recordRecoveryLaunch(Context context, String action) {
        if (!isPresent(action)) {
            return;
        }

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LAST_RECOVERY_ACTION, action.trim())
                .putLong(KEY_LAST_RECOVERY_AT_MS, System.currentTimeMillis())
                .apply();
    }

    static String installId(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return installId(context, prefs);
    }

    private static String installId(Context context, SharedPreferences prefs) {
        String existingInstallId = prefs.getString(KEY_INSTALL_ID, "");
        if (isPresent(existingInstallId)) {
            return existingInstallId;
        }

        String generatedInstallId = UUID.randomUUID().toString();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_INSTALL_ID, generatedInstallId)
                .apply();
        return generatedInstallId;
    }

    private static boolean isAllowedReceiverUrl(String rawUrl) {
        if (!isPresent(rawUrl)) {
            return false;
        }

        Uri uri = Uri.parse(rawUrl.trim());
        String scheme = uri.getScheme();
        return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
    }

    private static boolean isPresent(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (isPresent(value)) {
                return value;
            }
        }
        return "";
    }

    private static String inferredBindingStatus(
            String setupCode,
            String setupClaim,
            String receiverDeviceId
    ) {
        if (isPresent(receiverDeviceId)) {
            return "bound";
        }
        if (isPresent(setupClaim)) {
            return "claim_pending";
        }
        if ("12345".equals(setupCode)) {
            return "local_test";
        }
        if (isPresent(setupCode)) {
            return "setup_pending";
        }
        return "unprovisioned";
    }

    private static String normalizedReceiverMode(String receiverMode) {
        return "personal".equals(receiverMode) ? "personal" : "dedicated";
    }

    private static String normalizedCapabilityStatus(String status) {
        if ("supported".equals(status)
                || "enabled".equals(status)
                || "unavailable".equals(status)
                || "unknown".equals(status)) {
            return status;
        }
        return "unknown";
    }

    static final class CapabilityStatuses {
        final String fullscreen;
        final String microphone;
        final String kiosk;
        final String keepAwake;
        final String bootStart;
        final String batteryOptimization;
        final String updateChecks;

        CapabilityStatuses(
                String fullscreen,
                String microphone,
                String kiosk,
                String keepAwake,
                String bootStart,
                String batteryOptimization,
                String updateChecks
        ) {
            this.fullscreen = fullscreen;
            this.microphone = microphone;
            this.kiosk = kiosk;
            this.keepAwake = keepAwake;
            this.bootStart = bootStart;
            this.batteryOptimization = batteryOptimization;
            this.updateChecks = updateChecks;
        }
    }

    static final class ReceiverConfig {
        final String receiverUrl;
        final String setupCode;
        final String deviceProfile;
        final String hardwareProfile;
        final String uiLayout;
        final String installId;
        final String receiverDeviceId;
        final String setupClaim;
        final String bindingStatus;
        final long provisionedAtMs;
        final String lastRecoveryAction;
        final long lastRecoveryAtMs;
        final String receiverMode;
        final long provisioningCompletedAtMs;
        final String capabilityFullscreen;
        final String capabilityMicrophone;
        final String capabilityKiosk;
        final String capabilityKeepAwake;
        final String capabilityBootStart;
        final String capabilityBatteryOptimization;
        final String capabilityUpdateChecks;

        ReceiverConfig(
                String receiverUrl,
                String setupCode,
                String deviceProfile,
                String hardwareProfile,
                String uiLayout,
                String installId,
                String receiverDeviceId,
                String setupClaim,
                String bindingStatus,
                long provisionedAtMs,
                String lastRecoveryAction,
                long lastRecoveryAtMs,
                String receiverMode,
                long provisioningCompletedAtMs,
                String capabilityFullscreen,
                String capabilityMicrophone,
                String capabilityKiosk,
                String capabilityKeepAwake,
                String capabilityBootStart,
                String capabilityBatteryOptimization,
                String capabilityUpdateChecks
        ) {
            this.receiverUrl = receiverUrl;
            this.setupCode = setupCode;
            this.deviceProfile = deviceProfile;
            this.hardwareProfile = hardwareProfile;
            this.uiLayout = uiLayout;
            this.installId = installId;
            this.receiverDeviceId = receiverDeviceId;
            this.setupClaim = setupClaim;
            this.bindingStatus = bindingStatus;
            this.provisionedAtMs = provisionedAtMs;
            this.lastRecoveryAction = lastRecoveryAction;
            this.lastRecoveryAtMs = lastRecoveryAtMs;
            this.receiverMode = receiverMode;
            this.provisioningCompletedAtMs = provisioningCompletedAtMs;
            this.capabilityFullscreen = capabilityFullscreen;
            this.capabilityMicrophone = capabilityMicrophone;
            this.capabilityKiosk = capabilityKiosk;
            this.capabilityKeepAwake = capabilityKeepAwake;
            this.capabilityBootStart = capabilityBootStart;
            this.capabilityBatteryOptimization = capabilityBatteryOptimization;
            this.capabilityUpdateChecks = capabilityUpdateChecks;
        }
    }
}
