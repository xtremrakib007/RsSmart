package com.company.salesapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_events")
data class SyncEventEntity(
    @PrimaryKey val eventId: String,
    val clientId: String,
    val timestamp: Long,
    val entityType: String,
    val entityId: String,
    val action: String,
    val payload: String,
    val vectorClock: String,
    val status: String = "PENDING",
    val retryCount: Int = 0,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
