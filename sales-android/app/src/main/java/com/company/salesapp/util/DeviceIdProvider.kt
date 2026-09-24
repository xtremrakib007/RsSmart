package com.company.salesapp.util

import android.content.Context
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Provides the single stable device identifier used app-wide.
 *
 * IMPORTANT: this must stay identical to what's sent as SyncEvent.clientId
 * (see SyncManager) and what's registered as DeviceToken.deviceId on the
 * backend (POST /push/devices). The backend's sync-conflict push
 * (PushService.sendToDevice) looks a device up by this exact string — if it
 * ever diverges from SyncManager's clientId, sync-conflict push
 * notifications silently stop reaching the device.
 */
@Singleton
class DeviceIdProvider @Inject constructor(@ApplicationContext context: Context) {
    val deviceId: String = "${android.os.Build.MODEL}_${Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)}"
}
