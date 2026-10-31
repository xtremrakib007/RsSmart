package com.company.salesapp.data.repository

import android.content.Context
import com.company.salesapp.BuildConfig
import com.company.salesapp.data.remote.api.SalesApi
import com.company.salesapp.data.remote.dto.AppConfigDto
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Dashboard tiles, in their default order. The server can hide or reorder them. */
val DEFAULT_MENU = listOf("attendance", "today", "nearby", "team", "customers", "orders", "visits", "collections", "expenses", "sync")

/** Sales app settings with defaults filled in; what the screens read. */
data class AppConfig(
    val menu: List<String> = DEFAULT_MENU.filter { it != "team" },
    val selfieRequired: Boolean = false,
    val gpsRequired: Boolean = false,
    val currency: String = "RM",
    val supportPhone: String = "",
    val noticeText: String = "",
    val noticeLevel: String = "info",
    val updateStatus: String = "NONE", // NONE, AVAILABLE, REQUIRED
    val apkUrl: String = "",
    val updateNotes: String = "",
    val canEditSettings: Boolean = false,
    val raw: AppConfigDto = AppConfigDto()
) {
    companion object {
        fun from(d: AppConfigDto): AppConfig {
            val features = d.features.orEmpty()
            val order = (d.menuOrder ?: DEFAULT_MENU).filter { it in DEFAULT_MENU }
            return AppConfig(
                // A tile shows when the server lists it and has not switched it off.
                menu = order.filter { features[it] != false },
                selfieRequired = d.attendance?.selfieRequired ?: false,
                gpsRequired = d.attendance?.gpsRequired ?: false,
                currency = d.currency?.takeIf { it.isNotBlank() } ?: "RM",
                supportPhone = d.supportPhone.orEmpty(),
                noticeText = d.notice?.text.orEmpty(),
                noticeLevel = d.notice?.level ?: "info",
                updateStatus = d.updateStatus ?: "NONE",
                apkUrl = d.update?.apkUrl.orEmpty(),
                updateNotes = d.update?.notes.orEmpty(),
                canEditSettings = d.canEditSettings ?: false,
                raw = d
            )
        }
    }
}

/**
 * Loads the settings from the server and keeps the last copy on the phone,
 * so the app starts with them even offline. Changing them on the server
 * changes the app on its next start or refresh, without a new APK.
 */
@Singleton
class AppConfigRepository @Inject constructor(
    @ApplicationContext context: Context,
    private val api: SalesApi
) {
    private val prefs = context.getSharedPreferences("app_config", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val _config = MutableStateFlow(load())
    val config: StateFlow<AppConfig> = _config.asStateFlow()

    private fun load(): AppConfig = runCatching {
        prefs.getString(KEY, null)?.let { AppConfig.from(gson.fromJson(it, AppConfigDto::class.java)) }
    }.getOrNull() ?: AppConfig()

    suspend fun refresh(): Result<AppConfig> = runCatching {
        val r = api.appConfig(BuildConfig.VERSION_CODE)
        val body = r.body()
        if (!r.isSuccessful || body?.success != true) error("Could not load the app settings")
        prefs.edit().putString(KEY, gson.toJson(body.data)).apply()
        AppConfig.from(body.data).also { _config.value = it }
    }

    /** Admin only: saves a change on the server, then reloads. */
    suspend fun update(patch: Map<String, Any?>): Result<AppConfig> = runCatching {
        val r = api.updateAppConfig(patch)
        if (!r.isSuccessful || r.body()?.success != true) {
            val body = runCatching { r.errorBody()?.string() }.getOrNull().orEmpty()
            error(Regex("\"message\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1) ?: "Could not save the settings")
        }
        refresh().getOrThrow()
    }

    fun clear() { prefs.edit().remove(KEY).apply(); _config.value = AppConfig() }

    private companion object { const val KEY = "config_json" }
}
