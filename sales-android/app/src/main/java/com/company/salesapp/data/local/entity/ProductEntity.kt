package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val sku: String,
    val name: String,
    val barcode: String? = null,
    val basePrice: Double,
    val costPrice: Double? = null,
    val taxRate: Double = 0.0,
    val isActive: Boolean = true,
    val trackInventory: Boolean = true,
    val categoryId: String? = null,
    val unitId: String? = null,
    val lastSyncedAt: Long = 0
)
