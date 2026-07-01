package com.carepland.connectreceiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        if (!ReceiverConfigStore.isDedicatedReceiverMode(context)) {
            return;
        }

        ReceiverConfigStore.recordRecoveryLaunch(context, intent.getAction());

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        launchIntent.putExtra("carepland_launch_reason", intent.getAction());
        context.startActivity(launchIntent);
    }
}
