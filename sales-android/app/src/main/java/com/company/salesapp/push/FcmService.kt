package com.company.salesapp.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.company.salesapp.MainActivity
import com.company.salesapp.R
import com.company.salesapp.data.repository.PushTokenRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FcmService : FirebaseMessagingService() {

    @Inject lateinit var pushTokenRepository: PushTokenRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        const val CHANNEL_ID = "sales_app_default"
        const val EXTRA_DEEP_LINK_ROUTE = "deep_link_route"
    }

    /**
     * Called whenever FCM (re)generates a token for this device — on first
     * install, after app data is cleared, or on periodic token rotation.
     * This is the single most important entry point: without this, a token
     * that rotates after initial registration silently stops receiving
     * push, since the backend still has the old (dead) token on file.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        scope.launch { pushTokenRepository.register(token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title ?: message.data["title"] ?: "Sales App"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val type = message.data["type"] // "SYNC_CONFLICT" | "ORDER_APPROVED"
        val screen = message.data["screen"] // matches backend's payload.data.screen

        showNotification(title, body, type, screen)
    }

    private fun showNotification(title: String, body: String, type: String?, screen: String?) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "General notifications",
                NotificationManager.IMPORTANCE_HIGH,
            )
            notificationManager.createNotificationChannel(channel)
        }

        // route mapping: see backend/src/push/push.service.ts callers for
        // the `screen` values this needs to handle. `order-detail` is
        // deliberately mapped to the Orders list, not Screen.OrderDetail —
        // that route exists in Screen.kt but has no registered destination
        // or screen composable in SalesNavGraph, so navigating there would
        // crash. Falls back to the Orders list until OrderDetailScreen
        // actually exists.
        val route = when (screen) {
            "sync-resolve" -> "sync_status"
            "order-detail" -> "orders"
            else -> "dashboard"
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_DEEP_LINK_ROUTE, route)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
