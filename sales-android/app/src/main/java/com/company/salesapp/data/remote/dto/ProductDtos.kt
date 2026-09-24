package com.company.salesapp.data.remote.dto

data class ProductDto(
    val id: String,
    val sku: String,
    val name: String,
    val barcode: String? = null,
    val basePrice: Double,
    val costPrice: Double? = null,
    val taxRate: Double = 0.0,
    val isActive: Boolean = true,
    val trackInventory: Boolean = true,
    val categoryId: String? = null,
    val unitId: String? = null
)
