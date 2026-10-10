package com.retail.shared.auth

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: String,
    val tenantId: String
)

data class AuthenticatedUser(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val tenantId: String,
    val roles: List<String> = emptyList()
)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: AuthenticatedUser
)
