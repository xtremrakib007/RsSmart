package com.company.salesapp.data.remote

import com.company.salesapp.data.repository.TokenProvider
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenProvider: TokenProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        // Login/refresh calls have no token yet — currentTokenBlocking()
        // returns null before login, so the header is simply omitted for
        // those; no need for a URL-based exclusion list.
        val token = tokenProvider.currentTokenBlocking()
        val request = if (token.isNullOrEmpty()) {
            original
        } else {
            original.newBuilder().addHeader("Authorization", "Bearer $token").build()
        }
        return chain.proceed(request)
    }
}
