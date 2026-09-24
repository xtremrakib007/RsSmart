package com.retail.shared.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "offline_queue",
    indices = [Index(value = ["status"]), Index(value = ["priority", "createdAt"])]
)
data class OfflineQueueItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val entityType: String, // ORDER, PAYMENT, SESSION, etc.
    val entityId: String,
    val action: String, // CREATE, UPDATE, DELETE
    val payload: String, // JSON payload
    val priority: Int = 5, // 1 = highest
    val retryCount: Int = 0,
    val maxRetries: Int = 5,
    val status: String = "PENDING", // PENDING, PROCESSING, FAILED, COMPLETED
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val lastAttempt: Long? = null
)
