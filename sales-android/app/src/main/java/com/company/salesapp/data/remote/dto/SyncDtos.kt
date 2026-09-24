package com.company.salesapp.data.remote.dto

data class PushEventsDto(val clientId: String, val events: List<SyncEventDto>)

data class PullEventsDto(
    val clientId: String,
    val lastSyncAt: String,
    val entities: List<String>? = null,
    val deltaOnly: Boolean? = null
)

data class SyncEventDto(
    val eventId: String,
    val entityType: String,
    val entityId: String,
    val action: String,
    val payload: Map<String, Any>,
    val vectorClock: Map<String, Int>? = null,
    val isDelta: Boolean? = null
)

data class SyncStatusDto(
    val clientId: String,
    val lastSyncAt: String?,
    val pendingEvents: Int,
    val failedEvents: Int,
    val isHealthy: Boolean
)
