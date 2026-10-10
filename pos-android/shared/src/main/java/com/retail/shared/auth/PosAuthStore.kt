package com.retail.shared.auth

import android.content.Context
import android.provider.Settings
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val Context.posAuthDataStore: DataStore<Preferences> by preferencesDataStore(name = "pos_session_prefs")

/** One shared store for cashier identity, bearer token, and active till session. */
@Singleton
class PosAuthStore @Inject constructor(@ApplicationContext context: Context) {
    private val dataStore = context.posAuthDataStore
    val deviceId: String = "${android.os.Build.MODEL}_${Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)}"

    companion object {
        private val TENANT_ID_KEY = stringPreferencesKey("tenant_id")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
        private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        private val ACTIVE_SESSION_ID_KEY = stringPreferencesKey("active_session_id")
    }

    val tenantId: Flow<String> = dataStore.data.map { it[TENANT_ID_KEY].orEmpty() }
    val userId: Flow<String> = dataStore.data.map { it[USER_ID_KEY].orEmpty() }
    val accessToken: Flow<String?> = dataStore.data.map { it[ACCESS_TOKEN_KEY] }
    val isAuthenticated: Flow<Boolean> = dataStore.data.map {
        !it[ACCESS_TOKEN_KEY].isNullOrBlank() &&
            !it[TENANT_ID_KEY].isNullOrBlank() &&
            !it[USER_ID_KEY].isNullOrBlank()
    }
    val activeSessionId: Flow<String?> = dataStore.data.map { it[ACTIVE_SESSION_ID_KEY] }

    fun accessTokenBlocking(): String? = runBlocking { accessToken.first() }
    fun tenantIdBlocking(): String = runBlocking { tenantId.first() }
    fun userIdBlocking(): String = runBlocking { userId.first() }
    fun activeSessionIdBlocking(): String? = runBlocking { activeSessionId.first() }

    suspend fun setIdentity(tenantId: String, userId: String, accessToken: String) {
        dataStore.edit { prefs ->
            prefs[TENANT_ID_KEY] = tenantId
            prefs[USER_ID_KEY] = userId
            prefs[ACCESS_TOKEN_KEY] = accessToken
        }
    }

    suspend fun clearIdentity() {
        dataStore.edit { prefs ->
            prefs.remove(TENANT_ID_KEY)
            prefs.remove(USER_ID_KEY)
            prefs.remove(ACCESS_TOKEN_KEY)
            prefs.remove(ACTIVE_SESSION_ID_KEY)
        }
    }

    suspend fun setActiveSession(sessionId: String) {
        dataStore.edit { prefs -> prefs[ACTIVE_SESSION_ID_KEY] = sessionId }
    }

    suspend fun clearActiveSession() {
        dataStore.edit { prefs -> prefs.remove(ACTIVE_SESSION_ID_KEY) }
    }
}
