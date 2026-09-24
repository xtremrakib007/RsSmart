package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.OrderItemEntity

@Dao
interface OrderItemDao {
    @Query("SELECT * FROM order_items WHERE orderId = :orderId")
    suspend fun getByOrderId(orderId: String): List<OrderItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: OrderItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<OrderItemEntity>)

    @Query("DELETE FROM order_items WHERE orderId = :orderId")
    suspend fun deleteByOrderId(orderId: String)
}
