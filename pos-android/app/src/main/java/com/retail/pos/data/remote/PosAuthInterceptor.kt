package com.retail.pos.data.remote

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PosAuthInterceptor @Inject constructor(private val authStore: PosAuthStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = authStore.currentTokenBlocking()
        val authenticated = if (token.isNullOrBlank()) request else
            request.newBuilder().header("Authorization", "Bearer $token").build()
        return chain.proceed(authenticated)
    }
}
