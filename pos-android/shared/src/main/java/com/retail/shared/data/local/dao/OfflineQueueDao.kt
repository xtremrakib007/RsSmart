package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.OfflineQueueItem
import kotlinx.coroutines.flow.Flow

@Dao
interface OfflineQueueDao {
    @Query("SELECT * FROM offline_queue WHERE status = 'PENDING' ORDER BY priority ASC, createdAt ASC LIMIT 50")
    fun getPending(): Flow<List<OfflineQueueItem>>

    @Query("SELECT * FROM offline_queue WHERE status = 'PENDING' ORDER BY priority ASC, createdAt ASC LIMIT 50")
    suspend fun getPendingOnce(): List<OfflineQueueItem>

    @Query("SELECT COUNT(*) FROM offline_queue WHERE status = 'PENDING'")
    fun getPendingCount(): Flow<Int>

    @Insert
    suspend fun insert(item: OfflineQueueItem): Long

    @Update
    suspend fun update(item: OfflineQueueItem)

    @Query("UPDATE offline_queue SET status = 'PROCESSING', lastAttempt = :timestamp WHERE id = :id")
    suspend fun markProcessing(id: Long, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE offline_queue SET status = 'FAILED', retryCount = retryCount + 1, errorMessage = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String?)

    @Query("UPDATE offline_queue SET status = 'COMPLETED' WHERE id = :id")
    suspend fun markCompleted(id: Long)

    @Query("DELETE FROM offline_queue WHERE status = 'COMPLETED' OR (status = 'FAILED' AND retryCount >= maxRetries)")
    suspend fun prune()
}
