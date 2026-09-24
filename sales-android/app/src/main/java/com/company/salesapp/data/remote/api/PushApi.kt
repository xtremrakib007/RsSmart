package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.ApiResponse
import com.company.salesapp.data.remote.dto.RegisterDeviceRequest
import com.company.salesapp.data.remote.dto.RegisterDeviceResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.HTTP
import retrofit2.http.POST

interface PushApi {
    @POST("push/devices")
    suspend fun registerDevice(@Body request: RegisterDeviceRequest): Response<ApiResponse<RegisterDeviceResponse>>

    @HTTP(method = "DELETE", path = "push/devices", hasBody = true)
    suspend fun unregisterDevice(@Body request: UnregisterDeviceRequest): Response<ApiResponse<Any>>
}

data class UnregisterDeviceRequest(val deviceId: String)
