package com.retail.shared.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.retail.shared.data.local.entity.CustomerEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers WHERE tenantId = :tenantId ORDER BY name COLLATE NOCASE ASC")
    fun getAll(tenantId: String): Flow<List<CustomerEntity>>

    @Query("""
        SELECT * FROM customers
        WHERE tenantId = :tenantId
        AND (name LIKE '%' || :query || '%'
             OR phone LIKE '%' || :query || '%'
             OR COALESCE(email, '') LIKE '%' || :query || '%'
             OR COALESCE(loyaltyNumber, '') LIKE '%' || :query || '%')
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun search(tenantId: String, query: String): Flow<List<CustomerEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(customer: CustomerEntity)

    @Update
    suspend fun update(customer: CustomerEntity)

    @Delete
    suspend fun delete(customer: CustomerEntity)

    @Query("SELECT * FROM customers WHERE id = :id AND tenantId = :tenantId LIMIT 1")
    suspend fun findById(id: String, tenantId: String): CustomerEntity?
}
