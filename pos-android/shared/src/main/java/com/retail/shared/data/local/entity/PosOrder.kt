package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "pos_orders",
    indices = [Index(value = ["sessionId"]), Index(value = ["syncStatus"])]
)
data class PosOrder(
    @PrimaryKey
    val id: String,
    val sessionId: String,
    val receiptNumber: String,
    val subtotal: Double,
    val totalDiscount: Double = 0.0,
    val totalTax: Double = 0.0,
    val grandTotal: Double,
    val customerId: String? = null,
    val customerName: String? = null,
    val itemCount: Int,
    val status: String = "COMPLETED", // COMPLETED, REFUNDED, PENDING
    val isOffline: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "PENDING",
    val serverVersion: Long = 0
)
