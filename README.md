# Documentación Técnica — Sistema POS para Calzado

**Versión:** 1.0
**Estado:** En construcción

## Tabla de Contenido

1. [Resumen](#1-resumen)
2. [Decisiones de Diseño](#2-decisiones-de-diseño)
3. [Requisitos Funcionales](#3-requisitos-funcionales)
4. [Diagrama Entidad-Relación](#4-diagrama-entidad-relación)
5. [Diccionario de Datos](#5-diccionario-de-datos)
6. [Script DDL](#6-script-ddl)

---

## 1. Resumen

Este documento es la fuente única de verdad del modelo de datos y las reglas de negocio del sistema POS (punto de venta) para una tienda de calzado. Cubre catálogo, inventario, ventas, devoluciones, caja y seguridad.

**Convenciones del proyecto:**
- Nombres de entidades y campos en inglés (consistencia con ORM/código).
- Todo timestamp usa `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- Ningún registro con historial (ventas, movimientos de caja) se borra físicamente — siempre se desactiva (`is_active = FALSE`).

---

## 2. Decisiones de Diseño

Estas son las decisiones estructurales clave del modelo, con su justificación. Sirven como referencia rápida para entender *por qué* el esquema está armado así.

### 2.1 Catálogo en 3 niveles

El catálogo no es una tabla plana de "productos" — se modela en 3 niveles porque así se vende el calzado en la tienda:

| Nivel | Entidad | Representa | Ejemplo |
|---|---|---|---|
| 1 | `products` | Modelo/referencia general | *Air Runner 2000* |
| 2 | `product_variants` | Un color de ese modelo | *Air Runner 2000 – Negro/Rojo* |
| 3 | `product_items` | Una talla específica de ese color (la unidad física en stock) | *Air Runner 2000 – Negro/Rojo – Talla 25.5* |

`product_items` es la unidad realmente vendible: tiene `barcode` único, `stock` propio y precio propio (ver 2.2). Todo lo demás (ventas, devoluciones) referencia siempre este nivel, nunca `products` directamente.

### 2.2 Precio a nivel de talla, no de modelo

**Requisito:** en calzado infantil, el precio puede variar según la talla dentro del mismo modelo y color (una talla 24 puede costar menos que una talla 32).

**Decisión:** `purchase_price` y `sale_price` viven en `product_items` (nivel 3), no en `products` (nivel 1).

**Por qué:** si el precio se quedara en `products` con un "override" opcional por talla, cada consulta (catálogo, carrito, checkout, reportes) tendría que decidir cuál de las dos columnas usar. Al vivir el precio únicamente en `product_items`, hay una sola fuente de verdad y cero lógica condicional.

Para no complicar el caso simple (precio único, típico en calzado de adulto), se agrega el flag `products.has_size_pricing`:

- **`FALSE`** (por defecto): el admin ingresa un solo precio al crear el modelo → el backend lo copia a cada talla que se registre.
- **`TRUE`**: el admin ingresa el precio individualmente en cada talla.

Este flag es solo una ayuda para el formulario del front — no cambia cómo se lee el precio en ningún query.

### 2.3 Congelamiento de precio en cada venta

`sale_details` guarda una copia (`snapshot`) de `unit_price` y `purchase_price` al momento de la venta. Así, si el precio del producto cambia después, el historial de ventas y márgenes pasados no se altera.

### 2.4 Desactivar en vez de borrar

`users`, `products` y similares usan `is_active` en lugar de borrado físico. Esto preserva la trazabilidad de ventas, devoluciones y auditorías de caja incluso si un producto o usuario deja de estar en uso.

---

## 3. Requisitos Funcionales

### 3.1 Seguridad y Roles

- Dos roles: `ADMIN` (acceso total) y `SELLER` (checkout, carrito, devoluciones — sin ver `purchase_price` ni gestionar usuarios).
- `password_hash` almacena únicamente un hash con salt (bcrypt/argon2). Nunca se guarda ni se loguea la contraseña en texto plano.
- Los usuarios con historial de ventas no se eliminan; se desactivan con `is_active = FALSE`.

### 3.2 Catálogo e Inventario

- El toggle "¿este calzado varía precio por talla?" en el front controla `products.has_size_pricing` y determina si el formulario pide un precio único o uno por talla (ver [2.2](#22-precio-a-nivel-de-talla-no-de-modelo)).
- Las fotos se capturan **por color** (`product_variants.image_url`), vía cámara o galería. Son opcionales para permitir cargar el catálogo antes de tener las fotos.
- Cada `product_item` tiene un `barcode` único. Escanearlo debe resolver de inmediato modelo, color, talla y precio.
- El stock baja automáticamente al completar una venta. El front no debe permitir agregar al carrito más unidades de las disponibles. El stock nunca puede ser negativo.

### 3.3 Checkout y Ventas

- Subtotal de línea = `quantity * unit_price` (se calcula al vuelo, no se guarda).
- Subtotal de venta = suma de subtotales de línea. Descuento es un monto plano: `total = subtotal - discount`.
- Al procesar una venta, se congela el precio actual (`sale_price` → `unit_price`, `purchase_price` → `purchase_price`) en `sale_details`.
- Toda venta queda ligada al `user_id` del vendedor que la procesó.
- Toda venta requiere un `payment_method_id` válido y genera automáticamente un movimiento `INCOME` en caja.

### 3.4 Devoluciones y Cambios

- Una devolución nunca modifica ni borra la venta original.
- Devolver un ítem incrementa el `stock` del `product_item` correspondiente.
- Toda devolución requiere `reason` (ej. *"Cambio de talla"*, *"Defectuoso"*) y el `user_id` de quien la procesó.

### 3.5 Caja y Cierres

- `cash_movements` registra depósitos/retiros manuales (`INCOME`/`EXPENSE`) y el flujo automático de ventas, siempre atribuido a un `user_id`.
- El cierre diario se calcula filtrando `cash_movements` por rango de fecha, método de pago y, opcionalmente, por vendedor.

---

## 4. Diagrama Entidad-Relación

```
+------------------+        +------------------------+
|      ROLES       |        |         USERS          |
+------------------+        +------------------------+
| id (PK)          |<-------| role_id (FK)           |
| name (ADMIN/     |        | id (PK)                |
|       SELLER)    |        | username (UNIQUE)      |
+------------------+        | full_name              |
                            | password_hash          |
                            | is_active              |
                            | created_at             |
                            +------------------------+
                                   ^      ^      ^
                                   |      |      |    (user_id FK en las 3 tablas de abajo)
                                   |      |      |
+------------------+       +------------------------+       +-------------------------+       +----------------------------+
|    CATEGORIES    |       |        PRODUCTS        |       |     PRODUCT_VARIANTS    |       |       PRODUCT_ITEMS        |
+------------------+       |    (Nivel 1: Modelo)   |       |    (Nivel 2: Color)     |       |      (Nivel 3: Talla)      |
| id (PK)          |<------| id (PK)                |<------| id (PK)                 |<------| id (PK)                    |
| name             |       | category_id (FK)       |       | product_id (FK)         |       | product_variant_id (FK)    |
+------------------+       | name                   |       | color                   |       | size                       |
                           | has_size_pricing       |       | image_url (NULLABLE)    |       | barcode (UNIQUE)           |
                           | is_active              |       +-------------------------+       | purchase_price             |
                           +------------------------+                                         | sale_price                 |
                                                                                              | stock [CHECK >= 0]         |
                                                                                              +----------------------------+
                                                                                                            ^
                                                                                                            |
+------------------+       +------------------------+       +-------------------------+                     |
| PAYMENT_METHODS  |       |         SALES          |       |       SALE_DETAILS      |                     |
+------------------+       +------------------------+       +-------------------------+                     |
| id (PK)          |<------| id (PK)                |<------| id (PK)                 |                     |
| name             |       | user_id (FK -> USERS)  |       | sale_id (FK)            |                     |
+------------------+       | payment_method_id (FK) |       | product_item_id (FK)    |---------------------+
                           | subtotal               |       | quantity                |
                           | discount               |       | unit_price              |
                           | total                  |       | purchase_price          |
                           | created_at [INDEX]     |       +-------------------------+
                           +------------------------+                    ^
                                    ^                                    |
                                    |                                    |
+--------------------------+        |               +---------------------------+
|     CASH_MOVEMENTS       |        |               |       RETURN_DETAILS      |
+--------------------------+        |               +---------------------------+
| id (PK)                  |        |               | id (PK)                   |
| type ('INCOME'/'EXPENSE')|        |               | sale_detail_id (FK)       |
| amount                   |        |               | returned_product_item_id  |
| payment_method_id (FK)   |        |               | quantity                  |
| reason                   |        |               | reason                    |
| sale_id (FK, NULLABLE)---+--------+               | user_id (FK -> USERS)     |
| user_id (FK -> USERS)    |                        | created_at                |
| created_at [INDEX]       |                        +---------------------------+
+--------------------------+
```

---

## 5. Diccionario de Datos

### `roles`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único del rol. |
| `name` | VARCHAR(20) | NOT NULL, UNIQUE, CHECK (`ADMIN`/`SELLER`) | Nombre del rol. |

### `users`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único del usuario. |
| `role_id` | INT | FK (`roles.id`), INDEX | Rol asignado. |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Usuario de login. |
| `full_name` | VARCHAR(150) | NOT NULL | Nombre completo. |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash con salt (bcrypt/argon2). |
| `is_active` | BOOLEAN | DEFAULT TRUE | Habilita/deshabilita el login. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación. |

### `categories`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único. |
| `name` | VARCHAR(100) | NOT NULL | Nombre (ej. *Tenis, Sandalias, Botas*). |

### `products` (Nivel 1 — Modelo)
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único del modelo. |
| `category_id` | INT | FK (`categories.id`), INDEX | Categoría asociada. |
| `name` | VARCHAR(150) | NOT NULL | Nombre del modelo (ej. *Air Runner 2000*). |
| `has_size_pricing` | BOOLEAN | NOT NULL, DEFAULT FALSE | `TRUE` = precio por talla; `FALSE` = un solo precio para todas las tallas. Solo afecta el formulario, no cómo se lee el precio. |
| `is_active` | BOOLEAN | DEFAULT TRUE | Estado del modelo. |

### `product_variants` (Nivel 2 — Color)
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único de la variante. |
| `product_id` | INT | FK (`products.id`), INDEX | Modelo al que pertenece. |
| `color` | VARCHAR(50) | NOT NULL | Color (ej. *Negro/Rojo*). Único junto con `product_id`. |
| `image_url` | VARCHAR(500) | NULL | Ruta/URL de la foto de este color. |

### `product_items` (Nivel 3 — Talla)
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único del ítem físico. |
| `product_variant_id` | INT | FK (`product_variants.id`), INDEX | Variante de color asociada. |
| `size` | VARCHAR(10) | NOT NULL | Talla (ej. *25.5, 38, 9.5*). |
| `barcode` | VARCHAR(50) | UNIQUE, NOT NULL | Código de barras por talla. |
| `purchase_price` | DECIMAL(10,2) | NOT NULL, CHECK (> 0) | Costo de adquisición de esta talla. |
| `sale_price` | DECIMAL(10,2) | NOT NULL, CHECK (> 0) | Precio de venta de esta talla. Fuente única de verdad para cualquier consulta de precio. |
| `stock` | INT | NOT NULL, DEFAULT 0, CHECK (>= 0) | Cantidad disponible. |

### `payment_methods`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único. |
| `name` | VARCHAR(50) | NOT NULL | Nombre (ej. *Efectivo, Débito, Crédito, Transferencia*). |

### `sales`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | ID del ticket de venta. |
| `user_id` | INT | FK (`users.id`), INDEX | Vendedor que procesó la venta. |
| `payment_method_id` | INT | FK (`payment_methods.id`) | Método de pago principal. |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Suma bruta antes de descuento. |
| `discount` | DECIMAL(10,2) | DEFAULT 0.00 | Monto plano descontado. |
| `total` | DECIMAL(10,2) | NOT NULL | Total neto (`subtotal - discount`). |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, INDEX | Fecha/hora de la venta. |

### `sale_details`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único de línea. |
| `sale_id` | INT | FK (`sales.id`), INDEX | Venta asociada. |
| `product_item_id` | INT | FK (`product_items.id`), INDEX | Talla específica vendida. |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Unidades vendidas. |
| `unit_price` | DECIMAL(10,2) | NOT NULL | Precio de venta congelado al momento de la transacción. |
| `purchase_price` | DECIMAL(10,2) | NOT NULL | Costo congelado al momento de la transacción (para calcular margen). |

### `return_details`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único de la devolución. |
| `sale_detail_id` | INT | FK (`sale_details.id`), INDEX | Línea de venta original. |
| `returned_product_item_id` | INT | FK (`product_items.id`), INDEX | Ítem físico que reingresa a stock. |
| `user_id` | INT | FK (`users.id`), INDEX | Quien procesó la devolución. |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Unidades devueltas. |
| `reason` | VARCHAR(255) | NOT NULL | Motivo de la devolución/cambio. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha/hora de la devolución. |

### `cash_movements`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INT | PK, Auto Increment | Identificador único del movimiento. |
| `type` | VARCHAR(10) | NOT NULL, CHECK (`INCOME`/`EXPENSE`) | Dirección del flujo. |
| `amount` | DECIMAL(10,2) | NOT NULL | Monto del movimiento. |
| `payment_method_id` | INT | FK (`payment_methods.id`), INDEX | Canal de pago. |
| `user_id` | INT | FK (`users.id`), INDEX | Quien registró el movimiento. |
| `reason` | VARCHAR(255) | NOT NULL | Descripción (ej. *Venta #1002*, *Reembolso*). |
| `sale_id` | INT | NULLABLE, FK (`sales.id`), INDEX | Venta asociada, si aplica. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, INDEX | Fecha/hora del movimiento. |

---

## 6. Script DDL

```sql
-- Seguridad y Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT chk_role_name CHECK (name IN ('ADMIN', 'SELLER'))
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Categorías y Catálogo (3 niveles)
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    has_size_pricing BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    color VARCHAR(50) NOT NULL,
    image_url VARCHAR(500) NULL,
    CONSTRAINT uq_product_color UNIQUE (product_id, color),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE product_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_variant_id INT NOT NULL,
    size VARCHAR(10) NOT NULL,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_stock_non_negative CHECK (stock >= 0),
    CONSTRAINT chk_item_purchase_price_positive CHECK (purchase_price > 0),
    CONSTRAINT chk_item_sale_price_positive CHECK (sale_price > 0),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

-- Ventas y Métodos de Pago
CREATE TABLE payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    payment_method_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE TABLE sale_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_item_id) REFERENCES product_items(id)
);

-- Devoluciones y Movimientos de Caja
CREATE TABLE return_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_detail_id INT NOT NULL,
    returned_product_item_id INT NOT NULL,
    user_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_detail_id) REFERENCES sale_details(id),
    FOREIGN KEY (returned_product_item_id) REFERENCES product_items(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE cash_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    amount DECIMAL(10,2) NOT NULL,
    payment_method_id INT NOT NULL,
    user_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    sale_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

-- Índices de rendimiento
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_items_variant ON product_items(product_variant_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sale_details_sale ON sale_details(sale_id);
CREATE INDEX idx_sale_details_item ON sale_details(product_item_id);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);
CREATE INDEX idx_cash_movements_pm ON cash_movements(payment_method_id);
CREATE INDEX idx_cash_movements_user ON cash_movements(user_id);
CREATE INDEX idx_return_details_sale_detail ON return_details(sale_detail_id);
CREATE INDEX idx_return_details_user ON return_details(user_id);
```
