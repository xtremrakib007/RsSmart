package com.retail.pos.di

import com.retail.pos.BuildConfig
import com.retail.pos.data.remote.PosAuthApi
import com.retail.pos.data.remote.PosAuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object PosAuthModule {
    @Provides @Singleton
    fun provideAuthHttpClient(interceptor: PosAuthInterceptor): OkHttpClient =
        OkHttpClient.Builder().addInterceptor(interceptor).build()

    @Provides @Singleton
    fun provideAuthRetrofit(client: OkHttpClient): Retrofit {
        val baseUrl = BuildConfig.API_BASE_URL.let { if (it.endsWith("/")) it else "$it/" }
        return Retrofit.Builder().baseUrl(baseUrl).client(client)
            .addConverterFactory(GsonConverterFactory.create()).build()
    }

    @Provides @Singleton
    fun providePosAuthApi(retrofit: Retrofit): PosAuthApi = retrofit.create(PosAuthApi::class.java)
}
