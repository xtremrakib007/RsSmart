package com.retail.pos.data.remote

data class PosApiResponse<T>(
    val success: Boolean = false,
    val statusCode: Int = 0,
    val data: T? = null,
    val timestamp: String? = null
)

data class PosLoginRequest(val email: String, val password: String, val tenantId: String)
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
