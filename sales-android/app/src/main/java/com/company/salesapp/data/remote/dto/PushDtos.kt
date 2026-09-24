package com.company.salesapp.data.remote.dto

data class RegisterDeviceRequest(
    val deviceId: String,
    val token: String,
    val platform: String = "ANDROID"
)

data class RegisterDeviceResponse(
    val id: String,
    val deviceId: String
)
