package com.retail.pos.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface PosAuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: PosLoginRequest): Response<PosApiResponse<PosLoginResponse>>
}
