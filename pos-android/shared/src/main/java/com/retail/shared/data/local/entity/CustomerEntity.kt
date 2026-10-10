package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "customers",
    indices = [Index(value = ["tenantId"]), Index(value = ["tenantId", "phone"])]
)
data class CustomerEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val name: String,
    val phone: String,
    val email: String? = null,
    val loyaltyNumber: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "PENDING"
)
