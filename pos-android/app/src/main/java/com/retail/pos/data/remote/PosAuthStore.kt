package com.retail.pos.data.remote

import android.content.Context
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

private val Context.posAuthDataStore: DataStore<Preferences> by preferencesDataStore(name = "pos_auth")

@Singleton
class PosAuthStore @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.posAuthDataStore
    private val tokenKey = stringPreferencesKey("access_token")
    private val refreshKey = stringPreferencesKey("refresh_token")
    private val tenantKey = stringPreferencesKey("tenant_id")
    private val userKey = stringPreferencesKey("user_id")
    private val emailKey = stringPreferencesKey("email")
    val isLoggedIn: Flow<Boolean> = store.data.map { !it[tokenKey].isNullOrBlank() }
    fun currentTokenBlocking(): String? = runBlocking { store.data.map { it[tokenKey] }.first() }

    suspend fun save(response: PosLoginResponse) {
        store.edit {
            it[tokenKey] = response.accessToken
            it[refreshKey] = response.refreshToken
            it[tenantKey] = response.user.tenantId
            it[userKey] = response.user.id
            it[emailKey] = response.user.email
        }
    }

    suspend fun clear() { store.edit { it.clear() } }
}
