package com.company.salesapp.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val Context.authDataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

/**
 * Owns the single DataStore instance backing auth state. Split out of
 * AuthRepository specifically so AuthInterceptor can read the current token
 * without depending on AuthRepository (which depends on AuthApi -> Retrofit
 * -> OkHttpClient -> AuthInterceptor — a cycle Hilt can't resolve).
 */
@Singleton
class TokenProvider @Inject constructor(@ApplicationContext context: Context) {
    private val dataStore = context.authDataStore

    companion object {
        val TOKEN_KEY = stringPreferencesKey("access_token")
        val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
        val USER_ID_KEY = stringPreferencesKey("user_id")
        val TENANT_ID_KEY = stringPreferencesKey("tenant_id")
        val USER_NAME_KEY = stringPreferencesKey("user_name")
        val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        val USER_ROLES_KEY = stringSetPreferencesKey("user_roles")
    }

    val isLoggedIn: Flow<Boolean> = dataStore.data.map { !it[TOKEN_KEY].isNullOrEmpty() }
    val token: Flow<String?> = dataStore.data.map { it[TOKEN_KEY] }
    val refreshToken: Flow<String?> = dataStore.data.map { it[REFRESH_TOKEN_KEY] }
    val tenantId: Flow<String?> = dataStore.data.map { it[TENANT_ID_KEY] }
    val userId: Flow<String?> = dataStore.data.map { it[USER_ID_KEY] }

    /** Synchronous read for use inside OkHttp's synchronous Interceptor.intercept(). */
    fun currentTokenBlocking(): String? = runBlocking { token.first() }

    suspend fun save(
        accessToken: String,
        refreshToken: String,
        userId: String,
        tenantId: String,
        userName: String,
        userEmail: String,
        userRoles: Set<String>,
    ) {
        dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = accessToken
            prefs[REFRESH_TOKEN_KEY] = refreshToken
            prefs[USER_ID_KEY] = userId
            prefs[TENANT_ID_KEY] = tenantId
            prefs[USER_NAME_KEY] = userName
            prefs[USER_EMAIL_KEY] = userEmail
            prefs[USER_ROLES_KEY] = userRoles
        }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }
}
