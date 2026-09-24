package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "cart_items",
    foreignKeys = [
        ForeignKey(
            entity = Product::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["productId"]), Index(value = ["sessionId"])]
)
data class CartItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sessionId: String,
    val productId: String,
    val productName: String,
    val unitPrice: Double,
    val quantity: Double,
    val discountAmount: Double = 0.0,
    val taxAmount: Double = 0.0,
    val lineTotal: Double,
    val notes: String? = null
)
