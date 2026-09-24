package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.PosSession
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {
    @Query("SELECT * FROM pos_sessions WHERE status = 'OPEN' AND deviceId = :deviceId LIMIT 1")
    fun getOpenSession(deviceId: String): Flow<PosSession?>

    @Query("SELECT * FROM pos_sessions WHERE status = 'OPEN' AND deviceId = :deviceId LIMIT 1")
    suspend fun getOpenSessionOnce(deviceId: String): PosSession?

    @Query("SELECT * FROM pos_sessions WHERE id = :id")
    suspend fun getById(id: String): PosSession?

    @Query("SELECT * FROM pos_sessions WHERE deviceId = :deviceId ORDER BY openedAt DESC LIMIT 20")
    fun getRecentSessions(deviceId: String): Flow<List<PosSession>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: PosSession)

    @Update
    suspend fun update(session: PosSession)

    @Query("UPDATE pos_sessions SET totalSales = totalSales + :amount, transactionCount = transactionCount + 1 WHERE id = :sessionId")
    suspend fun incrementSales(sessionId: String, amount: Double)

    @Query("UPDATE pos_sessions SET totalRefunds = totalRefunds + :amount WHERE id = :sessionId")
    suspend fun incrementRefunds(sessionId: String, amount: Double)

    @Query("SELECT * FROM pos_sessions WHERE syncStatus = 'PENDING'")
    suspend fun getPendingSync(): List<PosSession>
}
