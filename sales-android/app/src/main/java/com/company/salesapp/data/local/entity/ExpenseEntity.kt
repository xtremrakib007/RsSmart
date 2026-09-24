package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val serverId: String? = null,
    val tenantId: String,
    val userId: String,
    val amount: Double,
    val category: String,
    val description: String? = null,
    val receiptPhoto: String? = null,
    val expenseDate: Long,
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
