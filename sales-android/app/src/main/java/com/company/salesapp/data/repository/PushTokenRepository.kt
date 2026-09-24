package com.company.salesapp.data.repository

import android.util.Log
import com.company.salesapp.data.remote.api.PushApi
import com.company.salesapp.data.remote.api.UnregisterDeviceRequest
import com.company.salesapp.data.remote.dto.RegisterDeviceRequest
import com.company.salesapp.util.DeviceIdProvider
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushTokenRepository @Inject constructor(
    private val pushApi: PushApi,
    private val deviceIdProvider: DeviceIdProvider,
) {
    companion object {
        private const val TAG = "PushTokenRepository"
    }

    /**
     * Registers (or refreshes) this device's FCM token with the backend.
     * Requires the user to already be logged in — AuthInterceptor attaches
     * the JWT automatically. Safe to call when logged out too: the backend
     * will simply reject with 401, which we swallow here since a failed
     * push registration must never break app startup or token refresh.
     */
    suspend fun register(fcmToken: String) {
        try {
            val response = pushApi.registerDevice(
                RegisterDeviceRequest(deviceId = deviceIdProvider.deviceId, token = fcmToken),
            )
            if (!response.isSuccessful) {
                Log.w(TAG, "Device registration failed: HTTP ${response.code()}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Device registration failed", e)
        }
    }

    /** Called on logout, before the auth token is cleared. */
    suspend fun unregister() {
        try {
            pushApi.unregisterDevice(UnregisterDeviceRequest(deviceId = deviceIdProvider.deviceId))
        } catch (e: Exception) {
            Log.w(TAG, "Device unregistration failed", e)
        }
    }
}
