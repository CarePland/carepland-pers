package com.carepland.connectreceiver;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.net.http.SslError;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 2601;

    private WebView webView;
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureApplianceWindow();
        configureWebView();
        requestAudioPermissionIfNeeded();
        loadReceiver();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) {
            loadReceiver();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureApplianceWindow();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        moveTaskToBack(true);
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != AUDIO_PERMISSION_REQUEST || pendingPermissionRequest == null) {
            return;
        }

        if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
            pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            pendingPermissionRequest.deny();
        }
        pendingPermissionRequest = null;
    }

    private void configureApplianceWindow() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(getColor(R.color.receiver_background));
        webView.setWebViewClient(new ReceiverWebViewClient());
        webView.setWebChromeClient(new ReceiverWebChromeClient());

        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(
                settings.getUserAgentString() + " CarePlandReceiverAndroid/0.1.0"
        );

        webView.addJavascriptInterface(new ReceiverBridge(), "CarePlandReceiver");

        setContentView(webView);
    }

    private void loadReceiver() {
        Uri receiverUri = receiverUriWithNativeDeviceInfo();
        setContentView(webView);
        webView.loadUrl(receiverUri.toString());
    }

    private Uri receiverUriWithNativeDeviceInfo() {
        Uri baseUri = ReceiverConfigStore.receiverUri(this);
        DisplayMetrics metrics = displayMetrics();
        Uri.Builder builder = baseUri.buildUpon();

        appendQueryParameterIfMissing(builder, baseUri, "nativeShell", "android");
        appendQueryParameterIfMissing(builder, baseUri, "shellVersion", "0.1.0");
        appendQueryParameterIfMissing(builder, baseUri, "detectedHardwareProfile", detectedHardwareProfile(metrics));
        appendQueryParameterIfMissing(builder, baseUri, "nativeManufacturer", Build.MANUFACTURER);
        appendQueryParameterIfMissing(builder, baseUri, "nativeModel", Build.MODEL);
        appendQueryParameterIfMissing(builder, baseUri, "nativeSdk", String.valueOf(Build.VERSION.SDK_INT));
        appendQueryParameterIfMissing(builder, baseUri, "displayWidthPx", String.valueOf(metrics.widthPixels));
        appendQueryParameterIfMissing(builder, baseUri, "displayHeightPx", String.valueOf(metrics.heightPixels));
        appendQueryParameterIfMissing(builder, baseUri, "displayDensityDpi", String.valueOf(metrics.densityDpi));
        appendQueryParameterIfMissing(
                builder,
                baseUri,
                "nativeOrientation",
                metrics.widthPixels >= metrics.heightPixels ? "landscape" : "portrait"
        );

        return builder.build();
    }

    private static void appendQueryParameterIfMissing(
            Uri.Builder builder,
            Uri baseUri,
            String key,
            String value
    ) {
        if (baseUri.getQueryParameter(key) != null || value == null || value.trim().isEmpty()) {
            return;
        }

        builder.appendQueryParameter(key, value.trim());
    }

    private void requestAudioPermissionIfNeeded() {
        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
        }
    }

    private boolean hasPermission(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private final class ReceiverWebChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            List<String> allowedResources = new ArrayList<>();

            for (String resource : request.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                        && hasPermission(Manifest.permission.RECORD_AUDIO)) {
                    allowedResources.add(resource);
                }
            }

            if (allowedResources.isEmpty()) {
                pendingPermissionRequest = request;
                requestAudioPermissionIfNeeded();
                return;
            }

            request.grant(allowedResources.toArray(new String[0]));
        }
    }

    private final class ReceiverWebViewClient extends WebViewClient {
        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            if (debuggableBuild() && localDevelopmentSslError(error)) {
                handler.proceed();
                return;
            }

            handler.cancel();
            showLocalError("CarePland Receiver could not verify this connection.");
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                CharSequence description = error == null ? "" : error.getDescription();
                showLocalError(description == null ? "" : description.toString());
            }
        }
    }

    private static boolean localDevelopmentSslError(SslError error) {
        if (error == null || error.getUrl() == null) {
            return false;
        }

        Uri uri = Uri.parse(error.getUrl());
        String host = uri.getHost();
        return "10.0.2.2".equals(host)
                || "127.0.0.1".equals(host)
                || "localhost".equalsIgnoreCase(host);
    }

    private boolean debuggableBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void showLocalError(String description) {
        TextView message = new TextView(this);
        message.setTextColor(0xFFDDEAF8);
        message.setTextSize(22);
        message.setGravity(Gravity.CENTER);
        message.setPadding(32, 32, 32, 32);
        message.setText("CarePland Receiver is waiting for a connection.\n\n" + description);

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(getColor(R.color.receiver_background));
        container.addView(
                message,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(container);
    }

    private final class ReceiverBridge {
        @JavascriptInterface
        public String getProvisioningJson() {
            ReceiverConfigStore.ReceiverConfig config = ReceiverConfigStore.load(MainActivity.this);
            DisplayMetrics metrics = displayMetrics();
            String detectedHardwareProfile = detectedHardwareProfile(metrics);
            int displayWidthDp = Math.round(metrics.widthPixels / metrics.density);
            int displayHeightDp = Math.round(metrics.heightPixels / metrics.density);
            return "{"
                    + "\"receiverUrl\":\"" + escapeJson(config.receiverUrl) + "\","
                    + "\"setupCode\":\"" + escapeJson(config.setupCode) + "\","
                    + "\"deviceProfile\":\"" + escapeJson(config.deviceProfile) + "\","
                    + "\"hardwareProfile\":\"" + escapeJson(config.hardwareProfile) + "\","
                    + "\"detectedHardwareProfile\":\"" + escapeJson(detectedHardwareProfile) + "\","
                    + "\"manufacturer\":\"" + escapeJson(Build.MANUFACTURER) + "\","
                    + "\"brand\":\"" + escapeJson(Build.BRAND) + "\","
                    + "\"model\":\"" + escapeJson(Build.MODEL) + "\","
                    + "\"device\":\"" + escapeJson(Build.DEVICE) + "\","
                    + "\"product\":\"" + escapeJson(Build.PRODUCT) + "\","
                    + "\"hardware\":\"" + escapeJson(Build.HARDWARE) + "\","
                    + "\"sdkVersion\":" + Build.VERSION.SDK_INT + ","
                    + "\"displayWidthPx\":" + metrics.widthPixels + ","
                    + "\"displayHeightPx\":" + metrics.heightPixels + ","
                    + "\"displayWidthDp\":" + displayWidthDp + ","
                    + "\"displayHeightDp\":" + displayHeightDp + ","
                    + "\"displayDensity\":" + metrics.density + ","
                    + "\"displayDensityDpi\":" + metrics.densityDpi + ","
                    + "\"shellVersion\":\"0.1.0\""
                    + "}";
        }

        @JavascriptInterface
        public void reloadReceiver() {
            runOnUiThread(() -> {
                if (webView != null) {
                    loadReceiver();
                }
            });
        }
    }

    private DisplayMetrics displayMetrics() {
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
        return metrics;
    }

    private String detectedHardwareProfile(DisplayMetrics metrics) {
        String model = Build.MODEL == null ? "" : Build.MODEL.toLowerCase();
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();

        if (model.contains("gxv3370") || (manufacturer.contains("grandstream") && model.contains("3370"))) {
            return "grandstream_gxv3370";
        }

        int widthDp = Math.round(metrics.widthPixels / metrics.density);
        int heightDp = Math.round(metrics.heightPixels / metrics.density);
        int shortSide = Math.min(widthDp, heightDp);
        int longSide = Math.max(widthDp, heightDp);
        if (shortSide >= 560 && shortSide <= 700 && longSide >= 960 && longSide <= 1120) {
            return "studio_gxv3370_1024x600";
        }

        return metrics.widthPixels > metrics.heightPixels
                ? "generic_landscape_android"
                : "generic_android_phone";
    }

    private static String escapeJson(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
