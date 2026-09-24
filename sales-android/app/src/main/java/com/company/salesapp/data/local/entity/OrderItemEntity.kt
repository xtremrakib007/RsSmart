package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "order_items",
    foreignKeys = [ForeignKey(
        entity = OrderEntity::class,
        parentColumns = ["id"],
        childColumns = ["orderId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index(value = ["orderId"])]
)
data class OrderItemEntity(
    @PrimaryKey val id: String,
    val orderId: String,
    val productId: String,
    val productName: String,
    val quantity: Double,
    val unitPrice: Double,
    val discount: Double = 0.0,
    val taxRate: Double = 0.0,
    val taxAmount: Double = 0.0,
    val total: Double = 0.0
)
