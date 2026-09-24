package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.CustomerEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers WHERE tenantId = :tenantId AND isActive = 1 ORDER BY name ASC")
    fun getAll(tenantId: String): Flow<List<CustomerEntity>>

    @Query("SELECT * FROM customers WHERE tenantId = :tenantId AND isActive = 1 AND (name LIKE '%' || :query || '%' OR phone LIKE '%' || :query || '%' OR email LIKE '%' || :query || '%') ORDER BY name ASC")
    fun search(tenantId: String, query: String): Flow<List<CustomerEntity>>

    @Query("SELECT * FROM customers WHERE id = :id")
    suspend fun getById(id: String): CustomerEntity?

    @Query("SELECT * FROM customers WHERE serverId = :serverId")
    suspend fun getByServerId(serverId: String): CustomerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(customer: CustomerEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(customers: List<CustomerEntity>)

    @Update
    suspend fun update(customer: CustomerEntity)

    @Query("UPDATE customers SET isSynced = 1, serverId = :serverId WHERE id = :localId")
    suspend fun markSynced(localId: String, serverId: String)

    @Query("SELECT * FROM customers WHERE isSynced = 0")
    suspend fun getUnsynced(): List<CustomerEntity>

    @Query("DELETE FROM customers WHERE tenantId = :tenantId")
    suspend fun deleteAll(tenantId: String)
}
