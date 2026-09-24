import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ERPFirebaseService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        when (remoteMessage.data["type"]) {
            "SYNC_CONFLICT" -> showConflictNotification(remoteMessage)
            "LOW_STOCK" -> showLowStockNotification(remoteMessage)
            else -> showDefaultNotification(remoteMessage)
        }
    }

    override fun onNewToken(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            apiService.registerDeviceToken(DeviceTokenRequest(token))
        }
    }
}
