package com.retail.shared.data.local.dao

import androidx.room.*
import com.retail.shared.data.local.entity.Product
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {
    @Query("SELECT * FROM products WHERE isActive = 1 AND tenantId = :tenantId ORDER BY name ASC")
    fun getAllActive(tenantId: String): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE id = :id")
    suspend fun getById(id: String): Product?

    @Query("SELECT * FROM products WHERE barcode = :barcode LIMIT 1")
    suspend fun getByBarcode(barcode: String): Product?

    @Query("SELECT * FROM products WHERE sku = :sku LIMIT 1")
    suspend fun getBySku(sku: String): Product?

    @Query("""
        SELECT * FROM products 
        WHERE isActive = 1 AND tenantId = :tenantId 
        AND (name LIKE '%' || :query || '%' OR sku LIKE '%' || :query || '%' OR barcode LIKE '%' || :query || '%')
        ORDER BY name ASC
    """)
    fun search(tenantId: String, query: String): Flow<List<Product>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(products: List<Product>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(product: Product)

    @Update
    suspend fun update(product: Product)

    @Delete
    suspend fun delete(product: Product)

    @Query("DELETE FROM products WHERE tenantId = :tenantId")
    suspend fun clearByTenant(tenantId: String)

    @Query("SELECT COUNT(*) FROM products WHERE tenantId = :tenantId")
    suspend fun countByTenant(tenantId: String): Int

    @Query("SELECT * FROM products WHERE syncStatus = 'PENDING' AND tenantId = :tenantId")
    suspend fun getPendingSync(tenantId: String): List<Product>
}
