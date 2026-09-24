package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.OrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {
    @Query("SELECT * FROM orders WHERE tenantId = :tenantId ORDER BY createdAt DESC")
    fun getAll(tenantId: String): Flow<List<OrderEntity>>

    @Query("SELECT * FROM orders WHERE id = :id")
    suspend fun getById(id: String): OrderEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(order: OrderEntity): Long

    @Update
    suspend fun update(order: OrderEntity)

    @Query("UPDATE orders SET isSynced = 1, serverId = :serverId WHERE id = :localId")
    suspend fun markSynced(localId: String, serverId: String)

    @Query("SELECT * FROM orders WHERE isSynced = 0")
    suspend fun getUnsynced(): List<OrderEntity>

    @Query("SELECT * FROM orders WHERE status = 'DRAFT' AND salesRepId = :userId ORDER BY createdAt DESC")
    fun getDrafts(userId: String): Flow<List<OrderEntity>>
}
