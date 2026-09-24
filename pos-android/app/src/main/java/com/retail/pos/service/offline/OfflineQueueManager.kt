package com.retail.pos.service.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.retail.shared.data.local.dao.OfflineQueueDao
import com.retail.shared.data.local.entity.OfflineQueueItem
import com.retail.shared.sync.SyncManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OfflineQueueManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val offlineQueueDao: OfflineQueueDao,
    private val syncManager: SyncManager
) {
    val pendingCount: Flow<Int> = offlineQueueDao.getPendingCount()

    fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun enqueue(item: OfflineQueueItem) {
        offlineQueueDao.insert(item)
        if (isOnline()) {
            syncManager.enqueueImmediateSync()
        }
    }

    suspend fun retryFailed() {
        val failed = offlineQueueDao.getPendingOnce().filter { it.retryCount > 0 }
        failed.forEach {
            offlineQueueDao.update(it.copy(status = "PENDING", retryCount = 0))
        }
        syncManager.enqueueImmediateSync()
    }

    suspend fun clearCompleted() {
        offlineQueueDao.prune()
    }
}
