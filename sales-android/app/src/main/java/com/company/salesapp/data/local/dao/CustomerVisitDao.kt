package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.CustomerVisitEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomerVisitDao {
    @Query("SELECT * FROM customer_visits WHERE customerId = :customerId ORDER BY checkInAt DESC")
    fun getByCustomer(customerId: String): Flow<List<CustomerVisitEntity>>

    @Query("SELECT * FROM customer_visits WHERE isSynced = 0")
    suspend fun getUnsynced(): List<CustomerVisitEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(visit: CustomerVisitEntity)

    @Query("UPDATE customer_visits SET isSynced = 1, serverId = :serverId WHERE id = :localId")
    suspend fun markSynced(localId: String, serverId: String)

    @Update
    suspend fun update(visit: CustomerVisitEntity)
}
