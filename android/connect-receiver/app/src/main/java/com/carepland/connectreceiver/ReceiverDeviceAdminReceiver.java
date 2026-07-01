package com.carepland.connectreceiver;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.PersistableBundle;

public class ReceiverDeviceAdminReceiver extends DeviceAdminReceiver {
    @Override
    public void onProfileProvisioningComplete(Context context, Intent intent) {
        super.onProfileProvisioningComplete(context, intent);

        String provisioningUrl = provisioningUrlFromIntent(intent);
        if (provisioningUrl != null && !provisioningUrl.trim().isEmpty()) {
            ReceiverConfigStore.saveProvisioningUri(context, Uri.parse(provisioningUrl.trim()));
        }

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        launchIntent.putExtra("carepland_launch_reason", "device_owner_provisioned");
        context.startActivity(launchIntent);
    }

    private String provisioningUrlFromIntent(Intent intent) {
        if (intent == null) {
            return "";
        }

        Object rawExtras = intent.getParcelableExtra(
                DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE
        );

        if (rawExtras instanceof PersistableBundle) {
            return ((PersistableBundle) rawExtras).getString("careplandProvisioningUrl", "");
        }

        if (rawExtras instanceof Bundle) {
            return ((Bundle) rawExtras).getString("careplandProvisioningUrl", "");
        }

        return "";
    }
}
