package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.CartItem
import kotlinx.coroutines.flow.Flow

@Dao
interface CartDao {
    @Query("SELECT * FROM cart_items WHERE sessionId = :sessionId ORDER BY id ASC")
    fun getBySession(sessionId: String): Flow<List<CartItem>>

    @Query("SELECT * FROM cart_items WHERE sessionId = :sessionId")
    suspend fun getBySessionOnce(sessionId: String): List<CartItem>

    @Query("SELECT SUM(lineTotal) FROM cart_items WHERE sessionId = :sessionId")
    fun getCartTotal(sessionId: String): Flow<Double?>

    @Query("SELECT COUNT(*) FROM cart_items WHERE sessionId = :sessionId")
    fun getItemCount(sessionId: String): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: CartItem): Long

    @Update
    suspend fun update(item: CartItem)

    @Delete
    suspend fun delete(item: CartItem)

    @Query("DELETE FROM cart_items WHERE sessionId = :sessionId")
    suspend fun clearSession(sessionId: String)

    @Query("SELECT * FROM cart_items WHERE productId = :productId AND sessionId = :sessionId LIMIT 1")
    suspend fun findByProduct(sessionId: String, productId: String): CartItem?
}
