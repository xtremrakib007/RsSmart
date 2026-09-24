package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.SyncEventEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SyncEventDao {
    @Query("SELECT * FROM sync_events WHERE status = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPending(): List<SyncEventEntity>

    @Query("SELECT * FROM sync_events WHERE status = 'PENDING' ORDER BY createdAt ASC")
    fun getPendingFlow(): Flow<List<SyncEventEntity>>

    @Query("SELECT COUNT(*) FROM sync_events WHERE status = 'PENDING'")
    fun getPendingCountFlow(): Flow<Int>

    @Query("SELECT * FROM sync_events WHERE status = 'FAILED' ORDER BY createdAt DESC LIMIT 20")
    suspend fun getFailed(): List<SyncEventEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(event: SyncEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(events: List<SyncEventEntity>)

    @Query("UPDATE sync_events SET status = :status, lastError = :error WHERE eventId = :eventId")
    suspend fun updateStatus(eventId: String, status: String, error: String? = null)

    @Query("UPDATE sync_events SET retryCount = retryCount + 1 WHERE eventId = :eventId")
    suspend fun incrementRetry(eventId: String)

    @Query("DELETE FROM sync_events WHERE status = 'COMPLETED' AND createdAt < :beforeDate")
    suspend fun cleanupOldEvents(beforeDate: Long)

    @Query("DELETE FROM sync_events")
    suspend fun clearAll()
}
