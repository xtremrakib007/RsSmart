package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey val id: String,
    val serverId: String? = null,
    val tenantId: String,
    val customerId: String,
    val customerName: String? = null,
    val salesRepId: String,
    val status: String = "DRAFT",
    val subtotal: Double = 0.0,
    val taxAmount: Double = 0.0,
    val discount: Double = 0.0,
    val total: Double = 0.0,
    val notes: String? = null,
    val deliveryDate: Long? = null,
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val version: Int = 1
)
