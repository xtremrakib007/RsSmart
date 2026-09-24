package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.Payment
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(payment: Payment)

    @Query("SELECT * FROM payments WHERE orderId = :orderId ORDER BY processedAt DESC")
    fun getByOrder(orderId: String): Flow<List<Payment>>

    // The original (non-refund) payment for an order — used by refunds to match the
    // original tender method instead of assuming CASH.
    @Query("SELECT * FROM payments WHERE orderId = :orderId AND isRefund = 0 ORDER BY processedAt DESC LIMIT 1")
    suspend fun getOriginalPayment(orderId: String): Payment?

    @Query("SELECT * FROM payments WHERE syncStatus = 'PENDING'")
    suspend fun getPendingSync(): List<Payment>
}
