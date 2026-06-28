package com.carepland.connectreceiver;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

public class ProvisioningActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleProvisioningIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleProvisioningIntent(intent);
    }

    private void handleProvisioningIntent(Intent intent) {
        if (intent != null && intent.getData() != null) {
            ReceiverConfigStore.saveProvisioningUri(this, intent.getData());
        }

        Intent receiverIntent = new Intent(this, MainActivity.class);
        receiverIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(receiverIntent);
        finish();
    }
}
