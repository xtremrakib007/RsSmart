package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.Customer
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers WHERE tenantId = :tenantId AND isActive = 1 ORDER BY name ASC")
    fun getAll(tenantId: String): Flow<List<Customer>>

    @Query("""SELECT * FROM customers WHERE tenantId = :tenantId AND isActive = 1
        AND (name LIKE '%' || :query || '%' OR phone LIKE '%' || :query || '%' OR loyaltyNumber LIKE '%' || :query || '%')
        ORDER BY name ASC""")
    fun search(tenantId: String, query: String): Flow<List<Customer>>

    @Query("SELECT * FROM customers WHERE id = :id AND tenantId = :tenantId LIMIT 1")
    suspend fun getById(id: String, tenantId: String): Customer?

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(customer: Customer)

    @Update
    suspend fun update(customer: Customer)

    @Query("UPDATE customers SET isActive = 0, updatedAt = :updatedAt, syncStatus = 'PENDING' WHERE id = :id AND tenantId = :tenantId")
    suspend fun archive(id: String, tenantId: String, updatedAt: Long = System.currentTimeMillis())

    @Query("SELECT * FROM customers WHERE tenantId = :tenantId AND syncStatus = 'PENDING'")
    suspend fun getPendingSync(tenantId: String): List<Customer>
}
