package com.retail.shared.di

import android.content.Context
import androidx.room.Room
import com.retail.shared.data.local.database.RetailDatabase
import com.retail.shared.auth.AuthApi
import com.retail.shared.auth.AuthSessionStore
import com.retail.shared.BuildConfig
import com.retail.shared.sync.SyncApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SharedModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): RetailDatabase {
        return Room.databaseBuilder(
            context,
            RetailDatabase::class.java,
            "retail_database"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideProductDao(db: RetailDatabase) = db.productDao()
    @Provides
    fun provideCartDao(db: RetailDatabase) = db.cartDao()
    @Provides
    fun provideSessionDao(db: RetailDatabase) = db.sessionDao()
    @Provides
    fun provideOrderDao(db: RetailDatabase) = db.orderDao()
    @Provides
    fun provideOfflineQueueDao(db: RetailDatabase) = db.offlineQueueDao()
    @Provides
    fun providePaymentDao(db: RetailDatabase) = db.paymentDao()

    @Provides
    @Singleton
    fun provideOkHttpClient(authSessionStore: AuthSessionStore): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            // Never log request bodies: login payloads contain passwords.
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val original = chain.request()
                val token = authSessionStore.accessTokenBlocking()
                val request = if (!token.isNullOrBlank() &&
                    !original.url.encodedPath.endsWith("/api/auth/login")) {
                    original.newBuilder().header("Authorization", "Bearer $token").build()
                } else {
                    original
                }
                chain.proceed(request)
            }
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        val baseUrl = BuildConfig.API_BASE_URL.let {
            if (it.endsWith("/")) it else "$it/"
        }
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideSyncApi(retrofit: Retrofit): SyncApi = retrofit.create(SyncApi::class.java)

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
}
