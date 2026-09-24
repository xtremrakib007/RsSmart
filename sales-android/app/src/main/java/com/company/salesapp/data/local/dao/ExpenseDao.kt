package com.company.salesapp.data.local.dao

import androidx.room.*
import com.company.salesapp.data.local.entity.ExpenseEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE userId = :userId ORDER BY expenseDate DESC")
    fun getByUser(userId: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses WHERE isSynced = 0")
    suspend fun getUnsynced(): List<ExpenseEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(expense: ExpenseEntity)

    @Query("UPDATE expenses SET isSynced = 1, serverId = :serverId WHERE id = :localId")
    suspend fun markSynced(localId: String, serverId: String)
}
