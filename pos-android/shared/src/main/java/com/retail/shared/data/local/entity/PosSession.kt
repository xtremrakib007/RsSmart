package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "pos_sessions",
    indices = [Index(value = ["status"]), Index(value = ["openedAt"])]
)
data class PosSession(
    @PrimaryKey
    val id: String,
    val tenantId: String,
    val userId: String,
    val deviceId: String,
    val openingCash: Double,
    val closingCash: Double? = null,
    val expectedCash: Double? = null,
    val cashDifference: Double? = null,
    val totalSales: Double = 0.0,
    val totalRefunds: Double = 0.0,
    val transactionCount: Int = 0,
    val openedAt: Long,
    val closedAt: Long? = null,
    val status: String = "OPEN", // OPEN, CLOSED, SYNCING
    val notes: String? = null,
    val syncStatus: String = "PENDING"
)
