package com.retail.pos.session

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Stores API credentials in Android Keystore-backed encrypted preferences. */
@Singleton
class PosAuthStore @Inject constructor(
    @ApplicationContext context: Context
) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "rssmart_pos_auth",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun isLoggedIn(): Boolean = !preferences.getString(KEY_ACCESS_TOKEN, null).isNullOrBlank()
    fun accessToken(): String? = preferences.getString(KEY_ACCESS_TOKEN, null)
    fun refreshToken(): String? = preferences.getString(KEY_REFRESH_TOKEN, null)
    fun apiBaseUrl(): String = preferences.getString(KEY_API_BASE_URL, "") ?: ""

    fun saveSession(apiBaseUrl: String, accessToken: String, refreshToken: String) {
        preferences.edit()
            .putString(KEY_API_BASE_URL, apiBaseUrl.trim().trimEnd('/') + "/")
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    private companion object {
        const val KEY_API_BASE_URL = "api_base_url"
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
    }
}
