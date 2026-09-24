package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "products",
    indices = [Index(value = ["barcode"], unique = true), Index(value = ["sku"], unique = true)]
)
data class Product(
    @PrimaryKey
    val id: String,
    val sku: String,
    val barcode: String?,
    val name: String,
    val description: String?,
    val categoryId: String?,
    val unitPrice: Double,
    val costPrice: Double?,
    val taxRate: Double = 0.0,
    val stockQuantity: Double = 0.0,
    val unitOfMeasure: String = "PCS",
    val isActive: Boolean = true,
    val imageUrl: String?,
    val tenantId: String,
    val syncStatus: String = "SYNCED", // PENDING, SYNCED, ERROR
    val lastModified: Long = System.currentTimeMillis(),
    val serverVersion: Long = 0
)
