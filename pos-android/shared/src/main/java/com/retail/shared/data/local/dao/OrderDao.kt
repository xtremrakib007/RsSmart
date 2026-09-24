package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.PosOrder
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {
    @Query("SELECT * FROM pos_orders WHERE sessionId = :sessionId ORDER BY createdAt DESC")
    fun getBySession(sessionId: String): Flow<List<PosOrder>>

    @Query("SELECT * FROM pos_orders WHERE id = :id")
    suspend fun getById(id: String): PosOrder?

    @Query("SELECT * FROM pos_orders WHERE receiptNumber = :receiptNumber LIMIT 1")
    suspend fun getByReceipt(receiptNumber: String): PosOrder?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(order: PosOrder)

    @Update
    suspend fun update(order: PosOrder)

    @Query("SELECT * FROM pos_orders WHERE syncStatus = 'PENDING'")
    suspend fun getPendingSync(): List<PosOrder>

    @Query("UPDATE pos_orders SET status = 'REFUNDED', syncStatus = 'PENDING' WHERE id = :orderId")
    suspend fun markRefunded(orderId: String)
}
