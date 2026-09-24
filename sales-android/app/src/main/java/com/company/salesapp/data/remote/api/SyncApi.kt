package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface SyncApi {
    @POST("sync/push")
    suspend fun pushEvents(@Body request: PushEventsDto): Response<ApiResponse<List<SyncEventDto>>>

    @POST("sync/pull")
    suspend fun pullEvents(@Body request: PullEventsDto): Response<ApiResponse<List<SyncEventDto>>>

    @GET("sync/status")
    suspend fun getStatus(@Query("clientId") clientId: String): Response<ApiResponse<SyncStatusDto>>

    @GET("sync/pending")
    suspend fun getPending(): Response<ApiResponse<List<SyncEventDto>>>
}
