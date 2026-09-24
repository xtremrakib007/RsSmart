package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.http.Path

interface ProductApi {
    @GET("products")
    suspend fun getProducts(@Query("search") search: String? = null): Response<ApiResponse<List<ProductDto>>>

    @GET("products/barcode/{barcode}")
    suspend fun getByBarcode(@Path("barcode") barcode: String): Response<ApiResponse<ProductDto>>
}
