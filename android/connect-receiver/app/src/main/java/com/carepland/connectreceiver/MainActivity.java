package com.carepland.connectreceiver;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.os.Looper;
import android.net.http.SslError;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 2601;
    private static final int RECEIVER_LOAD_TIMEOUT_MS = 8000;
    private static final int RECEIVER_AUTO_RETRY_SECONDS = 5;
    private static final int DEDICATED_REOPEN_DELAY_MS = 1500;
    private static final int PAIRING_POLL_INTERVAL_MS = 3000;
    private static final String SHELL_VERSION = "0.1.13";

    private WebView webView;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean receiverPageReady;
    private boolean receiverErrorVisible;
    private int receiverAutoRetrySecondsRemaining;
    private Runnable receiverLoadTimeoutRunnable;
    private Runnable receiverAutoRetryRunnable;
    private Runnable dedicatedReopenRunnable;
    private Runnable pairingPollRunnable;
    private String lastReceiverUrl = "";
    private String lastPageFinishedUrl = "";
    private String lastConsoleMessage = "";
    private String currentPairingCode = "";
    private String currentPairingReceiverDeviceId = "";
    private String currentPairingStatus = "";
    private boolean pairingRequestInFlight;
    private PermissionRequest pendingPermissionRequest;
    private boolean provisioningWizardVisible;
    private String provisioningWizardMode = "dedicated";
    private String provisioningWizardScreen = "";
    private String provisioningReadyModeLabel = "";
    private boolean externalSettingsInProgress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureApplianceWindow();
        configureManagedKioskMode();
        configureWebView();
        if (!ReceiverConfigStore.hasClaimOrBinding(this)) {
            showPairingRequiredScreen("Requesting pairing code...");
            return;
        }
        if (!ReceiverConfigStore.hasCompletedProvisioningWizard(this)) {
            showProvisioningModeSelection();
            return;
        }
        startReceiverAfterSetup();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (!ReceiverConfigStore.hasClaimOrBinding(this)) {
            showPairingRequiredScreen("Requesting pairing code...");
            return;
        }
        if (!ReceiverConfigStore.hasCompletedProvisioningWizard(this)) {
            showProvisioningModeSelection();
            return;
        }
        startReceiverAfterSetup();
    }

    @Override
    protected void onResume() {
        super.onResume();
        cancelDedicatedReopen();
        externalSettingsInProgress = false;
        configureApplianceWindow();
        configureManagedKioskMode();
        if (!ReceiverConfigStore.hasClaimOrBinding(this)) {
            showPairingRequiredScreen(currentPairingStatus);
            return;
        }
        if (receiverErrorVisible && ReceiverConfigStore.hasProvisioning(this)) {
            scheduleReceiverAutoRetry(null);
        }
        if (provisioningWizardVisible && "dedicated_checklist".equals(provisioningWizardScreen)) {
            showDedicatedProvisioningChecklist();
            return;
        }
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        configureApplianceWindow();

        if (!provisioningWizardVisible) {
            return;
        }

        if ("mode_selection".equals(provisioningWizardScreen)) {
            showProvisioningModeSelection();
            return;
        }
        if ("dedicated_checklist".equals(provisioningWizardScreen)) {
            showDedicatedProvisioningChecklist();
            return;
        }
        if ("personal_summary".equals(provisioningWizardScreen)) {
            showPersonalDeviceSummary();
            return;
        }
        if ("ready".equals(provisioningWizardScreen)) {
            showProvisioningReadyScreen(provisioningReadyModeLabel);
            return;
        }
        if (pairingPollRunnable != null || !isBlank(currentPairingCode)) {
            showPairingRequiredScreen(currentPairingStatus);
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        scheduleDedicatedReopenIfNeeded();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        cancelDedicatedReopen();
        cancelPairingPoll();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void scheduleDedicatedReopenIfNeeded() {
        if (!ReceiverConfigStore.isDedicatedReceiverMode(this)
                || externalSettingsInProgress
                || isFinishing()) {
            return;
        }

        cancelDedicatedReopen();
        dedicatedReopenRunnable = () -> {
            if (!ReceiverConfigStore.isDedicatedReceiverMode(MainActivity.this)
                    || externalSettingsInProgress
                    || isFinishing()) {
                return;
            }

            ReceiverConfigStore.recordRecoveryLaunch(MainActivity.this, "dedicated_soft_reopen");
            Intent intent = new Intent(MainActivity.this, MainActivity.class);
            intent.addFlags(
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            );
            startActivity(intent);
        };
        mainHandler.postDelayed(dedicatedReopenRunnable, DEDICATED_REOPEN_DELAY_MS);
    }

    private void cancelDedicatedReopen() {
        if (dedicatedReopenRunnable != null) {
            mainHandler.removeCallbacks(dedicatedReopenRunnable);
            dedicatedReopenRunnable = null;
        }
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

        if (requestCode != AUDIO_PERMISSION_REQUEST) {
            return;
        }

        if (pendingPermissionRequest != null) {
            if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
                pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }

        if (provisioningWizardVisible && "dedicated".equals(provisioningWizardMode)) {
            showDedicatedProvisioningChecklist();
        }
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

    private void configureManagedKioskMode() {
        if (!ReceiverConfigStore.isDedicatedReceiverMode(this)) {
            return;
        }

        DevicePolicyManager devicePolicyManager =
                (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, ReceiverDeviceAdminReceiver.class);
        if (devicePolicyManager != null && devicePolicyManager.isDeviceOwnerApp(getPackageName())) {
            try {
                devicePolicyManager.setLockTaskPackages(admin, new String[]{getPackageName()});
                devicePolicyManager.setKeyguardDisabled(admin, true);
                devicePolicyManager.setStatusBarDisabled(admin, true);
            } catch (SecurityException | IllegalArgumentException ignored) {
                // Managed-device policies are best-effort until device-owner provisioning is stable.
            }
        }

        maybeStartLockTaskMode(devicePolicyManager);
    }

    private void maybeStartLockTaskMode(DevicePolicyManager devicePolicyManager) {
        ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager != null
                && activityManager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE) {
            return;
        }

        if (devicePolicyManager == null || !devicePolicyManager.isLockTaskPermitted(getPackageName())) {
            return;
        }

        try {
            startLockTask();
        } catch (IllegalArgumentException | IllegalStateException ignored) {
            // Lock task is only available after managed-device provisioning allows it.
        }
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
                settings.getUserAgentString() + " CarePlandReceiverAndroid/" + SHELL_VERSION
        );

        webView.addJavascriptInterface(new ReceiverBridge(), "CarePlandReceiver");

        setContentView(webView);
    }

    private void loadReceiver() {
        Uri receiverUri = receiverUriWithNativeDeviceInfo();
        cancelReceiverRecoveryCallbacks();
        resetWebViewForReceiverLoad();
        receiverErrorVisible = false;
        receiverPageReady = false;
        lastReceiverUrl = receiverUri.toString();
        lastPageFinishedUrl = "";
        lastConsoleMessage = "";
        showReceiverLoading(receiverUri);
        mainHandler.postDelayed(() -> {
            if (webView != null) {
                setContentView(webView);
                webView.loadUrl(receiverUri.toString());
            }
        }, 300);
        receiverLoadTimeoutRunnable = () -> {
            if (!receiverPageReady && webView != null) {
                ReceiverConfigStore.recordRecoveryLaunch(this, "receiver_load_timeout");
                showLocalError(
                        "Receiver page did not finish starting."
                                + "\n\nURL: " + receiverUri
                                + "\nPage loaded: " + emptyFallback(lastPageFinishedUrl, "not reported")
                                + "\nLast message: " + emptyFallback(lastConsoleMessage, "none")
                );
            }
        };
        mainHandler.postDelayed(receiverLoadTimeoutRunnable, RECEIVER_LOAD_TIMEOUT_MS);
    }

    private void resetWebViewForReceiverLoad() {
        recreateWebView();
    }

    private void recreateWebView() {
        if (webView != null) {
            try {
                webView.stopLoading();
                webView.setWebChromeClient(null);
                webView.setWebViewClient(null);
                webView.destroy();
            } catch (IllegalStateException ignored) {
                // The replacement WebView below is the recovery path.
            }
            webView = null;
        }

        configureWebView();
    }

    private void cancelReceiverRecoveryCallbacks() {
        if (receiverLoadTimeoutRunnable != null) {
            mainHandler.removeCallbacks(receiverLoadTimeoutRunnable);
            receiverLoadTimeoutRunnable = null;
        }
        if (receiverAutoRetryRunnable != null) {
            mainHandler.removeCallbacks(receiverAutoRetryRunnable);
            receiverAutoRetryRunnable = null;
        }
        receiverAutoRetrySecondsRemaining = 0;
    }

    private void showReceiverLoading(Uri receiverUri) {
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(getColor(R.color.receiver_background));

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(40, 32, 40, 32);

        TextView title = wizardText("Opening Receiver...", 30, 0xFFFFFFFF);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, wizardTextParams());

        TextView url = wizardText(receiverUri.toString(), 13, 0xFFAEB9B3);
        url.setGravity(Gravity.CENTER);
        panel.addView(url, wizardTextParams());

        container.addView(
                panel,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(container);
    }

    private Uri receiverUriWithNativeDeviceInfo() {
        Uri baseUri = ReceiverConfigStore.receiverUri(this);
        ReceiverConfigStore.ReceiverConfig config = ReceiverConfigStore.load(this);
        DisplayMetrics metrics = displayMetrics();
        Uri loadBaseUri = shouldUseLegacyReceiverRoute(metrics)
                ? legacyReceiverUri(baseUri)
                : baseUri;
        Uri.Builder builder = loadBaseUri.buildUpon();

        appendQueryParameterIfMissing(builder, baseUri, "nativeShell", "android");
        appendQueryParameterIfMissing(builder, baseUri, "shellVersion", SHELL_VERSION);
        appendQueryParameterIfMissing(builder, baseUri, "nativeVersionName", versionName());
        appendQueryParameterIfMissing(builder, baseUri, "nativeVersionCode", String.valueOf(versionCode()));
        appendQueryParameterIfMissing(builder, baseUri, "receiverInstallId", ReceiverConfigStore.installId(this));
        appendQueryParameterIfMissing(builder, baseUri, "receiverMode", config.receiverMode);
        appendQueryParameterIfMissing(
                builder,
                baseUri,
                "provisioningCompletedAtMs",
                String.valueOf(config.provisioningCompletedAtMs)
        );
        appendQueryParameterIfMissing(builder, baseUri, "lastRecoveryAction", config.lastRecoveryAction);
        appendQueryParameterIfMissing(builder, baseUri, "lastRecoveryAtMs", String.valueOf(config.lastRecoveryAtMs));
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

    private boolean shouldUseLegacyReceiverRoute(DisplayMetrics metrics) {
        String detectedProfile = detectedHardwareProfile(metrics);
        return Build.VERSION.SDK_INT <= Build.VERSION_CODES.N_MR1
                || detectedProfile.contains("gxv3370");
    }

    private Uri legacyReceiverUri(Uri baseUri) {
        String path = baseUri.getPath();
        String legacyPath;
        if (path == null || path.trim().isEmpty() || "/".equals(path)) {
            legacyPath = "/connect/receiver/legacy";
        } else if (path.endsWith("/legacy")) {
            legacyPath = path;
        } else if (path.endsWith("/receiver")) {
            legacyPath = path + "/legacy";
        } else {
            legacyPath = "/connect/receiver/legacy";
        }
        return baseUri.buildUpon().path(legacyPath).build();
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

    private void showProvisioningModeSelection() {
        provisioningWizardVisible = true;
        provisioningWizardMode = "dedicated";
        provisioningWizardScreen = "mode_selection";
        configureApplianceWindow();

        LinearLayout panel = wizardPanel();
        addWizardTitle(
                panel,
                "How will CarePland Receiver be used?",
                ""
        );

        LinearLayout choices = new LinearLayout(this);
        choices.setOrientation(useSideBySideWizardChoices() ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        choices.setGravity(Gravity.CENTER);

        View dedicatedButton = wizardChoiceCard(
                "Recommended",
                "Dedicated CarePland Device",
                "This device is used primarily for CarePland Receiver.",
                "Benefits",
                "Starts directly into CarePland\nCan reopen automatically after restart\nReduces accidental exits\nMost reliable reminders and communications\nManaged updates when available"
        );
        dedicatedButton.setOnClickListener(view -> {
            provisioningWizardMode = "dedicated";
            showDedicatedProvisioningChecklist();
        });
        choices.addView(dedicatedButton, wizardChoiceCardParams(true));

        View personalButton = wizardChoiceCard(
                null,
                "Install as a regular app",
                "Use CarePland alongside your other apps\n\nIdeal for a personal phone or tablet.",
                "What to expect",
                "Receiver can be closed like any other app\nCalls and reminders may be interrupted by other apps\nAndroid settings may affect notifications or battery behavior\nUpdate experience depends on your device"
        );
        personalButton.setOnClickListener(view -> {
            provisioningWizardMode = "personal";
            showPersonalDeviceSummary();
        });
        choices.addView(personalButton, wizardChoiceCardParams(false));
        panel.addView(choices, wizardChoicesParams());

        showWizardPanel(panel);
    }

    private void showDedicatedProvisioningChecklist() {
        provisioningWizardVisible = true;
        provisioningWizardMode = "dedicated";
        provisioningWizardScreen = "dedicated_checklist";
        configureApplianceWindow();

        LinearLayout panel = wizardPanel();
        addWizardTitleWithBack(
                panel,
                "Dedicated CarePland Receiver",
                "CarePland will check what this device supports. Not every Android device supports every Receiver feature."
        );

        ReceiverConfigStore.CapabilityStatuses statuses = currentCapabilityStatuses();
        addCapabilityPair(panel, "Full screen", "On", "Keep screen awake", "On");
        addCapabilityRow(
                panel,
                "Microphone",
                hasPermission(Manifest.permission.RECORD_AUDIO) ? "On" : "Needs permission",
                statuses.microphone,
                hasPermission(Manifest.permission.RECORD_AUDIO) ? null : "Setup"
        );
        addCapabilityRow(panel, "Kiosk mode", kioskWizardLabel(), statuses.kiosk, kioskWizardActionLabel());
        addCapabilityRow(panel, "Battery optimization", batteryOptimizationLabel(), statuses.batteryOptimization, "Setup");
        addCapabilityRow(panel, "Auto-start", bootStartWizardLabel(), statuses.bootStart, null);
        addCapabilityRow(panel, "Update checks", "Available", statuses.updateChecks, null);

        Button continueButton = primaryWizardButton("Continue");
        continueButton.setOnClickListener(view -> {
            ReceiverConfigStore.saveProvisioningProfile(
                    this,
                    "dedicated",
                    currentCapabilityStatuses()
            );
            showProvisioningReadyScreen("Dedicated Receiver Mode");
        });
        panel.addView(continueButton, wizardPrimaryParams());

        showWizardPanel(panel);
    }

    private void showPersonalDeviceSummary() {
        provisioningWizardVisible = true;
        provisioningWizardMode = "personal";
        provisioningWizardScreen = "personal_summary";
        configureApplianceWindow();

        LinearLayout panel = wizardPanel();
        addWizardTitleWithBack(
                panel,
                "Personal Device - CarePland is a normal app",
                "Things to know"
        );

        TextView summary = wizardText(
                "The person using this device can close CarePland.\n\n"
                        + "CarePland does not start automatically after the device restarts.\n\n"
                        + "Calls, reminders and messages may be interrupted.\n\n"
                        + "Reliability can be affected by other apps or settings\n\n"
                        + "The person using this device may need to help troubleshoot if something goes wrong.",
                21,
                0xFFDDEAF8
        );
        summary.setGravity(Gravity.CENTER);
        panel.addView(summary, wizardTextParams());

        Button continueButton = primaryWizardButton("Continue");
        continueButton.setOnClickListener(view -> {
            ReceiverConfigStore.saveProvisioningProfile(
                    this,
                    "personal",
                    currentCapabilityStatuses()
            );
            showProvisioningReadyScreen("Personal Android Device Mode");
        });
        panel.addView(continueButton, wizardPrimaryParams());

        showWizardPanel(panel);
    }

    private void showProvisioningReadyScreen(String modeLabel) {
        provisioningWizardVisible = true;
        provisioningWizardScreen = "ready";
        provisioningReadyModeLabel = modeLabel;
        configureApplianceWindow();

        LinearLayout panel = wizardPanel();
        addWizardTitle(
                panel,
                "Your CarePland Receiver is ready.",
                "This device has been configured for " + modeLabel + "."
        );

        TextView note = wizardText("You can change these settings later if needed.", 20, 0xFFDDEAF8);
        note.setGravity(Gravity.CENTER);
        panel.addView(note, wizardTextParams());

        Button startButton = primaryWizardButton("Start Using CarePland");
        startButton.setOnClickListener(view -> {
            provisioningWizardVisible = false;
            provisioningWizardScreen = "";
            if (!ReceiverConfigStore.hasClaimOrBinding(this)) {
                showPairingRequiredScreen("Pair this Receiver before starting CarePland.");
                return;
            }
            startReceiverAfterSetup();
        });
        panel.addView(startButton, wizardPrimaryParams());

        showWizardPanel(panel);
    }

    private void showWizardPanel(LinearLayout panel) {
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(getColor(R.color.receiver_background));
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.addView(
                panel,
                new ScrollView.LayoutParams(
                        ScrollView.LayoutParams.MATCH_PARENT,
                        ScrollView.LayoutParams.WRAP_CONTENT
                )
        );
        container.addView(
                scrollView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(container);
    }

    private LinearLayout wizardPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        int horizontalPadding = narrowWizardScreen() ? 28 : shortWizardScreen() ? 28 : 42;
        int verticalPadding = narrowWizardScreen() ? 22 : shortWizardScreen() ? 18 : 28;
        panel.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
        return panel;
    }

    private void addWizardTitle(LinearLayout panel, String titleText, String subtitleText) {
        TextView title = wizardText(titleText, shortWizardScreen() ? 29 : 34, 0xFFFFFFFF);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, wizardTextParams());

        if (subtitleText != null && !subtitleText.trim().isEmpty()) {
            TextView subtitle = wizardText(subtitleText, 19, 0xFFDDEAF8);
            subtitle.setGravity(Gravity.CENTER);
            panel.addView(subtitle, wizardTextParams());
        }
    }

    private void addWizardTitleWithBack(LinearLayout panel, String titleText, String subtitleText) {
        LinearLayout backRow = new LinearLayout(this);
        backRow.setGravity(Gravity.RIGHT);
        Button backButton = secondaryWizardButton("Back");
        backButton.setOnClickListener(view -> showProvisioningModeSelection());
        backRow.addView(
                backButton,
                new LinearLayout.LayoutParams(
                        backButtonWidth(),
                        Math.round((narrowWizardScreen() ? 48 : shortWizardScreen() ? 52 : 62)
                                * getResources().getDisplayMetrics().density)
                )
        );
        panel.addView(backRow, compactWizardTextParams());

        TextView title = wizardText(titleText, narrowWizardScreen() ? 28 : shortWizardScreen() ? 26 : 32, 0xFFFFFFFF);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, wizardTextParams());

        if (subtitleText != null && !subtitleText.trim().isEmpty()) {
            TextView subtitle = wizardText(subtitleText, narrowWizardScreen() ? 19 : shortWizardScreen() ? 18 : 19, 0xFFDDEAF8);
            subtitle.setGravity(Gravity.CENTER);
            panel.addView(subtitle, wizardTextParams());
        }
    }

    private View wizardChoiceCard(
            String topBadge,
            String title,
            String summary,
            String sectionLabel,
            String details
    ) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        int horizontalPadding = shortWizardScreen() ? 20 : 28;
        int verticalPadding = shortWizardScreen() ? 18 : 22;
        card.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
        card.setBackgroundColor(0xFFFFFFFF);
        card.setClickable(true);
        card.setFocusable(true);

        if (topBadge != null && !topBadge.trim().isEmpty()) {
            TextView badgeView = wizardText(topBadge, shortWizardScreen() ? 18 : 20, 0xFF425047);
            badgeView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            badgeView.setGravity(Gravity.CENTER);
            card.addView(badgeView, compactWizardTextParams());
        }

        TextView titleView = wizardText(title, shortWizardScreen() ? 22 : 25, 0xFF101915);
        titleView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        card.addView(titleView, compactWizardTextParams());

        TextView summaryView = wizardText(summary, shortWizardScreen() ? 18 : 20, 0xFF101915);
        summaryView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        summaryView.setGravity(Gravity.CENTER);
        card.addView(summaryView, compactWizardTextParams());

        if (sectionLabel != null && !sectionLabel.trim().isEmpty()) {
            TextView sectionView = wizardText(sectionLabel, shortWizardScreen() ? 18 : 20, 0xFF101915);
            sectionView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            sectionView.setGravity(Gravity.CENTER);
            card.addView(sectionView, compactWizardTextParams());
        }

        TextView detailView = wizardText(details, shortWizardScreen() ? 16 : 18, 0xFF101915);
        detailView.setGravity(Gravity.CENTER);
        card.addView(
                detailView,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );
        return card;
    }

    private boolean useSideBySideWizardChoices() {
        return getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
    }

    private boolean shortWizardScreen() {
        DisplayMetrics displayMetrics = getResources().getDisplayMetrics();
        float density = displayMetrics.density == 0 ? 1f : displayMetrics.density;
        return displayMetrics.heightPixels / density < 720;
    }

    private boolean narrowWizardScreen() {
        DisplayMetrics displayMetrics = getResources().getDisplayMetrics();
        float density = displayMetrics.density == 0 ? 1f : displayMetrics.density;
        return displayMetrics.widthPixels / density < 560;
    }

    private void addCapabilityPair(
            LinearLayout panel,
            String firstLabel,
            String firstStatus,
            String secondLabel,
            String secondStatus
    ) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        row.addView(
                compactCapabilityTile(firstLabel, firstStatus),
                compactCapabilityTileParams(true)
        );
        row.addView(
                compactCapabilityTile(secondLabel, secondStatus),
                compactCapabilityTileParams(false)
        );

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, 10);
        panel.addView(row, params);
    }

    private View compactCapabilityTile(String label, String status) {
        LinearLayout tile = new LinearLayout(this);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(18, 14, 18, 14);
        tile.setBackgroundColor(0xFF0F1F1C);

        TextView labelView = wizardText(label, narrowWizardScreen() ? 19 : 20, 0xFFFFFFFF);
        labelView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        labelView.setGravity(Gravity.CENTER);
        tile.addView(labelView, compactWizardTextParams());

        TextView statusView = wizardText(status, narrowWizardScreen() ? 18 : 19, 0xFFFFFFFF);
        statusView.setGravity(Gravity.CENTER);
        tile.addView(
                statusView,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        return tile;
    }

    private LinearLayout.LayoutParams compactCapabilityTileParams(boolean firstTile) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
        );
        params.setMargins(firstTile ? 0 : 5, 0, firstTile ? 5 : 0, 0);
        return params;
    }

    private void addCapabilityRow(
            LinearLayout panel,
            String label,
            String displayStatus,
            String storedStatus,
            String actionLabel
    ) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(20, narrowWizardScreen() ? 16 : 14, 20, narrowWizardScreen() ? 16 : 14);
        row.setBackgroundColor(0xFF0F1F1C);

        LinearLayout textStack = new LinearLayout(this);
        textStack.setOrientation(LinearLayout.VERTICAL);
        textStack.setGravity(Gravity.CENTER_VERTICAL);

        TextView labelView = wizardText(label, narrowWizardScreen() ? 21 : 20, 0xFFFFFFFF);
        labelView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        textStack.addView(labelView, compactWizardTextParams());

        TextView statusView = wizardText(displayStatus, narrowWizardScreen() ? 17 : 18, 0xFFDDEAF8);
        statusView.setGravity(Gravity.LEFT);
        textStack.addView(
                statusView,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        row.addView(
                textStack,
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        );

        if (actionLabel != null) {
            Button action = new Button(this);
            action.setAllCaps(false);
            action.setText(actionLabel);
            action.setTextSize(narrowWizardScreen() ? 18 : 16);
            action.setTextColor(0xFFFFFFFF);
            action.setBackgroundColor(0xFF2F668E);
            action.setOnClickListener(view -> handleCapabilityConfigure(label));
            LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(
                    Math.round((narrowWizardScreen() ? 132 : 150) * getResources().getDisplayMetrics().density),
                    Math.round((narrowWizardScreen() ? 54 : 58) * getResources().getDisplayMetrics().density)
            );
            actionParams.setMargins(14, 0, 0, 0);
            row.addView(action, actionParams);
        }

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, 10);
        panel.addView(row, params);
    }

    private void handleCapabilityConfigure(String label) {
        if ("Microphone".equals(label)) {
            requestAudioPermissionIfNeeded();
            return;
        }
        if ("Battery optimization".equals(label)) {
            openBatteryOptimizationSettings();
            return;
        }
        if ("Kiosk mode".equals(label)) {
            openDeviceAdminSetup();
        }
    }

    private void openBatteryOptimizationSettings() {
        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        try {
            externalSettingsInProgress = true;
            startActivity(intent);
        } catch (Exception ignored) {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + getPackageName()));
            try {
                externalSettingsInProgress = true;
                startActivity(fallback);
            } catch (Exception ignoredAgain) {
                externalSettingsInProgress = false;
                showDedicatedProvisioningChecklist();
            }
        }
    }

    private ReceiverConfigStore.CapabilityStatuses currentCapabilityStatuses() {
        return new ReceiverConfigStore.CapabilityStatuses(
                "enabled",
                hasPermission(Manifest.permission.RECORD_AUDIO) ? "enabled" : "supported",
                kioskCapabilityStatus(),
                "enabled",
                dedicatedModeSelectedOrSaved() ? "enabled" : "unknown",
                batteryOptimizationStatus(),
                "supported"
        );
    }

    private boolean dedicatedModeSelectedOrSaved() {
        return "dedicated".equals(provisioningWizardMode)
                || ReceiverConfigStore.isDedicatedReceiverMode(this);
    }

    private String bootStartWizardLabel() {
        return dedicatedModeSelectedOrSaved() ? "On" : "Unknown";
    }

    private String kioskCapabilityStatus() {
        if (isLockTaskActive()) {
            return "enabled";
        }
        if (isLockTaskPermitted() || isDeviceOwner()) {
            return "supported";
        }
        if (isDeviceAdminActive()) {
            return "unknown";
        }
        return "unavailable";
    }

    private String batteryOptimizationStatus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return "unknown";
        }
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) {
            return "unknown";
        }
        return powerManager.isIgnoringBatteryOptimizations(getPackageName())
                ? "enabled"
                : "supported";
    }

    private String batteryOptimizationLabel() {
        String status = batteryOptimizationStatus();
        return "enabled".equals(status) ? "On" : "Needs attention";
    }

    private String kioskWizardLabel() {
        if (isLockTaskActive()) {
            return "On";
        }
        if (isLockTaskPermitted()) {
            return "Available";
        }
        if (isDeviceOwner()) {
            return "Owner setup ready";
        }
        if (isDeviceAdminActive()) {
            return "Owner setup needed";
        }
        return "Needs setup";
    }

    private String kioskWizardActionLabel() {
        if (isLockTaskActive() || isLockTaskPermitted() || isDeviceOwner()) {
            return null;
        }
        return "Setup";
    }

    private void openDeviceAdminSetup() {
        ComponentName admin = new ComponentName(this, ReceiverDeviceAdminReceiver.class);
        Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);
        intent.putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "CarePland uses this on dedicated receivers to reduce accidental exits and keep the Receiver available."
        );
        try {
            externalSettingsInProgress = true;
            startActivity(intent);
        } catch (Exception ignored) {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + getPackageName()));
            try {
                externalSettingsInProgress = true;
                startActivity(fallback);
            } catch (Exception ignoredAgain) {
                externalSettingsInProgress = false;
                showDedicatedProvisioningChecklist();
            }
        }
    }

    private String statusLabelForCapability(String status) {
        if ("enabled".equals(status)) return "On";
        if ("supported".equals(status)) return "Available";
        if ("unavailable".equals(status)) return "Not available";
        return "Unknown";
    }

    private TextView wizardText(String text, int textSize, int color) {
        TextView textView = new TextView(this);
        textView.setText(text);
        textView.setTextSize(textSize);
        textView.setTextColor(color);
        return textView;
    }

    private Button primaryWizardButton(String text) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(text);
        button.setTextSize(22);
        button.setTextColor(0xFFFFFFFF);
        button.setBackgroundColor(0xFF226D1D);
        return button;
    }

    private Button secondaryWizardButton(String text) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(text);
        button.setTextSize(narrowWizardScreen() ? 18 : shortWizardScreen() ? 18 : 20);
        button.setTextColor(0xFF101915);
        button.setBackgroundColor(0xFFFFFFFF);
        return button;
    }

    private int backButtonWidth() {
        return Math.round((narrowWizardScreen() ? 128 : shortWizardScreen() ? 118 : 150)
                * getResources().getDisplayMetrics().density);
    }

    private LinearLayout.LayoutParams wizardTextParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, shortWizardScreen() ? 14 : 24);
        return params;
    }

    private LinearLayout.LayoutParams compactWizardTextParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, shortWizardScreen() ? 7 : 10);
        return params;
    }

    private LinearLayout.LayoutParams wizardChoicesParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        return params;
    }

    private LinearLayout.LayoutParams wizardChoiceCardParams(boolean firstCard) {
        boolean sideBySide = useSideBySideWizardChoices();
        LinearLayout.LayoutParams params = sideBySide
                ? new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                : new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (sideBySide) {
            params.setMargins(firstCard ? 0 : 8, 0, firstCard ? 8 : 0, 0);
        } else {
            params.setMargins(0, 0, 0, 14);
        }
        return params;
    }

    private LinearLayout.LayoutParams wizardPrimaryParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(76 * getResources().getDisplayMetrics().density)
        );
        params.setMargins(0, 16, 0, 0);
        return params;
    }

    private final class ReceiverWebChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            if (consoleMessage != null) {
                lastConsoleMessage =
                        consoleMessage.messageLevel()
                                + ": " + consoleMessage.message()
                                + " (" + consoleMessage.sourceId()
                                + ":" + consoleMessage.lineNumber() + ")";
            }
            return super.onConsoleMessage(consoleMessage);
        }

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
        public void onPageFinished(WebView view, String url) {
            lastPageFinishedUrl = url == null ? "" : url;
            super.onPageFinished(view, url);
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            if (debuggableBuild() && localDevelopmentSslError(error)) {
                handler.proceed();
                return;
            }

            handler.cancel();
            ReceiverConfigStore.recordRecoveryLaunch(MainActivity.this, "receiver_ssl_error");
            showLocalError("CarePland Receiver could not verify this connection.");
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                CharSequence description = error == null ? "" : error.getDescription();
                ReceiverConfigStore.recordRecoveryLaunch(MainActivity.this, "receiver_network_error");
                showLocalError(description == null ? "" : description.toString());
            }
        }

        @Override
        public void onReceivedHttpError(
                WebView view,
                WebResourceRequest request,
                WebResourceResponse errorResponse
        ) {
            if (request == null || !request.isForMainFrame()) {
                return;
            }

            int statusCode = errorResponse == null ? 0 : errorResponse.getStatusCode();
            String reason = errorResponse == null ? "" : errorResponse.getReasonPhrase();
            ReceiverConfigStore.recordRecoveryLaunch(MainActivity.this, "receiver_http_error_" + statusCode);
            showLocalError("Receiver page returned " + statusCode + ". " + emptyFallback(reason));
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

    private void showPairingRequiredScreen(String statusMessage) {
        configureApplianceWindow();
        cancelReceiverRecoveryCallbacks();
        receiverErrorVisible = false;

        ReceiverConfigStore.ReceiverConfig config = ReceiverConfigStore.load(this);

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(getColor(R.color.receiver_background));

        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(44, 36, 44, 36);

        TextView title = new TextView(this);
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(shortWizardScreen() ? 30 : 34);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setText("Set Up Receiver");
        panel.addView(
                title,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        TextView message = new TextView(this);
        message.setTextColor(0xFFDDEAF8);
        message.setTextSize(22);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 22, 0, 28);
        message.setText(
                "Enter this code at setup.carepland.com to pair this Receiver."
        );
        panel.addView(
                message,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        TextView codeView = new TextView(this);
        codeView.setTextColor(0xFFFFFFFF);
        codeView.setTextSize(shortWizardScreen() ? 48 : 64);
        codeView.setGravity(Gravity.CENTER);
        codeView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        codeView.setPadding(0, 10, 0, 18);
        codeView.setText(isBlank(currentPairingCode) ? "------" : currentPairingCode);
        panel.addView(
                codeView,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        TextView status = new TextView(this);
        status.setTextColor(0xFFDDEAF8);
        status.setTextSize(18);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, 0, 0, 22);
        status.setText(emptyFallback(statusMessage, currentPairingStatus, "Waiting for pairing."));
        panel.addView(
                status,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        Button setupButton = new Button(this);
        setupButton.setText("Open Setup Page");
        setupButton.setTextSize(24);
        setupButton.setTextColor(0xFF102019);
        setupButton.setBackgroundColor(0xFFFFFFFF);
        setupButton.setAllCaps(false);
        setupButton.setOnClickListener(view -> openSetupPage(config));
        LinearLayout.LayoutParams setupButtonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(78 * getResources().getDisplayMetrics().density)
        );
        setupButtonParams.setMargins(0, 0, 0, 18);
        panel.addView(setupButton, setupButtonParams);

        Button checkButton = new Button(this);
        checkButton.setText(isBlank(currentPairingCode) ? "Get Pairing Code" : "Check Pairing");
        checkButton.setTextSize(22);
        checkButton.setTextColor(0xFFFFFFFF);
        checkButton.setBackgroundColor(0xFF226D1D);
        checkButton.setAllCaps(false);
        checkButton.setOnClickListener(view -> {
            if (!ReceiverConfigStore.hasClaimOrBinding(this)) {
                if (isBlank(currentPairingCode)) {
                    requestPairingSession();
                } else {
                    pollPairingStatusOnce();
                }
                return;
            }
            if (!ReceiverConfigStore.hasCompletedProvisioningWizard(this)) {
                showProvisioningModeSelection();
                return;
            }
            startReceiverAfterSetup();
        });
        LinearLayout.LayoutParams checkButtonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(72 * getResources().getDisplayMetrics().density)
        );
        checkButtonParams.setMargins(0, 0, 0, 18);
        panel.addView(checkButton, checkButtonParams);

        Button exitButton = new Button(this);
        exitButton.setText("Exit");
        exitButton.setTextSize(20);
        exitButton.setTextColor(0xFF102019);
        exitButton.setBackgroundColor(0xFFFFFFFF);
        exitButton.setAllCaps(false);
        exitButton.setOnClickListener(view -> finish());
        LinearLayout.LayoutParams exitButtonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(62 * getResources().getDisplayMetrics().density)
        );
        panel.addView(exitButton, exitButtonParams);

        scrollView.addView(
                panel,
                new ScrollView.LayoutParams(
                        ScrollView.LayoutParams.MATCH_PARENT,
                        ScrollView.LayoutParams.MATCH_PARENT
                )
        );
        container.addView(
                scrollView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(container);
        if (isBlank(currentPairingCode) && !pairingRequestInFlight) {
            requestPairingSession();
        } else if (!isBlank(currentPairingCode)) {
            schedulePairingPoll();
        }
    }

    private void requestPairingSession() {
        if (pairingRequestInFlight) {
            return;
        }
        pairingRequestInFlight = true;
        currentPairingStatus = "Requesting pairing code...";
        ReceiverConfigStore.ReceiverConfig initialConfig = ReceiverConfigStore.load(this);
        String detectedProfile = detectedHardwareProfile(displayMetrics());
        new Thread(() -> {
            try {
                JSONObject requestBody = new JSONObject();
                requestBody.put("receiverInstallId", ReceiverConfigStore.installId(MainActivity.this));
                requestBody.put("receiverUrl", initialConfig.receiverUrl);
                requestBody.put("deviceProfile", emptyFallback(initialConfig.deviceProfile, "android_receiver"));
                requestBody.put("hardwareProfile", emptyFallback(initialConfig.hardwareProfile, detectedProfile));
                requestBody.put("uiLayout", emptyFallback(initialConfig.uiLayout, "default_receiver"));

                JSONObject response = postJson(pairingSessionsUri(initialConfig), requestBody);
                String pairingCode = response.optString("pairingCode", "");
                if (isBlank(pairingCode)) {
                    throw new IllegalStateException("Pairing code missing.");
                }
                currentPairingCode = pairingCode;
                currentPairingReceiverDeviceId = response.optString("receiverDeviceId", "");
                currentPairingStatus = "Waiting for caregiver to pair this Receiver.";
                runOnUiThread(() -> {
                    pairingRequestInFlight = false;
                    showPairingRequiredScreen(currentPairingStatus);
                    schedulePairingPoll();
                });
            } catch (Exception error) {
                currentPairingStatus = "Could not get a pairing code. Check network and try again.";
                runOnUiThread(() -> {
                    pairingRequestInFlight = false;
                    showPairingRequiredScreen(currentPairingStatus);
                });
            }
        }).start();
    }

    private void schedulePairingPoll() {
        cancelPairingPoll();
        if (isBlank(currentPairingCode) || ReceiverConfigStore.hasClaimOrBinding(this)) {
            return;
        }
        pairingPollRunnable = new Runnable() {
            @Override
            public void run() {
                if (ReceiverConfigStore.hasClaimOrBinding(MainActivity.this) || isBlank(currentPairingCode)) {
                    return;
                }
                pollPairingStatusOnce();
                mainHandler.postDelayed(this, PAIRING_POLL_INTERVAL_MS);
            }
        };
        mainHandler.postDelayed(pairingPollRunnable, PAIRING_POLL_INTERVAL_MS);
    }

    private void cancelPairingPoll() {
        if (pairingPollRunnable != null) {
            mainHandler.removeCallbacks(pairingPollRunnable);
            pairingPollRunnable = null;
        }
    }

    private void pollPairingStatusOnce() {
        if (isBlank(currentPairingCode) || pairingRequestInFlight) {
            return;
        }
        pairingRequestInFlight = true;
        ReceiverConfigStore.ReceiverConfig initialConfig = ReceiverConfigStore.load(this);
        String detectedProfile = detectedHardwareProfile(displayMetrics());
        new Thread(() -> {
            try {
                Uri uri = pairingSessionsUri(initialConfig)
                        .buildUpon()
                        .appendQueryParameter("code", currentPairingCode)
                        .appendQueryParameter("receiverDeviceId", currentPairingReceiverDeviceId)
                        .build();
                JSONObject response = getJson(uri);
                String status = response.optString("status", "");
                if ("paired".equals(status)) {
                    String claim = response.optString("claim", "");
                    String receiverDeviceId = response.optString("receiverDeviceId", currentPairingReceiverDeviceId);
                    String receiverUrl = response.optString("receiverUrl", initialConfig.receiverUrl);
                    if (isBlank(claim)) {
                        throw new IllegalStateException("Pairing completed without claim.");
                    }
                    ReceiverConfigStore.savePairingClaim(
                            MainActivity.this,
                            currentPairingCode,
                            claim,
                            receiverDeviceId,
                            receiverUrl,
                            emptyFallback(initialConfig.deviceProfile, "android_receiver"),
                            emptyFallback(initialConfig.hardwareProfile, detectedProfile),
                            emptyFallback(initialConfig.uiLayout, "default_receiver")
                    );
                    currentPairingStatus = "Receiver paired. Starting CarePland.";
                    runOnUiThread(() -> {
                        pairingRequestInFlight = false;
                        cancelPairingPoll();
                        currentPairingCode = "";
                        currentPairingReceiverDeviceId = "";
                        continueAfterPairing();
                    });
                    return;
                }
                if ("expired".equals(status) || "revoked".equals(status) || "used".equals(status)) {
                    currentPairingStatus = "Pairing code " + status + ". Get a new code.";
                    currentPairingCode = "";
                    currentPairingReceiverDeviceId = "";
                    runOnUiThread(() -> {
                        pairingRequestInFlight = false;
                        cancelPairingPoll();
                        showPairingRequiredScreen(currentPairingStatus);
                    });
                    return;
                }
                currentPairingStatus = "Waiting for pairing.";
                runOnUiThread(() -> pairingRequestInFlight = false);
            } catch (Exception error) {
                currentPairingStatus = "Waiting for pairing. Network check failed.";
                runOnUiThread(() -> pairingRequestInFlight = false);
            }
        }).start();
    }

    private void continueAfterPairing() {
        if (!ReceiverConfigStore.hasCompletedProvisioningWizard(this)) {
            showProvisioningModeSelection();
            return;
        }
        startReceiverAfterSetup();
    }

    private void startReceiverAfterSetup() {
        ReceiverConfigStore.ReceiverConfig config = ReceiverConfigStore.load(this);
        if (!isBlank(config.setupClaim)) {
            redeemPendingClaim(config);
            return;
        }
        requestAudioPermissionIfNeeded();
        loadReceiver();
    }

    private void redeemPendingClaim(ReceiverConfigStore.ReceiverConfig config) {
        Uri receiverUri = receiverUriWithNativeDeviceInfo();
        showReceiverLoading(receiverUri);
        new Thread(() -> {
            try {
                JSONObject requestBody = new JSONObject();
                requestBody.put("claim", config.setupClaim);
                requestBody.put("receiverInstallId", ReceiverConfigStore.installId(MainActivity.this));

                JSONObject response = postJson(claimRedeemUri(config), requestBody);
                ReceiverConfigStore.saveBinding(
                        MainActivity.this,
                        response.optString("receiverDeviceId", config.receiverDeviceId),
                        response.optString("bindingStatus", "bound"),
                        response.optString("deviceProfile", config.deviceProfile),
                        response.optString("hardwareProfile", config.hardwareProfile),
                        response.optString("uiLayout", config.uiLayout)
                );
                runOnUiThread(() -> {
                    requestAudioPermissionIfNeeded();
                    loadReceiver();
                });
            } catch (Exception error) {
                runOnUiThread(() -> showLocalError(
                        "CarePland paired this Receiver, but could not finish saving it on this device."
                                + "\n\nTap Retry to try again."
                                + "\n\nLast message: " + emptyFallback(error.getMessage(), "Unable to pair Receiver.")
                ));
            }
        }).start();
    }

    private void openSetupPage(ReceiverConfigStore.ReceiverConfig config) {
        Uri setupUri = setupPageUri(config);
        try {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, setupUri);
            browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(browserIntent);
        } catch (Exception ignored) {
            // Stay on the setup screen if Android cannot open a browser.
        }
    }

    private Uri setupPageUri(ReceiverConfigStore.ReceiverConfig config) {
        Uri baseUri = Uri.parse(config.receiverUrl);
        String setupHost = setupHostFor(baseUri.getHost());
        Uri.Builder builder = new Uri.Builder()
                .scheme(emptyFallback(baseUri.getScheme(), "https"))
                .encodedAuthority(emptyFallback(setupAuthorityFor(baseUri, setupHost), "setup.carepland.com"))
                .path("/connect/receiver/setup");
        if (!isBlank(currentPairingCode)) {
            builder.appendQueryParameter("code", currentPairingCode);
        } else if (!isBlank(config.setupCode)) {
            builder.appendQueryParameter("code", config.setupCode);
        }
        if (!isBlank(config.deviceProfile)) {
            builder.appendQueryParameter("device", config.deviceProfile);
        }
        if (!isBlank(config.hardwareProfile)) {
            builder.appendQueryParameter("hardwareProfile", config.hardwareProfile);
        }
        if (!isBlank(config.uiLayout)) {
            builder.appendQueryParameter("uiLayout", config.uiLayout);
        }
        if (!isBlank(config.receiverUrl)) {
            builder.appendQueryParameter("receiverUrl", config.receiverUrl);
        }
        return builder.build();
    }

    private Uri pairingSessionsUri(ReceiverConfigStore.ReceiverConfig config) {
        Uri baseUri = Uri.parse(config.receiverUrl);
        return baseUri.buildUpon()
                .path("/api/connect/receiver-shell/pairing-sessions")
                .clearQuery()
                .build();
    }

    private Uri claimRedeemUri(ReceiverConfigStore.ReceiverConfig config) {
        Uri baseUri = Uri.parse(config.receiverUrl);
        return baseUri.buildUpon()
                .path("/api/connect/receiver-shell/claims/redeem")
                .clearQuery()
                .build();
    }

    private String setupHostFor(String host) {
        if ("receiver.carepland.com".equalsIgnoreCase(host)) {
            return "setup.carepland.com";
        }
        return host;
    }

    private String setupAuthorityFor(Uri baseUri, String setupHost) {
        if (isBlank(setupHost)) {
            return "";
        }
        int port = baseUri.getPort();
        return port > 0 ? setupHost + ":" + port : setupHost;
    }

    private JSONObject postJson(Uri uri, JSONObject body) throws Exception {
        HttpURLConnection connection = openJsonConnection(uri, "POST");
        byte[] bytes = body.toString().getBytes("UTF-8");
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(bytes.length);
        OutputStream outputStream = connection.getOutputStream();
        outputStream.write(bytes);
        outputStream.close();
        return readJsonResponse(connection);
    }

    private JSONObject getJson(Uri uri) throws Exception {
        HttpURLConnection connection = openJsonConnection(uri, "GET");
        return readJsonResponse(connection);
    }

    private HttpURLConnection openJsonConnection(Uri uri, String method) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json");
        return connection;
    }

    private JSONObject readJsonResponse(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String body = readStream(stream);
        JSONObject json = body.trim().isEmpty() ? new JSONObject() : new JSONObject(body);
        if (status < 200 || status >= 300) {
            String message = json.optString("error", "Receiver pairing request failed.");
            throw new IllegalStateException(message);
        }
        return json;
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, "UTF-8"));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        reader.close();
        return builder.toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void showLocalError(String description) {
        configureApplianceWindow();
        cancelReceiverRecoveryCallbacks();

        ReceiverConfigStore.ReceiverConfig config = ReceiverConfigStore.load(this);
        DisplayMetrics metrics = displayMetrics();
        boolean configured = ReceiverConfigStore.hasProvisioning(this);
        receiverErrorVisible = configured;
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(getColor(R.color.receiver_background));

        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(40, 32, 40, 32);

        TextView title = new TextView(this);
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(configured ? 30 : 34);
        title.setGravity(Gravity.CENTER);
        title.setText(configured ? "CarePland Receiver" : "Receiver needs setup");
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        panel.addView(
                title,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        TextView message = new TextView(this);
        message.setTextColor(0xFFDDEAF8);
        message.setTextSize(20);
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, 20, 0, 22);
        message.setText(
                configured
                        ? "Waiting for the receiver page.\n\n"
                        + description
                        + "\n\nCarePland will try again automatically."
                        : "Open the Receiver setup page on this device, then tap Open Receiver App."
        );
        panel.addView(
                message,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        Button retryButton = new Button(this);
        retryButton.setText(configured ? "Retry" : "Check Again");
        retryButton.setTextSize(22);
        retryButton.setTextColor(0xFFFFFFFF);
        retryButton.setBackgroundColor(0xFF226D1D);
        retryButton.setAllCaps(false);
        retryButton.setOnClickListener(view -> {
            if (ReceiverConfigStore.hasProvisioning(this)) {
                startReceiverAfterSetup();
            } else {
                showLocalError("");
            }
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                Math.round(72 * getResources().getDisplayMetrics().density)
        );
        buttonParams.setMargins(0, 0, 0, 22);
        panel.addView(retryButton, buttonParams);

        if (configured) {
            TextView retryNote = new TextView(this);
            retryNote.setTextColor(0xFFDDEAF8);
            retryNote.setTextSize(18);
            retryNote.setGravity(Gravity.CENTER);
            retryNote.setPadding(0, 0, 0, 18);
            retryNote.setText("Trying again in a few seconds.");
            panel.addView(
                    retryNote,
                    new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                    )
            );
            scheduleReceiverAutoRetry(retryNote);
        }

        if (configured) {
            TextView details = new TextView(this);
            details.setTextColor(0xFFAEB9B3);
            details.setTextSize(14);
            details.setGravity(Gravity.CENTER);
            details.setText(
                    "URL: " + config.receiverUrl
                            + "\nHardware: " + emptyFallback(config.hardwareProfile, config.deviceProfile, "auto")
                            + "\nLayout: " + emptyFallback(config.uiLayout, "auto")
                            + "\nInstall: " + emptyFallback(config.installId, "unknown")
                            + "\nReceiver: " + emptyFallback(config.receiverDeviceId, "not bound")
                            + "\nStatus: " + emptyFallback(config.bindingStatus, "unprovisioned")
                            + "\nMode: " + emptyFallback(config.receiverMode, "not selected")
                            + "\nRecovery: " + emptyFallback(config.lastRecoveryAction, "none")
                            + "\nDetected: " + detectedHardwareProfile(metrics)
                            + "\nKiosk: " + kioskStatusLabel()
                            + "\nDevice: " + Build.MANUFACTURER + " " + Build.MODEL
                            + "\nScreen: " + metrics.widthPixels + " x " + metrics.heightPixels
                            + " @ " + metrics.densityDpi + " dpi"
                            + "\nAndroid API: " + Build.VERSION.SDK_INT
            );
            panel.addView(
                    details,
                    new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                    )
            );
        }

        scrollView.addView(
                panel,
                new ScrollView.LayoutParams(
                        ScrollView.LayoutParams.MATCH_PARENT,
                        ScrollView.LayoutParams.MATCH_PARENT
                )
        );
        container.addView(
                scrollView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(container);
    }

    private void scheduleReceiverAutoRetry(TextView retryNote) {
        if (!ReceiverConfigStore.hasProvisioning(this) || receiverPageReady) {
            return;
        }
        if (receiverAutoRetryRunnable != null) {
            mainHandler.removeCallbacks(receiverAutoRetryRunnable);
        }

        receiverAutoRetrySecondsRemaining = RECEIVER_AUTO_RETRY_SECONDS;
        receiverAutoRetryRunnable = new Runnable() {
            @Override
            public void run() {
                if (!receiverErrorVisible || !ReceiverConfigStore.hasProvisioning(MainActivity.this)) {
                    return;
                }
                if (receiverAutoRetrySecondsRemaining <= 0) {
                    startReceiverAfterSetup();
                    return;
                }
                if (retryNote != null) {
                    retryNote.setText("Trying again in " + receiverAutoRetrySecondsRemaining + "...");
                }
                receiverAutoRetrySecondsRemaining -= 1;
                mainHandler.postDelayed(this, 1000);
            }
        };
        receiverAutoRetryRunnable.run();
    }

    private void saveLocalTestProvisioning() {
        Uri localProvisioningUri = Uri.parse(
                "carepland://receiver/provision"
                        + "?receiver_url=http%3A%2F%2F10.0.2.2%3A3002%2Fconnect%2Freceiver"
                        + "&code=12345"
                        + "&device=gxv3370"
                        + "&hardwareProfile=studio_gxv3370_1024x600"
                        + "&uiLayout=desk_phone_1024x600"
        );
        ReceiverConfigStore.saveProvisioningUri(this, localProvisioningUri);
    }

    private static String emptyFallback(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
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
                    + "\"setupClaim\":\"" + escapeJson(config.setupClaim) + "\","
                    + "\"bindingStatus\":\"" + escapeJson(config.bindingStatus) + "\","
                    + "\"deviceProfile\":\"" + escapeJson(config.deviceProfile) + "\","
                    + "\"hardwareProfile\":\"" + escapeJson(config.hardwareProfile) + "\","
                    + "\"uiLayout\":\"" + escapeJson(config.uiLayout) + "\","
                    + "\"receiverInstallId\":\"" + escapeJson(config.installId) + "\","
                    + "\"receiverDeviceId\":\"" + escapeJson(config.receiverDeviceId) + "\","
                    + "\"provisionedAtMs\":" + config.provisionedAtMs + ","
                    + "\"receiverMode\":\"" + escapeJson(config.receiverMode) + "\","
                    + "\"provisioningCompletedAtMs\":" + config.provisioningCompletedAtMs + ","
                    + "\"capabilities\":{"
                    + "\"fullscreen\":\"" + escapeJson(config.capabilityFullscreen) + "\","
                    + "\"microphone\":\"" + escapeJson(config.capabilityMicrophone) + "\","
                    + "\"kiosk\":\"" + escapeJson(config.capabilityKiosk) + "\","
                    + "\"keepAwake\":\"" + escapeJson(config.capabilityKeepAwake) + "\","
                    + "\"bootStart\":\"" + escapeJson(config.capabilityBootStart) + "\","
                    + "\"batteryOptimization\":\"" + escapeJson(config.capabilityBatteryOptimization) + "\","
                    + "\"updateChecks\":\"" + escapeJson(config.capabilityUpdateChecks) + "\""
                    + "},"
                    + "\"lastRecoveryAction\":\"" + escapeJson(config.lastRecoveryAction) + "\","
                    + "\"lastRecoveryAtMs\":" + config.lastRecoveryAtMs + ","
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
                    + "\"deviceOwner\":" + isDeviceOwner() + ","
                    + "\"deviceAdminActive\":" + isDeviceAdminActive() + ","
                    + "\"lockTaskPermitted\":" + isLockTaskPermitted() + ","
                    + "\"lockTaskActive\":" + isLockTaskActive() + ","
                    + "\"versionName\":\"" + escapeJson(versionName()) + "\","
                    + "\"versionCode\":" + versionCode() + ","
                    + "\"updatePolicyUrl\":\"" + escapeJson(updatePolicyUri().toString()) + "\","
                    + "\"shellVersion\":\"" + escapeJson(SHELL_VERSION) + "\""
                    + "}";
        }

        @JavascriptInterface
        public String getUpdatePolicyUrl() {
            return updatePolicyUri().toString();
        }

        @JavascriptInterface
        public void receiverReady() {
            runOnUiThread(() -> {
                receiverPageReady = true;
                receiverErrorVisible = false;
                cancelReceiverRecoveryCallbacks();
            });
        }

        @JavascriptInterface
        public void reportReceiverError(String message) {
            runOnUiThread(() -> lastConsoleMessage = emptyFallback(message, "Receiver reported an error."));
        }

        @JavascriptInterface
        public void receiverSetupRequired(String message) {
            runOnUiThread(() -> {
                ReceiverConfigStore.clearBinding(MainActivity.this);
                currentPairingCode = "";
                currentPairingReceiverDeviceId = "";
                currentPairingStatus = emptyFallback(message, "Receiver setup is required.");
                cancelPairingPoll();
                showPairingRequiredScreen(currentPairingStatus);
            });
        }

        @JavascriptInterface
        public void saveBinding(
                String receiverDeviceId,
                String bindingStatus,
                String deviceProfile,
                String hardwareProfile,
                String uiLayout
        ) {
            ReceiverConfigStore.saveBinding(
                    MainActivity.this,
                    receiverDeviceId,
                    bindingStatus,
                    deviceProfile,
                    hardwareProfile,
                    uiLayout
            );
        }

        @JavascriptInterface
        public void reloadReceiver() {
            runOnUiThread(() -> {
                if (webView != null) {
                    startReceiverAfterSetup();
                }
            });
        }
    }

    private DisplayMetrics displayMetrics() {
        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
        return metrics;
    }

    private String versionName() {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            return packageInfo.versionName == null ? "" : packageInfo.versionName;
        } catch (PackageManager.NameNotFoundException ignored) {
            return "";
        }
    }

    private long versionCode() {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return packageInfo.getLongVersionCode();
            }
            return packageInfo.versionCode;
        } catch (PackageManager.NameNotFoundException ignored) {
            return 0;
        }
    }

    private boolean isDeviceOwner() {
        DevicePolicyManager devicePolicyManager =
                (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        return devicePolicyManager != null && devicePolicyManager.isDeviceOwnerApp(getPackageName());
    }

    private boolean isDeviceAdminActive() {
        DevicePolicyManager devicePolicyManager =
                (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, ReceiverDeviceAdminReceiver.class);
        return devicePolicyManager != null && devicePolicyManager.isAdminActive(admin);
    }

    private boolean isLockTaskPermitted() {
        DevicePolicyManager devicePolicyManager =
                (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        return devicePolicyManager != null && devicePolicyManager.isLockTaskPermitted(getPackageName());
    }

    private boolean isLockTaskActive() {
        ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return activityManager != null
                && activityManager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private String kioskStatusLabel() {
        if (isLockTaskActive()) {
            return "active";
        }
        if (isLockTaskPermitted()) {
            return "permitted";
        }
        if (isDeviceOwner()) {
            return "owner_not_locked";
        }
        return isDeviceAdminActive() ? "admin_only" : "soft";
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

    private Uri updatePolicyUri() {
        Uri receiverUri = ReceiverConfigStore.receiverUri(this);
        DisplayMetrics metrics = displayMetrics();
        String authority = receiverUri.getEncodedAuthority();
        Uri.Builder builder = new Uri.Builder()
                .scheme(receiverUri.getScheme())
                .encodedAuthority(authority)
                .appendPath("api")
                .appendPath("connect")
                .appendPath("receiver-shell")
                .appendPath("update-policy");

        builder.appendQueryParameter("nativeVersionCode", String.valueOf(versionCode()));
        builder.appendQueryParameter("nativeVersionName", versionName());
        builder.appendQueryParameter("shellVersion", SHELL_VERSION);
        builder.appendQueryParameter("hardwareProfile", detectedHardwareProfile(metrics));
        builder.appendQueryParameter("nativeManufacturer", Build.MANUFACTURER);
        builder.appendQueryParameter("nativeModel", Build.MODEL);
        builder.appendQueryParameter("nativeSdk", String.valueOf(Build.VERSION.SDK_INT));

        return builder.build();
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
