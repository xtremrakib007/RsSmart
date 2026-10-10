package com.retail.pos.session

import com.retail.shared.auth.PosAuthStore
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/** POS-facing wrapper around the shared auth/session store. */
@Singleton
class PosSessionProvider @Inject constructor(private val store: PosAuthStore) {
    val deviceId: String = store.deviceId
    val tenantId: Flow<String> = store.tenantId
    val userId: Flow<String> = store.userId
    val accessToken: Flow<String?> = store.accessToken
    val isAuthenticated: Flow<Boolean> = store.isAuthenticated
    val activeSessionId: Flow<String?> = store.activeSessionId

    fun tenantIdBlocking(): String = store.tenantIdBlocking()
    fun userIdBlocking(): String = store.userIdBlocking()
    fun activeSessionIdBlocking(): String? = store.activeSessionIdBlocking()

    suspend fun setIdentity(tenantId: String, userId: String, accessToken: String) =
        store.setIdentity(tenantId, userId, accessToken)

    suspend fun clearIdentity() = store.clearIdentity()
    suspend fun setActiveSession(sessionId: String) = store.setActiveSession(sessionId)
    suspend fun clearActiveSession() = store.clearActiveSession()
}
