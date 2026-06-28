package com.carepland.connectreceiver;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

final class ReceiverConfigStore {
    private static final String PREFS_NAME = "carepland_receiver";
    private static final String KEY_RECEIVER_URL = "receiver_url";
    private static final String KEY_SETUP_CODE = "setup_code";
    private static final String KEY_DEVICE_PROFILE = "device_profile";
    private static final String KEY_HARDWARE_PROFILE = "hardware_profile";

    private ReceiverConfigStore() {}

    static ReceiverConfig load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String defaultUrl = context.getString(R.string.default_receiver_url);
        String receiverUrl = prefs.getString(KEY_RECEIVER_URL, defaultUrl);
        String setupCode = prefs.getString(KEY_SETUP_CODE, "");
        String deviceProfile = prefs.getString(KEY_DEVICE_PROFILE, "");
        String hardwareProfile = prefs.getString(KEY_HARDWARE_PROFILE, "");

        return new ReceiverConfig(receiverUrl, setupCode, deviceProfile, hardwareProfile);
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
                uri.getQueryParameter("claim"),
                uri.getQueryParameter("app_claim"),
                uri.getQueryParameter("appClaim"),
                uri.getQueryParameter("code"),
                uri.getQueryParameter("setup_code"),
                uri.getQueryParameter("setupCode"),
                uri.getQueryParameter("token")
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

        if (isAllowedReceiverUrl(receiverUrl)) {
            editor.putString(KEY_RECEIVER_URL, receiverUrl.trim());
        }
        if (isPresent(setupCode)) {
            editor.putString(KEY_SETUP_CODE, setupCode.trim());
        }
        if (isPresent(deviceProfile)) {
            editor.putString(KEY_DEVICE_PROFILE, deviceProfile.trim());
        }
        if (isPresent(hardwareProfile)) {
            editor.putString(KEY_HARDWARE_PROFILE, hardwareProfile.trim());
        }
        editor.apply();
    }

    static Uri receiverUri(Context context) {
        ReceiverConfig config = load(context);
        Uri baseUri = Uri.parse(config.receiverUrl);
        Uri.Builder builder = baseUri.buildUpon();

        if (isPresent(config.setupCode) && baseUri.getQueryParameter("setupCode") == null) {
            builder.appendQueryParameter("setupCode", config.setupCode);
        }
        if (isPresent(config.deviceProfile) && baseUri.getQueryParameter("device") == null) {
            builder.appendQueryParameter("device", config.deviceProfile);
        }
        if (isPresent(config.hardwareProfile) && baseUri.getQueryParameter("hardwareProfile") == null) {
            builder.appendQueryParameter("hardwareProfile", config.hardwareProfile);
        }
        if (baseUri.getQueryParameter("nativeShell") == null) {
            builder.appendQueryParameter("nativeShell", "android");
        }

        return builder.build();
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

    static final class ReceiverConfig {
        final String receiverUrl;
        final String setupCode;
        final String deviceProfile;
        final String hardwareProfile;

        ReceiverConfig(String receiverUrl, String setupCode, String deviceProfile, String hardwareProfile) {
            this.receiverUrl = receiverUrl;
            this.setupCode = setupCode;
            this.deviceProfile = deviceProfile;
            this.hardwareProfile = hardwareProfile;
        }
    }
}
