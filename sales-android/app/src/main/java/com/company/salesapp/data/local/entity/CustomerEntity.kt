package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "customers")
data class CustomerEntity(
    @PrimaryKey val id: String,
    val serverId: String? = null,
    val tenantId: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val creditLimit: Double? = null,
    val balance: Double = 0.0,
    val category: String? = null,
    val isActive: Boolean = true,
    val isSynced: Boolean = false,
    val lastModified: Long = System.currentTimeMillis(),
    val version: Int = 1
)
