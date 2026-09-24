package com.company.salesapp.data.remote.dto

data class LoginRequest(val email: String, val password: String, val tenantId: String)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserDto
)

data class UserDto(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val tenantId: String,
    val roles: List<String>
)

data class RefreshTokenRequest(val refreshToken: String)
