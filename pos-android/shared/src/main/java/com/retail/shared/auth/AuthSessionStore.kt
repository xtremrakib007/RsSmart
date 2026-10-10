package com.retail.shared.auth

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

private val Context.authTokenDataStore: DataStore<Preferences> by
    preferencesDataStore(name = "rssmart_auth_tokens")

@Singleton
class AuthSessionStore @Inject constructor(
    @ApplicationContext context: Context
) {
    private val store = context.authTokenDataStore

    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
    }

    val accessToken: Flow<String?> = store.data.map { it[ACCESS_TOKEN] }

    fun accessTokenBlocking(): String? = runBlocking { accessToken.first() }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        store.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun clear() {
        store.edit { prefs ->
            prefs.remove(ACCESS_TOKEN)
            prefs.remove(REFRESH_TOKEN)
        }
    }
}
