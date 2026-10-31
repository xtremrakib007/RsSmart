package com.company.salesapp.data.remote.dto

// Sales app settings from the server (GET sales/app-config). Every field is
// nullable: Gson leaves missing ones null, and AppConfig fills the defaults,
// so an older or newer server never crashes the app.

data class AttendanceRulesDto(val selfieRequired: Boolean? = null, val gpsRequired: Boolean? = null)
data class NoticeDto(val text: String? = null, val level: String? = null)
data class AppUpdateDto(
    val latestVersionCode: Int? = null,
    val minVersionCode: Int? = null,
    val apkUrl: String? = null,
    val notes: String? = null
)

data class AppConfigDto(
    val features: Map<String, Boolean>? = null,
    val menuOrder: List<String>? = null,
    val attendance: AttendanceRulesDto? = null,
    val nearbyLimit: Int? = null,
    val currency: String? = null,
    val supportPhone: String? = null,
    val notice: NoticeDto? = null,
    val update: AppUpdateDto? = null,
    val updateStatus: String? = null,
    val canEditSettings: Boolean? = null
)
