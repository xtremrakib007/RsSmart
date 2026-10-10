package com.retail.pos.session

import android.content.Context
import android.provider.Settings
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val Context.posSessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "pos_session_prefs")

/**
 * Single source of truth for "who/what this device is" and "what POS session is
 * currently open". Replaces the hardcoded device-001/user-001/tenant-1/session-active
 * placeholders that used to be scattered across SessionViewModel, CartViewModel and
 * CheckoutViewModel.
 *
 * - deviceId is derived once from ANDROID_ID (stable per app-install per device).
 * - tenantId/userId are set at login/provisioning time (see setIdentity).
 * - activeSessionId tracks the currently open POS session (set on open, cleared on close)
 *   so every screen/ViewModel reads the same value instead of each hardcoding its own.
 */
@Singleton
class PosSessionProvider @Inject constructor(@ApplicationContext context: Context) {

    private val dataStore = context.posSessionDataStore

    val deviceId: String =
        "${android.os.Build.MODEL}_${Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)}"

    companion object {
        private val TENANT_ID_KEY = stringPreferencesKey("tenant_id")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
        private val ACTIVE_SESSION_ID_KEY = stringPreferencesKey("active_session_id")

    }

    val tenantId: Flow<String> = dataStore.data.map { it[TENANT_ID_KEY] ?: "" }
    val userId: Flow<String> = dataStore.data.map { it[USER_ID_KEY] ?: "" }
    val activeSessionId: Flow<String?> = dataStore.data.map { it[ACTIVE_SESSION_ID_KEY] }

    fun tenantIdBlocking(): String = runBlocking { tenantId.first() }
    fun userIdBlocking(): String = runBlocking { userId.first() }
    fun activeSessionIdBlocking(): String? = runBlocking { activeSessionId.first() }

    suspend fun setIdentity(tenantId: String, userId: String) {
        dataStore.edit { prefs ->
            prefs[TENANT_ID_KEY] = tenantId
            prefs[USER_ID_KEY] = userId
        }
    }

    suspend fun setActiveSession(sessionId: String) {
        dataStore.edit { prefs -> prefs[ACTIVE_SESSION_ID_KEY] = sessionId }
    }

    suspend fun clearActiveSession() {
        dataStore.edit { prefs -> prefs.remove(ACTIVE_SESSION_ID_KEY) }
    }
}
