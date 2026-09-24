package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "customer_visits")
data class CustomerVisitEntity(
    @PrimaryKey val id: String,
    val serverId: String? = null,
    val tenantId: String,
    val customerId: String,
    val userId: String,
    val checkInAt: Long,
    val checkOutAt: Long? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val notes: String? = null,
    val photos: String = "[]",
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
