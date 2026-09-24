package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface CustomerApi {
    @GET("customers")
    suspend fun getCustomers(@Query("search") search: String? = null): Response<ApiResponse<List<CustomerDto>>>

    @POST("customers")
    suspend fun createCustomer(@Body request: CreateCustomerRequest): Response<ApiResponse<CustomerDto>>

    @PUT("customers/{id}")
    suspend fun updateCustomer(@Path("id") id: String, @Body request: CreateCustomerRequest): Response<ApiResponse<CustomerDto>>

    @POST("customers/visits")
    suspend fun recordVisit(@Body request: CustomerVisitDto): Response<ApiResponse<CustomerVisitDto>>
}
