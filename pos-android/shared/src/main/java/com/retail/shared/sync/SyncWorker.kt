package com.retail.shared.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.retail.shared.data.local.dao.OfflineQueueDao
import com.retail.shared.data.local.entity.OfflineQueueItem
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val offlineQueueDao: OfflineQueueDao,
    private val syncApi: SyncApi // Defined below
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val pending = offlineQueueDao.getPendingOnce()
            if (pending.isEmpty()) return@withContext Result.success()

            var hasFailures = false
            for (item in pending) {
                try {
                    offlineQueueDao.markProcessing(item.id)
                    processItem(item)
                    offlineQueueDao.markCompleted(item.id)
                } catch (e: IOException) {
                    offlineQueueDao.markFailed(item.id, e.message)
                    hasFailures = true
                } catch (e: HttpException) {
                    if (e.code() in 500..599) {
                        offlineQueueDao.markFailed(item.id, e.message())
                        hasFailures = true
                    } else {
                        // 4xx = don't retry, mark completed to avoid loop
                        offlineQueueDao.markCompleted(item.id)
                    }
                }
            }
            offlineQueueDao.prune()
            if (hasFailures) Result.retry() else Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private suspend fun processItem(item: OfflineQueueItem) {
        when (item.entityType) {
            "ORDER" -> syncApi.pushOrder(item.payload)
            "PAYMENT" -> syncApi.pushPayment(item.payload)
            "SESSION" -> syncApi.pushSession(item.payload)
            else -> throw IllegalArgumentException("Unknown entity type: ${item.entityType}")
        }
    }
}
