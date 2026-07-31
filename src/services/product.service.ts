import { pool } from "../db/pool";
import { redisClient } from "../redis/client";
import {
  Product,
  ProductRow,
  CreateProductInput,
  UpdateProductInput,
} from "../types/product";

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    stock: row.stock,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const PRODUCTS_ALL_CACHE_KEY = "products:all";
const PRODUCTS_CACHE_TTL_SECONDS = 60;

function getProductCacheKey(productId: number): string {
  return `products:id:${productId}`;
}

export async function fetchAllProductsFromDatabase(filters: {
  category?: string;
  search?: string;
}): Promise<Product[]> {
  let query = "SELECT * FROM products WHERE 1=1";
  const values: string[] = [];

  if (filters.category) {
    values.push(filters.category);
    query += ` AND LOWER(category) = LOWER($${values.length})`;
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    query += ` AND (LOWER(name) LIKE LOWER($${values.length}) OR LOWER(description) LIKE LOWER($${values.length}))`;
  }

  query += " ORDER BY id ASC";

  const result = await pool.query<ProductRow>(query, values);
  return result.rows.map(mapProductRow);
}

export async function getAllProducts(filters: {
  category?: string;
  search?: string;
}): Promise<Product[]> {
  const hasFilters = Boolean(filters?.category || filters?.search);

  // every filter combination need a separate cache
  // products:all:search:keyboard
  // products:all:category:accessories

  if (hasFilters) {
    console.log("cache bypass: filtered product list");
    return fetchAllProductsFromDatabase(filters);
  }

  // Redis is not the source of truth here
  const cachedProducts = await redisClient.get(PRODUCTS_ALL_CACHE_KEY);

  if (cachedProducts) {
    console.log("Cache HIT: products:all");
    return JSON.parse(cachedProducts) as Product[];
  }
  console.log("Cache MISS: products:all");
  const products = await fetchAllProductsFromDatabase(filters);

  // set out actual products data in redis cache
  await redisClient.setEx(
    PRODUCTS_ALL_CACHE_KEY,
    PRODUCTS_CACHE_TTL_SECONDS,
    JSON.stringify(products),
  );

  console.log("Cache SET: products:all");

  return products;
}

export async function fetchSingleProductFromDatabase(
  id: number,
): Promise<Product | null> {
  const result = await pool.query<ProductRow>(
    "SELECT * FROM products WHERE id = $1",
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapProductRow(result.rows[0]);
}

export async function getProductById(id: number): Promise<Product | null> {
  const cacheKey = getProductCacheKey(id);

  const cachedProduct = await redisClient.get(cacheKey);

  if (cachedProduct) {
    console.log("Cache HIT: ", cacheKey);

    return JSON.parse(cachedProduct) as Product;
  }

  console.log("Cache MISS: ", cacheKey);
  const product = await fetchSingleProductFromDatabase(id);

  if (!product) {
    return null;
  }
  await redisClient.setEx(
    cacheKey,
    PRODUCTS_CACHE_TTL_SECONDS,
    JSON.stringify(product),
  );
  console.log("Cache SET: ", cacheKey);

  return product;
}

async function deleteProductsAllCache(): Promise<void> {
  await redisClient.del(PRODUCTS_ALL_CACHE_KEY);
  console.log("Cache delete: products:all");
}

async function deleteSingleProdcutCache(productId: number): Promise<void> {
  const cacheKey = getProductCacheKey(productId);
  await redisClient.del(cacheKey);
  console.log("Cache delete: ", cacheKey);
  
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const result = await pool.query<ProductRow>(
    `INSERT INTO products (name, description, price, category, stock)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.description, input.price, input.category, input.stock],
  );

  const newlyCreatedProduct = mapProductRow(result.rows[0]);

  await deleteProductsAllCache();

  return newlyCreatedProduct;
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product | null> {
  const existing = await getProductById(id);
  if (!existing) {
    return null;
  }

  const name = input.name ?? existing.name;
  const description = input.description ?? existing.description;
  const price = input.price ?? existing.price;
  const category = input.category ?? existing.category;
  const stock = input.stock ?? existing.stock;

  const result = await pool.query<ProductRow>(
    `UPDATE products
     SET name = $1,
         description = $2,
         price = $3,
         category = $4,
         stock = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [name, description, price, category, stock, id],
  );

  const updatedProduct = mapProductRow(result.rows[0]);
  
  await deleteSingleProdcutCache(id);
  await deleteProductsAllCache();

  return updatedProduct;
}
