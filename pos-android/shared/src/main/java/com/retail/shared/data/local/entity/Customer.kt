package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "customers",
    indices = [
        Index(value = ["tenantId", "phone"], unique = true),
        Index(value = ["tenantId", "name"])
    ]
)
data class Customer(
    @PrimaryKey val id: String,
    val tenantId: String,
    val name: String,
    val phone: String,
    val email: String? = null,
    val loyaltyNumber: String? = null,
    val notes: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isActive: Boolean = true,
    val syncStatus: String = "PENDING"
)
