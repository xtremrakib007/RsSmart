package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface OrderApi {
    @GET("orders")
    suspend fun getOrders(
        @Query("status") status: String? = null,
        @Query("fromDate") fromDate: String? = null,
        @Query("toDate") toDate: String? = null
    ): Response<ApiResponse<List<OrderDto>>>

    @POST("orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<ApiResponse<OrderDto>>

    @POST("orders/{id}/payments")
    suspend fun addPayment(@Path("id") id: String, @Body payment: PaymentDto): Response<ApiResponse<PaymentDto>>
}
