package com.retail.pos.auth

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

data class PosLoginRequest(val email: String, val password: String, val tenantId: String)
data class PosApiEnvelope<T>(val success: Boolean, val statusCode: Int? = null, val data: T? = null)
data class PosLoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: PosUserDto
)
data class PosUserDto(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val tenantId: String,
    val roles: List<String> = emptyList()
)

interface PosAuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: PosLoginRequest): Response<PosApiEnvelope<PosLoginResponse>>
}
