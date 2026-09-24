package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "payments",
    indices = [Index(value = ["orderId"]), Index(value = ["syncStatus"])]
)
data class Payment(
    @PrimaryKey
    val id: String,
    val orderId: String,
    val sessionId: String,
    val amount: Double,
    val method: String, // CASH, CARD, MOBILE, SPLIT
    val cardLastFour: String? = null,
    val cardType: String? = null,
    val mobileProvider: String? = null,
    val mobileReference: String? = null,
    val isRefund: Boolean = false,
    val processedAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "PENDING",
    val receiptNumber: String? = null
)
