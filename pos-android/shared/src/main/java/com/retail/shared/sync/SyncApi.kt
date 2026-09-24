package com.retail.shared.sync

import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.POST

interface SyncApi {
    @POST("/api/sync/orders")
    suspend fun pushOrder(@Body payload: String): ResponseBody

    @POST("/api/sync/payments")
    suspend fun pushPayment(@Body payload: String): ResponseBody

    @POST("/api/sync/sessions")
    suspend fun pushSession(@Body payload: String): ResponseBody
}
