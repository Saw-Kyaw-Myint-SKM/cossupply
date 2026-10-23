# CoSupply API Documentation

Backend: Laravel 12 REST API (this `laravel-api` directory is the project backend).

## Conventions

- Base URL: `http://localhost:8000` (local development).
- API prefix: `/api/v1` (configured in `bootstrap/app.php` as `apiPrefix: 'api/v1'`).
- Authentication: Laravel Sanctum bearer tokens. `Authorization: Bearer <token>`.
- Token abilities: `admin` (Admin account) and `customer` (Customer account).
- Success envelope: `{"success": true, "data": {...}, "message": "..."}` (`message` optional).
- Endpoints without an authentication row are public: they accept no token and serve guest browsing (`/health`, `/auth/*`, `/admin/login`, `/products`, `/products/{productId}`, `/categories`, `/suppliers`).
- Error envelope for application errors: `{"success": false, "message": "..."}`.
- Validation errors use Laravel's default 422 shape: `{"message": "...", "errors": {"field": ["..."]}}`.
- All money values are integer Myanmar Kyat (MMK). All new-domain status values are UPPERCASE strings.

---

## GET /api/v1/admin/settings

### Task

Task 03 — Database, Statuses, and Master Settings.

### Specification

- `specification/DatabaseFlow.md` §3 (`settings`), §5 (indexes)
- `specification/StatusDefinitions.md` (master settings are operational configuration; no statuses involved)
- `specification/ImplementationNotes.md` (master settings screen)

### Method

`GET`

### Path

`/api/v1/admin/settings`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "settings": [
      {
        "key": "company_name",
        "value": "CoSupply",
        "value_type": "string",
        "group_name": "company",
        "label": "Company Name",
        "description": "Displayed on quotations, orders, and receipts.",
        "is_public": true,
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      {
        "key": "quotation_validity_days",
        "value": 7,
        "value_type": "integer",
        "group_name": "quotation",
        "label": "Quotation Validity (Days)",
        "description": "Default number of days a sent quotation stays valid.",
        "is_public": false,
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      {
        "key": "require_receipt_number",
        "value": true,
        "value_type": "boolean",
        "group_name": "payment",
        "label": "Require Receipt Number",
        "description": "Cash collection must record a receipt number.",
        "is_public": false,
        "updated_at": "2026-10-17T05:40:36+00:00"
      }
    ]
  }
}
```

Notes:

- `value` is returned typed according to `value_type` (`string`, `integer`, or `boolean`).
- Settings are ordered by `group_name` then `key`.
- 15 documented keys are seeded by `SettingSeeder` (`company_name`, `company_phone`, `company_email`, `company_address`, `default_currency`, `timezone`, `quotation_number_prefix`, `quotation_validity_days`, `quotation_service_fee_percentage`, `order_number_prefix`, `default_delivery_fee`, `delivery_fee_mode`, `payment_method`, `require_full_payment`, `require_receipt_number`).

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |

---

## PUT /api/v1/admin/settings/{key}

### Task

Task 03 — Database, Statuses, and Master Settings.

### Specification

- `specification/DatabaseFlow.md` §3 (`settings`), §4 (audit of changes)
- `specification/MoneyAndValidationRules.md` §3 (service fee percentage rules)
- `specification/StatusDefinitions.md` (allowed enum-like setting values)

### Method

`PUT`

### Path

`/api/v1/admin/settings/{key}` — `{key}` is the setting key, e.g. `/api/v1/admin/settings/quotation_validity_days`.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin; no `super_admin` restriction).

### Request

```json
{
  "value": 14
}
```

Per-key validation:

| Key | `value_type` | Rules |
| --- | --- | --- |
| `company_name` | string | `required`, string, max 255 |
| `company_phone` | string | `required`, string, max 50 |
| `company_email` | string | `required`, string, email, max 255 |
| `company_address` | string | `required`, string, max 1000 |
| `default_currency` | string | `required`, in `MMK` |
| `timezone` | string | `required`, valid PHP timezone (e.g. `Asia/Yangon`) |
| `quotation_number_prefix` | string | `required`, max 10, alphanumeric |
| `quotation_validity_days` | integer | `required`, integer, min 1 |
| `quotation_service_fee_percentage` | integer | `required`, integer, min 0, max 100 |
| `order_number_prefix` | string | `required`, max 10, alphanumeric |
| `default_delivery_fee` | integer | `required`, integer, min 0 |
| `delivery_fee_mode` | string | `required`, in `MANUAL_PER_QUOTATION` |
| `payment_method` | string | `required`, in `CASH_ON_DELIVERY` |
| `require_full_payment` | boolean | `required`, boolean |
| `require_receipt_number` | boolean | `required`, boolean |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "setting": {
      "key": "quotation_validity_days",
      "value": 14,
      "value_type": "integer",
      "group_name": "quotation",
      "label": "Quotation Validity (Days)",
      "description": "Default number of days a sent quotation stays valid.",
      "is_public": false,
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  },
  "message": "Setting updated."
}
```

Notes:

- A changed value writes an `audit_logs` row: `action = setting.updated`, `entity_type = setting`, `entity_id = settings.id`, `old_data = {key, value}`, `new_data = {key, value}`, plus the request IP and admin id.
- Submitting the currently stored value is a no-op: no audit row is written and `updated_by_admin_id` stays unchanged.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Setting] unknown_key"}` | Unknown setting key (debug builds also include `exception`/`file`/`trace`) |
| `422` | `{"message": "The value field must be at least 1.", "errors": {"value": ["The value field must be at least 1."]}}` | Value fails the key's typed validation (required) |

---

## PATCH /api/v1/admin/settings

### Task

Task 03 — Database, Statuses, and Master Settings.

### Specification

- `specification/DatabaseFlow.md` §3 (`settings`)
- `specification/MoneyAndValidationRules.md` §3 (service fee percentage rules)

### Method

`PATCH`

### Path

`/api/v1/admin/settings`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin; no `super_admin` restriction).

### Request

```json
{
  "settings": {
    "quotation_validity_days": 10,
    "require_receipt_number": false,
    "company_name": "CoSupply Trading"
  }
}
```

- `settings` is required, must be a non-empty object.
- Every nested key must be a known setting key; every value is validated against that key's typed rules (same table as PUT).
- The whole batch runs in one database transaction. If any key is unknown or any value is invalid, nothing is persisted (all-or-nothing).

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "settings": [
      {
        "key": "quotation_validity_days",
        "value": 10,
        "value_type": "integer",
        "group_name": "quotation",
        "label": "Quotation Validity (Days)",
        "description": "Default number of days a sent quotation stays valid.",
        "is_public": false,
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      {
        "key": "require_receipt_number",
        "value": false,
        "value_type": "boolean",
        "group_name": "payment",
        "label": "Require Receipt Number",
        "description": "Cash collection must record a receipt number.",
        "is_public": false,
        "updated_at": "2026-10-17T05:40:36+00:00"
      }
    ]
  },
  "message": "Settings updated."
}
```

Notes:

- Response contains the requested settings with their current values (unchanged keys are included).
- Each changed key writes its own `setting.updated` audit row; unchanged keys do not.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The value field must not be greater than 100.", "errors": {"settings.quotation_service_fee_percentage": ["The value field must not be greater than 100."]}}` | A nested value fails its typed validation |
| `422` | `{"message": "Unknown setting key [nope].", "errors": {"settings.nope": ["Unknown setting key [nope]."]}}` | A nested key is not a documented setting |
| `422` | `{"message": "The settings field is required.", "errors": {"settings": ["The settings field is required."]}}` | Missing/empty `settings` object |

---

## GET /api/v1/admin/categories

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`categories`), §4 (foreign-key and integrity rules), §5 (indexes)
- `specification/RolesPermissions.md` §2 (catalog management is admin-only)

### Method

`GET`

### Path

`/api/v1/admin/categories`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `parent_id` | integer, must exist in `categories` |
| `status` | one of `ACTIVE`, `INACTIVE` |
| `search` | string, max 100; matches `name_mm` or `name_en` (LIKE) |
| `per_page` | integer 1–100, default 15 |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": "Phones, accessories and home electronics.",
        "image": "categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
        "image_url": "http://localhost:8000/storage/categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
        "sort_order": 0,
        "status": "ACTIVE",
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Ordered by `sort_order`, then `name_en`, then `id`.
- `image` is the path relative to the `public` disk; `image_url` is the absolute `/storage/...` URL and is `null` when no image is stored.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Invalid filter (unknown status, missing parent, `per_page` outside 1–100) |

---

## POST /api/v1/admin/categories

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`categories`)
- `specification/MoneyAndValidationRules.md` §9 (file upload validation)
- `specification/LogicFlow.md` §15 (audit logic)
- `specification/ImplementationNotes.md` §3 (Local Laravel file storage)

### Method

`POST`

### Path

`/api/v1/admin/categories`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data` when an image file is attached.

| Field | Rules |
| --- | --- |
| `name_mm` | required, string, max 255 |
| `name_en` | required, string, max 255 |
| `parent_id` | nullable, integer, must exist in `categories` |
| `slug` | nullable, string, max 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique in `categories` |
| `description` | nullable, string, max 5000 |
| `image` | nullable, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB |
| `sort_order` | nullable, integer, min 0 (default 0) |
| `status` | nullable, one of `ACTIVE`, `INACTIVE` (default `ACTIVE`) |

```json
{
  "name_mm": "အီလက်ထရောနစ်",
  "name_en": "Electronics",
  "parent_id": null,
  "description": "Phones, accessories and home electronics.",
  "sort_order": 0,
  "status": "ACTIVE",
  "image": "<binary image file>"
}
```

Notes:

- When `slug` is omitted it is derived from `name_en` using `Str::slug`. If the derived slug is empty or already taken, the request fails with a `slug` validation error and `slug` must be supplied explicitly.
- Uploaded images are stored on the `public` disk under `categories/` with a random 40-character filename. When the GD extension is available the image is downscaled to a longest edge of 2000px and re-encoded (JPEG/WebP quality 82, PNG compression 8); otherwise the original bytes are stored unchanged.
- The change writes an `audit_logs` row: `action = category.created`, `entity_type = category`, with the new values in `new_data`.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "category": {
      "id": 1,
      "parent_id": null,
      "name_mm": "အီလက်ထရောနစ်",
      "name_en": "Electronics",
      "slug": "electronics",
      "description": "Phones, accessories and home electronics.",
      "image": "categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
      "image_url": "http://localhost:8000/storage/categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
      "sort_order": 0,
      "status": "ACTIVE",
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  },
  "message": "Category created."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The image field must be a file of type: jpeg, jpg, png, webp.", "errors": {"image": ["The image field must be a file of type: jpeg, jpg, png, webp."]}}` | Invalid image type or size |
| `422` | `{"message": "The slug field is required because a slug cannot be generated from name_en.", "errors": {"slug": ["The slug field is required because a slug cannot be generated from name_en."]}}` | Omitted `slug` could not be derived from `name_en` |
| `422` | `{"message": "The slug has already been taken.", "errors": {"slug": ["The slug has already been taken."]}}` | Derived or explicit slug already exists |
| `422` | `{"message": "The name mm field is required.", "errors": {"name_mm": ["The name mm field is required."]}}` | Missing required field (same shape for `name_en`) |

---

## GET /api/v1/admin/categories/{category}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`categories`)

### Method

`GET`

### Path

`/api/v1/admin/categories/{category}` — `{category}` is the numeric category id, e.g. `/api/v1/admin/categories/1`.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "category": {
      "id": 1,
      "parent_id": null,
      "name_mm": "အီလက်ထရောနစ်",
      "name_en": "Electronics",
      "slug": "electronics",
      "description": "Phones, accessories and home electronics.",
      "image": "categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
      "image_url": "http://localhost:8000/storage/categories/9mQ2hR8tK4pLxV7sN1wYbC3dE5fG6jZa.jpg",
      "sort_order": 0,
      "status": "ACTIVE",
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  }
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Category] 999"}` | Unknown category id (debug builds also include `exception`/`file`/`trace`) |

---

## PATCH /api/v1/admin/categories/{category}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`categories`)
- `specification/LogicFlow.md` §15 (audit logic)

### Method

`PATCH`

### Path

`/api/v1/admin/categories/{category}` — `{category}` is the numeric category id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data` when a replacement image is attached. All fields are optional (`sometimes`); a supplied field must still satisfy its rules.

| Field | Rules |
| --- | --- |
| `name_mm` | sometimes, required, string, max 255 |
| `name_en` | sometimes, required, string, max 255; the stored slug is not regenerated automatically |
| `parent_id` | sometimes, nullable, integer, must exist in `categories`, must not equal the category's own id |
| `slug` | sometimes, required (non-empty), string, max 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique ignoring the current category |
| `description` | sometimes, nullable, string, max 5000 |
| `image` | sometimes, nullable, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB; replaces the stored image |
| `sort_order` | sometimes, integer, min 0 |
| `status` | sometimes, one of `ACTIVE`, `INACTIVE` |

```json
{
  "name_en": "Home Electronics",
  "status": "INACTIVE",
  "image": "<binary replacement image file>"
}
```

Notes:

- The existing slug is kept unless `slug` is explicitly supplied.
- When a new `image` is uploaded it is stored first; on failure the new file is removed and the old file stays. On success the previous file is deleted after commit.
- An `audit_logs` row (`action = category.updated`) is written only when the stored values actually change.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "category": {
      "id": 1,
      "parent_id": null,
      "name_mm": "အီလက်ထရောနစ်",
      "name_en": "Home Electronics",
      "slug": "electronics",
      "description": "Phones, accessories and home electronics.",
      "image": "categories/3kD8sW1qM6nTzR9xP2vYbC4dE7fG5jHb.png",
      "image_url": "http://localhost:8000/storage/categories/3kD8sW1qM6nTzR9xP2vYbC4dE7fG5jHb.png",
      "sort_order": 0,
      "status": "INACTIVE",
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T06:12:00+00:00"
    }
  },
  "message": "Category updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Category] 999"}` | Unknown category id |
| `422` | `{"message": "A category cannot be its own parent.", "errors": {"parent_id": ["A category cannot be its own parent."]}}` | `parent_id` equals the category id |
| `422` | `{"message": "The slug has already been taken.", "errors": {"slug": ["The slug has already been taken."]}}` | Supplied slug collides with another category |

---

## DELETE /api/v1/admin/categories/{category}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`categories`), §4 (foreign-key and integrity rules)
- `specification/LogicFlow.md` §15 (audit logic)

### Method

`DELETE`

### Path

`/api/v1/admin/categories/{category}` — `{category}` is the numeric category id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": null,
  "message": "Category deleted."
}
```

Notes:

- A `category.deleted` audit row is written with the previous values in `old_data`.
- The stored category image is deleted after the transaction commits.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Category] 999"}` | Unknown category id |
| `409` | `{"success": false, "message": "Category cannot be deleted because it has child categories."}` | Category has subcategories |
| `409` | `{"success": false, "message": "Category cannot be deleted because it has products."}` | Category still has products |
| `409` | `{"success": false, "message": "Category cannot be deleted because it is still referenced."}` | Other foreign keys still reference the category |

---

## GET /api/v1/admin/suppliers

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §4 (supplier data requirements)
- `specification/DatabaseFlow.md` §3 (`suppliers`), §5 (indexes)
- `specification/StatusDefinitions.md` §1 (supplier status)

### Method

`GET`

### Path

`/api/v1/admin/suppliers`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `status` | one of `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `search` | string, max 100; matches `shop_name`, `company_name` or `phone` (LIKE) |
| `per_page` | integer 1–100, default 15 |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": "Yangon Trading Co., Ltd.",
        "contact_person": "Daw Aye",
        "phone": "09123456789",
        "viber_phone": "09123456780",
        "email": "sales@yangontrading.example",
        "logo": "suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
        "logo_url": "http://localhost:8000/storage/suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
        "address": "No. 12, Bo Gyoke Road",
        "city": "Yangon",
        "township": "Lanmadaw",
        "business_description": "Wholesale electronics supplier.",
        "delivery_area": "Yangon",
        "delivery_time": "1-2 days",
        "warranty_policy": "7 days replacement for factory defects.",
        "return_policy": "Returns accepted within 7 days.",
        "status": "ACTIVE",
        "verified": false,
        "products_count": 12,
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Ordered by `shop_name`, then `id`.
- `products_count` is only included by the list endpoint (`withCount('products')`).

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Invalid filter or `per_page` outside 1–100 |

---

## POST /api/v1/admin/suppliers

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §4 (supplier data requirements)
- `specification/DatabaseFlow.md` §3 (`suppliers`)
- `specification/LogicFlow.md` §2 (admin creates supplier), §15 (audit logic)
- `specification/MoneyAndValidationRules.md` §9 (file upload validation)

### Method

`POST`

### Path

`/api/v1/admin/suppliers`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data` when a logo file is attached.

| Field | Rules |
| --- | --- |
| `shop_name` | required, string, max 255 |
| `company_name` | nullable, string, max 255 |
| `contact_person` | required, string, max 255 |
| `phone` | required, string, max 50 |
| `viber_phone` | nullable, string, max 50 |
| `email` | nullable, email, max 255 |
| `logo` | nullable, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB |
| `address` | required, string, max 1000 |
| `city` | required, string, max 255 |
| `township` | nullable, string, max 255 |
| `business_description` | nullable, string, max 5000 |
| `delivery_area` | nullable, string, max 255 |
| `delivery_time` | nullable, string, max 255 |
| `warranty_policy` | nullable, string, max 5000 |
| `return_policy` | nullable, string, max 5000 |
| `status` | nullable, one of `ACTIVE`, `INACTIVE`, `SUSPENDED` (default `ACTIVE`) |
| `verified` | nullable, boolean (default `false`) |

```json
{
  "shop_name": "Yangon Trading",
  "company_name": "Yangon Trading Co., Ltd.",
  "contact_person": "Daw Aye",
  "phone": "09123456789",
  "viber_phone": "09123456780",
  "email": "sales@yangontrading.example",
  "address": "No. 12, Bo Gyoke Road",
  "city": "Yangon",
  "township": "Lanmadaw",
  "business_description": "Wholesale electronics supplier.",
  "delivery_area": "Yangon",
  "delivery_time": "1-2 days",
  "warranty_policy": "7 days replacement for factory defects.",
  "return_policy": "Returns accepted within 7 days.",
  "status": "ACTIVE",
  "verified": false,
  "logo": "<binary image file>"
}
```

Notes:

- `address` and `city` are required because the `suppliers` table defines them as non-nullable.
- New suppliers start `ACTIVE` and unverified unless `status`/`verified` are supplied.
- The logo is stored on the `public` disk under `suppliers/logos/` (same image handling as category images).
- The change writes an `audit_logs` row: `action = supplier.created`, `entity_type = supplier`.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "supplier": {
      "id": 1,
      "shop_name": "Yangon Trading",
      "company_name": "Yangon Trading Co., Ltd.",
      "contact_person": "Daw Aye",
      "phone": "09123456789",
      "viber_phone": "09123456780",
      "email": "sales@yangontrading.example",
      "logo": "suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "logo_url": "http://localhost:8000/storage/suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "address": "No. 12, Bo Gyoke Road",
      "city": "Yangon",
      "township": "Lanmadaw",
      "business_description": "Wholesale electronics supplier.",
      "delivery_area": "Yangon",
      "delivery_time": "1-2 days",
      "warranty_policy": "7 days replacement for factory defects.",
      "return_policy": "Returns accepted within 7 days.",
      "status": "ACTIVE",
      "verified": false,
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  },
  "message": "Supplier created."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The shop name field is required.", "errors": {"shop_name": ["The shop name field is required."]}}` | Missing required field (same shape for `contact_person`, `phone`, `address`, `city`) |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Unknown supplier status |
| `422` | `{"message": "The logo field must be a file of type: jpeg, jpg, png, webp.", "errors": {"logo": ["The logo field must be a file of type: jpeg, jpg, png, webp."]}}` | Invalid logo type or size |

---

## GET /api/v1/admin/suppliers/{supplier}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`suppliers`)

### Method

`GET`

### Path

`/api/v1/admin/suppliers/{supplier}` — `{supplier}` is the numeric supplier id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "supplier": {
      "id": 1,
      "shop_name": "Yangon Trading",
      "company_name": "Yangon Trading Co., Ltd.",
      "contact_person": "Daw Aye",
      "phone": "09123456789",
      "viber_phone": "09123456780",
      "email": "sales@yangontrading.example",
      "logo": "suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "logo_url": "http://localhost:8000/storage/suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "address": "No. 12, Bo Gyoke Road",
      "city": "Yangon",
      "township": "Lanmadaw",
      "business_description": "Wholesale electronics supplier.",
      "delivery_area": "Yangon",
      "delivery_time": "1-2 days",
      "warranty_policy": "7 days replacement for factory defects.",
      "return_policy": "Returns accepted within 7 days.",
      "status": "ACTIVE",
      "verified": false,
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  }
}
```

Notes:

- `products_count` is not included by this endpoint; use the list endpoint (or the products list filtered by `supplier_id`).

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Supplier] 999"}` | Unknown supplier id |

---

## PATCH /api/v1/admin/suppliers/{supplier}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §4 (supplier data requirements)
- `specification/DatabaseFlow.md` §3 (`suppliers`)
- `specification/StatusDefinitions.md` §1 (supplier status), §2 (inactive/suspended suppliers cannot publish new products)
- `specification/LogicFlow.md` §15 (audit logic)

### Method

`PATCH`

### Path

`/api/v1/admin/suppliers/{supplier}` — `{supplier}` is the numeric supplier id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data` when a replacement logo is attached. All fields are optional (`sometimes`); a supplied field must still satisfy its rules.

| Field | Rules |
| --- | --- |
| `shop_name` | sometimes, required, string, max 255 |
| `company_name` | sometimes, nullable, string, max 255 |
| `contact_person` | sometimes, required, string, max 255 |
| `phone` | sometimes, required, string, max 50 |
| `viber_phone` | sometimes, nullable, string, max 50 |
| `email` | sometimes, nullable, email, max 255 |
| `logo` | sometimes, nullable, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB; replaces the stored logo |
| `address` | sometimes, required, string, max 1000 |
| `city` | sometimes, required, string, max 255 |
| `township` | sometimes, nullable, string, max 255 |
| `business_description` | sometimes, nullable, string, max 5000 |
| `delivery_area` | sometimes, nullable, string, max 255 |
| `delivery_time` | sometimes, nullable, string, max 255 |
| `warranty_policy` | sometimes, nullable, string, max 5000 |
| `return_policy` | sometimes, nullable, string, max 5000 |
| `status` | sometimes, one of `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `verified` | sometimes, boolean |

```json
{
  "status": "INACTIVE",
  "verified": true
}
```

Notes:

- Suppliers are never deleted: there is no `DELETE /api/v1/admin/suppliers/{supplier}` route. Deactivate a supplier by setting `status` to `INACTIVE` or `SUSPENDED`.
- Setting a supplier to `INACTIVE`/`SUSPENDED` does not cascade to already published products, but blocks new publish transitions (`PATCH /api/v1/admin/products/{product}/status` with `status = PUBLISHED`).
- An `audit_logs` row (`action = supplier.updated`) is written only when the stored values actually change.
- Replaced logos are removed from the `public` disk after commit.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "supplier": {
      "id": 1,
      "shop_name": "Yangon Trading",
      "company_name": "Yangon Trading Co., Ltd.",
      "contact_person": "Daw Aye",
      "phone": "09123456789",
      "viber_phone": "09123456780",
      "email": "sales@yangontrading.example",
      "logo": "suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "logo_url": "http://localhost:8000/storage/suppliers/logos/7rT1pQ9sLm4NxV2wZa8bYc6dE3fG5jHk.png",
      "address": "No. 12, Bo Gyoke Road",
      "city": "Yangon",
      "township": "Lanmadaw",
      "business_description": "Wholesale electronics supplier.",
      "delivery_area": "Yangon",
      "delivery_time": "1-2 days",
      "warranty_policy": "7 days replacement for factory defects.",
      "return_policy": "Returns accepted within 7 days.",
      "status": "INACTIVE",
      "verified": true,
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T06:20:11+00:00"
    }
  },
  "message": "Supplier updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Supplier] 999"}` | Unknown supplier id |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Unknown supplier status |
| `422` | `{"message": "The verified field must be true or false.", "errors": {"verified": ["The verified field must be true or false."]}}` | `verified` is not boolean |

---

## GET /api/v1/admin/products

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §5 (product requirements)
- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`), §5 (indexes)
- `specification/StatusDefinitions.md` §2 (product status), §3 (stock status)

### Method

`GET`

### Path

`/api/v1/admin/products`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `status` | one of `DRAFT`, `PUBLISHED`, `HIDDEN`, `OUT_OF_STOCK` |
| `category_id` | integer, must exist in `categories` |
| `supplier_id` | integer, must exist in `suppliers` |
| `search` | string, max 100; matches `name_mm`, `name_en`, `sku`, `brand` or `model` (LIKE) |
| `per_page` | integer 1–100, default 15 |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "supplier_id": 1,
        "category_id": 1,
        "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
        "name_en": "Plastic Chair",
        "slug": "plastic-chair",
        "sku": "CHAIR-001",
        "brand": "CoSupply",
        "model": "PC-100",
        "description": "Stackable plastic chair.",
        "specification": "Polypropylene, 42cm seat height.",
        "size": "M",
        "color": "Blue",
        "unit": "pcs",
        "package_size": "1",
        "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
        "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
        "status": "DRAFT",
        "category": {
          "id": 1,
          "parent_id": null,
          "name_mm": "အီလက်ထရောနစ်",
          "name_en": "Electronics",
          "slug": "electronics",
          "description": "Phones, accessories and home electronics.",
          "image": null,
          "image_url": null,
          "sort_order": 0,
          "status": "ACTIVE",
          "created_at": "2026-10-17T05:40:36+00:00",
          "updated_at": "2026-10-17T05:40:36+00:00"
        },
        "supplier": {
          "id": 1,
          "shop_name": "Yangon Trading",
          "company_name": "Yangon Trading Co., Ltd.",
          "contact_person": "Daw Aye",
          "phone": "09123456789",
          "viber_phone": "09123456780",
          "email": "sales@yangontrading.example",
          "logo": null,
          "logo_url": null,
          "address": "No. 12, Bo Gyoke Road",
          "city": "Yangon",
          "township": "Lanmadaw",
          "business_description": "Wholesale electronics supplier.",
          "delivery_area": "Yangon",
          "delivery_time": "1-2 days",
          "warranty_policy": "7 days replacement for factory defects.",
          "return_policy": "Returns accepted within 7 days.",
          "status": "ACTIVE",
          "verified": false,
          "created_by_admin_id": 1,
          "created_at": "2026-10-17T05:40:36+00:00",
          "updated_at": "2026-10-17T05:40:36+00:00"
        },
        "price": {
          "id": 1,
          "retail_price": 5000,
          "wholesale_price": null,
          "discount_price": null,
          "minimum_order_quantity": 1,
          "price_valid_until": null,
          "last_updated_at": "2026-10-17T05:40:36+00:00"
        },
        "stock": {
          "id": 1,
          "stock_quantity": 20,
          "stock_status": "IN_STOCK",
          "last_confirmed_at": "2026-10-17T05:40:36+00:00",
          "supplier_note": "Confirmed by supplier"
        },
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Ordered newest first (`created_at` desc, then `id` desc).
- Each item embeds its `category`, `supplier`, first `price` row and `stock` row; `price` and `stock` are `null` when no row exists.
- Only the first (oldest) price row per product is embedded; all money values are integer MMK.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Invalid filter or `per_page` outside 1–100 |

---

## POST /api/v1/admin/products

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §5 (product requirements)
- `specification/LogicFlow.md` §3 (admin creates product), §4 (cart eligibility), §15 (audit logic)
- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`)
- `specification/StatusDefinitions.md` §2 (product status), §3 (stock status)
- `specification/MoneyAndValidationRules.md` §1 (integer MMK), §9 (file upload validation)

### Method

`POST`

### Path

`/api/v1/admin/products`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data`. The price and stock fields are flat ("embedded") fields of the same request.

| Field | Rules |
| --- | --- |
| `supplier_id` | required, integer, must exist in `suppliers` |
| `category_id` | required, integer, must exist in `categories` |
| `name_mm` | required, string, max 255 |
| `name_en` | nullable, string, max 255 (used to derive `slug` when omitted) |
| `slug` | nullable, string, max 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique in `products` |
| `sku` | nullable, string, max 100 |
| `brand` | nullable, string, max 255 |
| `model` | nullable, string, max 255 |
| `description` | nullable, string, max 5000 |
| `specification` | nullable, string, max 5000 |
| `size` | nullable, string, max 100 |
| `color` | nullable, string, max 100 |
| `unit` | required, string, max 50 |
| `package_size` | nullable, string, max 100 |
| `photo` | required, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB |
| `status` | nullable, one of `DRAFT`, `PUBLISHED` (default `DRAFT`) |
| `retail_price` | required, integer, min 1 (MMK) |
| `wholesale_price` | nullable, integer, min 0 (MMK) |
| `discount_price` | nullable, integer, min 0 (MMK), must not exceed `retail_price` |
| `minimum_order_quantity` | nullable, integer, min 1 (default 1) |
| `price_valid_until` | nullable, date |
| `stock_quantity` | nullable, integer, min 0 |
| `stock_status` | nullable, one of `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PRE_ORDER`, `SUPPLIER_CONFIRMATION_REQUIRED` |
| `supplier_note` | nullable, string, max 1000 |

```json
{
  "supplier_id": 1,
  "category_id": 1,
  "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
  "name_en": "Plastic Chair",
  "unit": "pcs",
  "retail_price": 5000,
  "minimum_order_quantity": 1,
  "stock_quantity": 20,
  "stock_status": "IN_STOCK",
  "supplier_note": "Confirmed by supplier",
  "status": "DRAFT",
  "photo": "<binary image file>"
}
```

Notes:

- When `slug` is omitted it is derived from `name_en` using `Str::slug`; if the derived slug is empty (for example `name_en` is omitted or contains no slug-able characters) or already taken, the request fails with a `slug` validation error.
- The photo is required and stored on the `public` disk under `products/` with a random 40-character filename; if the create fails, the stored photo is deleted.
- A price row is always written from the price fields (`retail_price` is required). The `product_prices.updated_by_admin_id` and `last_updated_at` are set to the current admin and now.
- A stock row is written when any of `stock_quantity`, `stock_status`, `supplier_note` is present. Its `supplier_id` follows the product supplier, `last_confirmed_at` is now, `confirmed_by_admin_id` is the current admin, and `stock_status` defaults to `SUPPLIER_CONFIRMATION_REQUIRED` when omitted.
- Creating with `status = PUBLISHED` immediately applies the publish rules: supplier must be `ACTIVE`, category must be `ACTIVE`, photo must be present, `retail_price` must be > 0. Violations return `422` with errors keyed by `supplier_id`, `category_id`, `photo` and/or `retail_price`, and nothing is persisted.
- Audit rows: `product.created`, plus `product.price_updated` and `product.stock_updated`.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "supplier_id": 1,
      "category_id": 1,
      "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
      "name_en": "Plastic Chair",
      "slug": "plastic-chair",
      "sku": null,
      "brand": null,
      "model": null,
      "description": null,
      "specification": null,
      "size": null,
      "color": null,
      "unit": "pcs",
      "package_size": null,
      "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "status": "DRAFT",
      "category": {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": null,
        "image": null,
        "image_url": null,
        "sort_order": 0,
        "status": "ACTIVE",
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "supplier": {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": null,
        "contact_person": "Daw Aye",
        "phone": "09123456789",
        "viber_phone": null,
        "email": null,
        "logo": null,
        "logo_url": null,
        "address": "No. 12, Bo Gyoke Road",
        "city": "Yangon",
        "township": null,
        "business_description": null,
        "delivery_area": null,
        "delivery_time": null,
        "warranty_policy": null,
        "return_policy": null,
        "status": "ACTIVE",
        "verified": false,
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "price": {
        "id": 1,
        "retail_price": 5000,
        "wholesale_price": null,
        "discount_price": null,
        "minimum_order_quantity": 1,
        "price_valid_until": null,
        "last_updated_at": "2026-10-17T05:40:36+00:00"
      },
      "stock": {
        "id": 1,
        "stock_quantity": 20,
        "stock_status": "IN_STOCK",
        "last_confirmed_at": "2026-10-17T05:40:36+00:00",
        "supplier_note": "Confirmed by supplier"
      },
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  },
  "message": "Product created."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `422` | `{"message": "The photo field is required.", "errors": {"photo": ["The photo field is required."]}}` | Missing required field (same shape for `supplier_id`, `category_id`, `name_mm`, `unit`, `retail_price`) |
| `422` | `{"message": "The discount price must not be greater than the retail price.", "errors": {"discount_price": ["The discount price must not be greater than the retail price."]}}` | `discount_price` exceeds `retail_price` |
| `422` | `{"message": "The slug has already been taken.", "errors": {"slug": ["The slug has already been taken."]}}` | Derived or explicit slug already exists |
| `422` | `{"message": "The product supplier must exist and be active before publishing. (and 1 more error)", "errors": {"supplier_id": ["The product supplier must exist and be active before publishing."], "retail_price": ["A retail price greater than zero is required before publishing a product."]}}` | `status = PUBLISHED` fails the publish rules |
| `422` | `{"message": "The selected stock status is invalid.", "errors": {"stock_status": ["The selected stock status is invalid."]}}` | Unknown stock status |

---

## GET /api/v1/admin/products/{product}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §5 (product requirements)
- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`)

### Method

`GET`

### Path

`/api/v1/admin/products/{product}` — `{product}` is the numeric product id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "supplier_id": 1,
      "category_id": 1,
      "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
      "name_en": "Plastic Chair",
      "slug": "plastic-chair",
      "sku": "CHAIR-001",
      "brand": "CoSupply",
      "model": "PC-100",
      "description": "Stackable plastic chair.",
      "specification": "Polypropylene, 42cm seat height.",
      "size": "M",
      "color": "Blue",
      "unit": "pcs",
      "package_size": "1",
      "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "status": "DRAFT",
      "category": {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": null,
        "image": null,
        "image_url": null,
        "sort_order": 0,
        "status": "ACTIVE",
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "supplier": {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": null,
        "contact_person": "Daw Aye",
        "phone": "09123456789",
        "viber_phone": null,
        "email": null,
        "logo": null,
        "logo_url": null,
        "address": "No. 12, Bo Gyoke Road",
        "city": "Yangon",
        "township": null,
        "business_description": null,
        "delivery_area": null,
        "delivery_time": null,
        "warranty_policy": null,
        "return_policy": null,
        "status": "ACTIVE",
        "verified": false,
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "price": {
        "id": 1,
        "retail_price": 5000,
        "wholesale_price": null,
        "discount_price": null,
        "minimum_order_quantity": 1,
        "price_valid_until": null,
        "last_updated_at": "2026-10-17T05:40:36+00:00"
      },
      "stock": {
        "id": 1,
        "stock_quantity": 20,
        "stock_status": "IN_STOCK",
        "last_confirmed_at": "2026-10-17T05:40:36+00:00",
        "supplier_note": "Confirmed by supplier"
      },
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T05:40:36+00:00"
    }
  }
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Product] 999"}` | Unknown product id |

---

## PATCH /api/v1/admin/products/{product}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/BusinessRequirements.md` §5 (product requirements)
- `specification/LogicFlow.md` §3 (admin creates product), §15 (audit logic)
- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`)

### Method

`PATCH`

### Path

`/api/v1/admin/products/{product}` — `{product}` is the numeric product id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

Send as `multipart/form-data` when a replacement photo is attached. All fields are optional (`sometimes`); a supplied field must still satisfy its rules.

| Field | Rules |
| --- | --- |
| `supplier_id` | sometimes, required, integer, must exist in `suppliers` |
| `category_id` | sometimes, required, integer, must exist in `categories` |
| `name_mm` | sometimes, required, string, max 255 |
| `name_en` | sometimes, nullable, string, max 255 |
| `slug` | sometimes, required (non-empty), string, max 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique ignoring the current product |
| `sku` | sometimes, nullable, string, max 100 |
| `brand` | sometimes, nullable, string, max 255 |
| `model` | sometimes, nullable, string, max 255 |
| `description` | sometimes, nullable, string, max 5000 |
| `specification` | sometimes, nullable, string, max 5000 |
| `size` | sometimes, nullable, string, max 100 |
| `color` | sometimes, nullable, string, max 100 |
| `unit` | sometimes, required, string, max 50 |
| `package_size` | sometimes, nullable, string, max 100 |
| `photo` | sometimes, nullable, file: `jpeg`, `jpg`, `png`, `webp`, max 2048 KB; replaces the stored photo |
| `retail_price` | sometimes, required, integer, min 1 (MMK) |
| `wholesale_price` | sometimes, nullable, integer, min 0 (MMK) |
| `discount_price` | sometimes, nullable, integer, min 0 (MMK), must not exceed the effective retail price |
| `minimum_order_quantity` | sometimes, integer, min 1 |
| `price_valid_until` | sometimes, nullable, date |
| `stock_quantity` | sometimes, nullable, integer, min 0 |
| `stock_status` | sometimes, nullable, one of `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PRE_ORDER`, `SUPPLIER_CONFIRMATION_REQUIRED` |
| `supplier_note` | sometimes, nullable, string, max 1000 |

```json
{
  "name_en": "Plastic Chair Deluxe",
  "retail_price": 6500,
  "stock_status": "LOW_STOCK",
  "photo": "<binary replacement image file>"
}
```

Notes:

- `status` is not accepted here; use `PATCH /api/v1/admin/products/{product}/status`.
- `slug` is only changed when explicitly supplied; otherwise the existing slug is kept.
- When `discount_price` is supplied without `retail_price`, the comparison uses the stored (effective) retail price.
- The replacement photo is stored first; on failure the new file is removed and the old photo stays. On success the previous file is deleted after commit.
- Audit rows are written only for values that actually change: `product.updated`, `product.price_updated` and/or `product.stock_updated`.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "supplier_id": 1,
      "category_id": 1,
      "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
      "name_en": "Plastic Chair Deluxe",
      "slug": "plastic-chair",
      "sku": "CHAIR-001",
      "brand": "CoSupply",
      "model": "PC-100",
      "description": "Stackable plastic chair.",
      "specification": "Polypropylene, 42cm seat height.",
      "size": "M",
      "color": "Blue",
      "unit": "pcs",
      "package_size": "1",
      "photo": "products/8nB3vK6mQ1wZxT5rYp2dC4eF7gH9jLsA.png",
      "photo_url": "http://localhost:8000/storage/products/8nB3vK6mQ1wZxT5rYp2dC4eF7gH9jLsA.png",
      "status": "DRAFT",
      "category": {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": null,
        "image": null,
        "image_url": null,
        "sort_order": 0,
        "status": "ACTIVE",
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "supplier": {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": null,
        "contact_person": "Daw Aye",
        "phone": "09123456789",
        "viber_phone": null,
        "email": null,
        "logo": null,
        "logo_url": null,
        "address": "No. 12, Bo Gyoke Road",
        "city": "Yangon",
        "township": null,
        "business_description": null,
        "delivery_area": null,
        "delivery_time": null,
        "warranty_policy": null,
        "return_policy": null,
        "status": "ACTIVE",
        "verified": false,
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "price": {
        "id": 1,
        "retail_price": 6500,
        "wholesale_price": null,
        "discount_price": null,
        "minimum_order_quantity": 1,
        "price_valid_until": null,
        "last_updated_at": "2026-10-17T06:30:45+00:00"
      },
      "stock": {
        "id": 1,
        "stock_quantity": 20,
        "stock_status": "LOW_STOCK",
        "last_confirmed_at": "2026-10-17T06:30:45+00:00",
        "supplier_note": "Confirmed by supplier"
      },
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T06:30:45+00:00"
    }
  },
  "message": "Product updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Product] 999"}` | Unknown product id |
| `422` | `{"message": "The slug has already been taken.", "errors": {"slug": ["The slug has already been taken."]}}` | Supplied slug collides with another product |
| `422` | `{"message": "The discount price must not be greater than the retail price.", "errors": {"discount_price": ["The discount price must not be greater than the retail price."]}}` | `discount_price` exceeds the effective retail price |
| `422` | `{"message": "The selected stock status is invalid.", "errors": {"stock_status": ["The selected stock status is invalid."]}}` | Unknown stock status |

---

## PATCH /api/v1/admin/products/{product}/status

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/LogicFlow.md` §3 (admin creates product), §15 (audit logic)
- `specification/StatusDefinitions.md` §2 (product status), §1 (supplier status)
- `specification/BusinessRequirements.md` §5 (product requirements)

### Method

`PATCH`

### Path

`/api/v1/admin/products/{product}/status` — `{product}` is the numeric product id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

```json
{
  "status": "PUBLISHED"
}
```

- `status` is required and must be one of `DRAFT`, `PUBLISHED`, `HIDDEN`, `OUT_OF_STOCK`.
- A transition to `PUBLISHED` applies the publish rules: the product's supplier must be `ACTIVE`, its category must be `ACTIVE`, it must have a photo, and its retail price must be > 0. Any failing condition returns `422` keyed by `supplier_id`, `category_id`, `photo` and/or `retail_price`, and the status is not changed.
- Submitting the product's current status is an idempotent no-op: `200 OK` is returned and no audit row is written.
- A successful change writes a `product.status_updated` audit row with `old_data = {status}` and `new_data = {status}`.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "supplier_id": 1,
      "category_id": 1,
      "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
      "name_en": "Plastic Chair",
      "slug": "plastic-chair",
      "sku": "CHAIR-001",
      "brand": "CoSupply",
      "model": "PC-100",
      "description": "Stackable plastic chair.",
      "specification": "Polypropylene, 42cm seat height.",
      "size": "M",
      "color": "Blue",
      "unit": "pcs",
      "package_size": "1",
      "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "status": "PUBLISHED",
      "category": {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": null,
        "image": null,
        "image_url": null,
        "sort_order": 0,
        "status": "ACTIVE",
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "supplier": {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": null,
        "contact_person": "Daw Aye",
        "phone": "09123456789",
        "viber_phone": null,
        "email": null,
        "logo": null,
        "logo_url": null,
        "address": "No. 12, Bo Gyoke Road",
        "city": "Yangon",
        "township": null,
        "business_description": null,
        "delivery_area": null,
        "delivery_time": null,
        "warranty_policy": null,
        "return_policy": null,
        "status": "ACTIVE",
        "verified": false,
        "created_by_admin_id": 1,
        "created_at": "2026-10-17T05:40:36+00:00",
        "updated_at": "2026-10-17T05:40:36+00:00"
      },
      "price": {
        "id": 1,
        "retail_price": 5000,
        "wholesale_price": null,
        "discount_price": null,
        "minimum_order_quantity": 1,
        "price_valid_until": null,
        "last_updated_at": "2026-10-17T05:40:36+00:00"
      },
      "stock": {
        "id": 1,
        "stock_quantity": 20,
        "stock_status": "IN_STOCK",
        "last_confirmed_at": "2026-10-17T05:40:36+00:00",
        "supplier_note": "Confirmed by supplier"
      },
      "created_by_admin_id": 1,
      "created_at": "2026-10-17T05:40:36+00:00",
      "updated_at": "2026-10-17T06:40:12+00:00"
    }
  },
  "message": "Product status updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Product] 999"}` | Unknown product id |
| `422` | `{"message": "The selected status is invalid.", "errors": {"status": ["The selected status is invalid."]}}` | Unknown product status |
| `422` | `{"message": "The product supplier must exist and be active before publishing.", "errors": {"supplier_id": ["The product supplier must exist and be active before publishing."]}}` | Publish transition fails (same shape for `category_id`, `photo`, `retail_price`) |

---

## DELETE /api/v1/admin/products/{product}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`), §4 (foreign-key and integrity rules)
- `specification/LogicFlow.md` §15 (audit logic)

### Method

`DELETE`

### Path

`/api/v1/admin/products/{product}` — `{product}` is the numeric product id.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": null,
  "message": "Product deleted."
}
```

Notes:

- The product's price and stock rows are deleted in the same transaction as the product.
- A `product.deleted` audit row is written with the previous values in `old_data`; the stored photo is deleted after commit.
- Products referenced by quotation items, quotation version items or order items cannot be deleted.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Product] 999"}` | Unknown product id |
| `409` | `{"success": false, "message": "Product cannot be deleted because it is referenced by quotation or order records."}` | Product is referenced by `quotation_items`, `quotation_version_items` or `order_items` |
| `409` | `{"success": false, "message": "Product cannot be deleted because it is still referenced by quotation or order records."}` | A foreign key still restricts the delete |

---

## GET /api/v1/admin/files/{path}

### Task

Task 04 — Catalog, Suppliers, Products, and Media.

### Specification

- `specification/TechnicalArchitecture.md` §6 (files and media: private assets are served only after authorization)
- `specification/MoneyAndValidationRules.md` §9 (private uploads: store outside public storage, require authorization, log admin action)
- `specification/ImplementationNotes.md` §3 (Local Laravel file storage)
- `specification/RolesPermissions.md` §3 (security rules)

### Method

`GET`

### Path

`/api/v1/admin/files/{path}` — `{path}` is a relative path inside the private `local` disk (`storage/app/private`), e.g. `/api/v1/admin/files/receipts/2026/receipt-001.pdf`. The route uses a catch-all segment so nested paths are supported.

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any authenticated admin; no `super_admin` restriction).

### Request

No body, no query parameters. The relative path is the only input.

### Success response

`200 OK` — streamed binary file (not JSON). Example response headers:

```text
Content-Type: application/pdf
Content-Length: 48123
Content-Disposition: inline; filename="receipt-001.pdf"
```

Notes:

- Private files (receipt PDFs, cash payment proofs, customer signatures, supplier communication attachments) are stored on the `local` disk and are never exposed through a public `/storage/...` URL.
- The response is streamed from the private disk after the admin check; the JSON envelope does not apply to successful downloads.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Token without the `admin` ability |
| `404` | `{"success": false, "message": "File not found."}` | File missing, or the path is unsafe (absolute path, drive letter, `.`/`..` segments, empty segments, backslash traversal, null byte) — unsafe paths are indistinguishable from missing files |

---

## GET /api/v1/products

### Task

Task 05 — Public Catalog and Cart.

### Specification

- `specification/RolesPermissions.md` §1 (Guest: product list, search/filter, product detail), §2 (permission matrix: view published products), §3 (supplier contact info is exposed only as far as needed)
- `specification/BusinessRequirements.md` §3 (Customer Requirements → Guest Customer), §5 (Product Requirements)
- `specification/LogicFlow.md` §4 (Customer Browsing and Cart)
- `specification/DatabaseFlow.md` §3 (`products`, `product_prices`, `product_stocks`), §5 (indexes)
- `specification/StatusDefinitions.md` §2 (product status), §3 (stock status)

### Method

`GET`

### Path

`/api/v1/products`

### Authentication

None — public endpoint. No token is required.

### Roles

Guest, Customer, Admin.

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `search` | string, max 100; matches `name_mm`, `name_en`, `sku`, `brand` or `model` (LIKE) |
| `category_id` | integer, must exist in `categories` |
| `supplier_id` | integer, must exist in `suppliers` |
| `stock_status` | one of `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PRE_ORDER`, `SUPPLIER_CONFIRMATION_REQUIRED` |
| `per_page` | integer 1–100, default 15 |
| `page` | page number, default 1 (resolved by the paginator) |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "supplier_id": 1,
        "category_id": 1,
        "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
        "name_en": "Plastic Chair",
        "slug": "plastic-chair",
        "sku": "CHAIR-001",
        "brand": "CoSupply",
        "model": "PC-100",
        "description": "Stackable plastic chair.",
        "specification": "Polypropylene, 42cm seat height.",
        "size": "M",
        "color": "Blue",
        "unit": "pcs",
        "package_size": "1",
        "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
        "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
        "status": "PUBLISHED",
        "category": {
          "id": 1,
          "parent_id": null,
          "name_mm": "အီလက်ထရောနစ်",
          "name_en": "Electronics",
          "slug": "electronics",
          "description": "Phones, accessories and home electronics.",
          "image": null,
          "image_url": null,
          "sort_order": 0
        },
        "supplier": {
          "id": 1,
          "shop_name": "Yangon Trading",
          "company_name": "Yangon Trading Co., Ltd.",
          "logo": null,
          "logo_url": null,
          "business_description": "Wholesale electronics supplier.",
          "delivery_area": "Yangon",
          "delivery_time": "1-2 days",
          "verified": true
        },
        "price": {
          "retail_price": 5000,
          "discount_price": null,
          "minimum_order_quantity": 1,
          "price_valid_until": null,
          "last_updated_at": "2026-10-17T05:40:36+00:00"
        },
        "stock": {
          "stock_quantity": 20,
          "stock_status": "IN_STOCK",
          "last_confirmed_at": "2026-10-17T05:40:36+00:00"
        }
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Only `status = PUBLISHED` products are returned, ordered newest first (`created_at` desc, then `id` desc).
- A published product whose stock row reads `OUT_OF_STOCK` is still listed here: browsing is allowed and only cart eligibility is withheld. `stock_status` is an optional narrowing filter, not a visibility rule.
- `price` and `stock` are `null` when no row exists. Only the first (oldest) price row is embedded; all money values are integer MMK.
- Never exposed on this endpoint: `wholesale_price`, `supplier_note`, `created_by_admin_id`, product `created_at`/`updated_at`, category `status`/timestamps, and every supplier contact field (`contact_person`, `phone`, `viber_phone`, `email`, `address`, `city`, `township`, `status`, `created_by_admin_id`).

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `422` | `{"message": "The selected stock status is invalid.", "errors": {"stock_status": ["The selected stock status is invalid."]}}` | Unknown `stock_status`, `category_id`/`supplier_id` not found, `search` over 100 characters, or `per_page` outside 1–100 |

---

## GET /api/v1/products/{productId}

### Task

Task 05 — Public Catalog and Cart.

### Specification

- `specification/RolesPermissions.md` §1 (Guest: product detail), §3 (supplier contact info is exposed only as far as needed)
- `specification/BusinessRequirements.md` §3 (Customer Requirements → Guest Customer), §5 (Product Requirements)
- `specification/LogicFlow.md` §4 (Customer Browsing and Cart)
- `specification/StatusDefinitions.md` §2 (product status), §3 (stock status)

### Method

`GET`

### Path

`/api/v1/products/{productId}` — `{productId}` is the numeric product id, e.g. `/api/v1/products/1`.

### Authentication

None — public endpoint. No token is required.

### Roles

Guest, Customer, Admin.

### Request

No body, no query parameters. `{productId}` is the only input.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "supplier_id": 1,
      "category_id": 1,
      "name_mm": "ပလတ်စတစ်ကုတ်အင်္ကျီ",
      "name_en": "Plastic Chair",
      "slug": "plastic-chair",
      "sku": "CHAIR-001",
      "brand": "CoSupply",
      "model": "PC-100",
      "description": "Stackable plastic chair.",
      "specification": "Polypropylene, 42cm seat height.",
      "size": "M",
      "color": "Blue",
      "unit": "pcs",
      "package_size": "1",
      "photo": "products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "photo_url": "http://localhost:8000/storage/products/2wF5hJ8kLq3mNxR7tYv9bC1dE4gH6sZp.jpg",
      "status": "PUBLISHED",
      "category": { "id": 1, "parent_id": null, "name_mm": "အီလက်ထရောနစ်", "name_en": "Electronics", "slug": "electronics", "description": "Phones, accessories and home electronics.", "image": null, "image_url": null, "sort_order": 0 },
      "supplier": { "id": 1, "shop_name": "Yangon Trading", "company_name": "Yangon Trading Co., Ltd.", "logo": null, "logo_url": null, "business_description": "Wholesale electronics supplier.", "delivery_area": "Yangon", "delivery_time": "1-2 days", "verified": true },
      "price": { "retail_price": 5000, "discount_price": null, "minimum_order_quantity": 1, "price_valid_until": null, "last_updated_at": "2026-10-17T05:40:36+00:00" },
      "stock": { "stock_quantity": 20, "stock_status": "IN_STOCK", "last_confirmed_at": "2026-10-17T05:40:36+00:00" }
    }
  }
}
```

Notes:

- The response body is the same shape as one item of `GET /api/v1/products`.
- Browsing is not cart eligibility. When `stock.stock_status` is `OUT_OF_STOCK` the client must not offer *Add to cart*; every other stock status — including `SUPPLIER_CONFIRMATION_REQUIRED` — is addable (LogicFlow §4). A product with no `stock` row is addable as well.
- The supplier block carries only `shop_name`, `company_name`, `logo`, `business_description`, `delivery_area`, `delivery_time` and `verified` — no phone/Viber/email/address, per RolesPermissions §3.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `404` | `{"success": false, "message": "Product not found."}` | Unknown id, non-numeric id, or a product whose status is not `PUBLISHED` (all three are deliberately indistinguishable) |

---

## GET /api/v1/categories

### Task

Task 05 — Public Catalog and Cart.

### Specification

- `specification/RolesPermissions.md` §1 (Guest: home/category navigation)
- `specification/BusinessRequirements.md` §3 (Customer Requirements → Guest Customer)
- `specification/LogicFlow.md` §4 (Customer Browsing and Cart)
- `specification/DatabaseFlow.md` §3 (`categories`), §5 (indexes)
- `specification/StatusDefinitions.md` §1 (`INACTIVE`/`ACTIVE` category status)

### Method

`GET`

### Path

`/api/v1/categories`

### Authentication

None — public endpoint. No token is required.

### Roles

Guest, Customer, Admin.

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `parent_id` | integer, must exist in `categories` — returns the children of that category |
| `search` | string, max 100; matches `name_mm` or `name_en` (LIKE) |
| `per_page` | integer 1–100, default 15 |
| `page` | page number, default 1 (resolved by the paginator) |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "parent_id": null,
        "name_mm": "အီလက်ထရောနစ်",
        "name_en": "Electronics",
        "slug": "electronics",
        "description": "Phones, accessories and home electronics.",
        "image": null,
        "image_url": null,
        "sort_order": 0
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Only `status = ACTIVE` categories are returned, so deactivating a category removes it from the public catalog immediately.
- Ordered by `sort_order`, then `name_en`, then `id`.
- Category `status` and timestamps are not exposed publicly.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `422` | `{"message": "The selected parent id is invalid.", "errors": {"parent_id": ["The selected parent id is invalid."]}}` | `parent_id` not found in `categories`, `search` over 100 characters, or `per_page` outside 1–100 |

---

## GET /api/v1/suppliers

### Task

Task 05 — Public Catalog and Cart.

### Specification

- `specification/RolesPermissions.md` §1 (Guest), §3 (supplier phone/Viber information is shown publicly only as far as it is needed)
- `specification/BusinessRequirements.md` §3 (Customer Requirements → Guest Customer), §4 (Supplier Data Requirements)
- `specification/LogicFlow.md` §4 (Customer Browsing and Cart)
- `specification/DatabaseFlow.md` §3 (`suppliers`), §5 (indexes)
- `specification/StatusDefinitions.md` §1 (supplier status)

### Method

`GET`

### Path

`/api/v1/suppliers`

### Authentication

None — public endpoint. No token is required.

### Roles

Guest, Customer, Admin.

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `search` | string, max 100; matches `shop_name` or `company_name` (LIKE) |
| `per_page` | integer 1–100, default 15 |
| `page` | page number, default 1 (resolved by the paginator) |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": 1,
        "shop_name": "Yangon Trading",
        "company_name": "Yangon Trading Co., Ltd.",
        "logo": null,
        "logo_url": null,
        "business_description": "Wholesale electronics supplier.",
        "delivery_area": "Yangon",
        "delivery_time": "1-2 days",
        "verified": true
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Only `status = ACTIVE` suppliers are returned (`INACTIVE` and `SUSPENDED` are excluded).
- Ordered by `shop_name`, then `id`.
- Never exposed: `contact_person`, `phone`, `viber_phone`, `email`, `address`, `city`, `township`, `warranty_policy`, `return_policy`, `status`, `created_by_admin_id`, `created_at`, `updated_at`.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `422` | `{"message": "The search field must not be greater than 100 characters.", "errors": {"search": ["The search field must not be greater than 100 characters."]}}` | `search` over 100 characters or `per_page` outside 1–100 |

---

## GET /api/v1/customer/profile

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/RolesPermissions.md` §2 (Customer)
- `specification/LogicFlow.md` §5 (Quotation Request)
- `specification/DatabaseFlow.md` §3 (`customers`)

### Method

`GET`

### Path

`/api/v1/customer/profile`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own profile only).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 12,
      "name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "email": "aung@example.com",
      "phone": "09123456789",
      "customer_type": "business",
      "status": "ACTIVE",
      "created_at": "2026-10-18T09:15:00+00:00"
    }
  }
}
```

Notes:

- The password hash is never exposed.
- `phone` is the login identifier and is read-only here.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |

---

## PUT /api/v1/customer/profile

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/RolesPermissions.md` §2 (Customer)
- `specification/DatabaseFlow.md` §3 (`customers`)

### Method

`PUT`

### Path

`/api/v1/customer/profile`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own profile only).

### Request

| Field | Rules |
| --- | --- |
| `name` | required, string, max 255 |
| `company_name` | nullable, string, max 255 |
| `email` | nullable, valid email, max 255, unique on `customers.email` (own email allowed) |

`phone`, `customer_type` and `status` are server-managed and are silently ignored if sent.

```json
{
  "name": "Aung Aung",
  "company_name": "Aung Trading Co., Ltd.",
  "email": "aung@example.com"
}
```

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 12,
      "name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "email": "aung@example.com",
      "phone": "09123456789",
      "customer_type": "business",
      "status": "ACTIVE",
      "created_at": "2026-10-18T09:15:00+00:00"
    }
  },
  "message": "Profile updated successfully."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `422` | `{"message": "The email has already been taken.", "errors": {"email": ["The email has already been taken."]}}` | Validation failure |

---

## GET /api/v1/customer/addresses

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/DatabaseFlow.md` §3 (`customer_addresses`)
- `specification/LogicFlow.md` §5 (delivery address selection)

### Method

`GET`

### Path

`/api/v1/customer/addresses`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own address book only).

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `page` | integer, min 1, default 1 |
| `per_page` | integer 1–100, default 15 |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "id": 4,
        "customer_id": 12,
        "contact_name": "Kyaw Kyaw",
        "phone": "0987654321",
        "city": "Yangon",
        "township": "Bahan",
        "ward": "9",
        "street": "University Avenue",
        "building_no": "No. 45",
        "landmark": "Opposite the park",
        "full_address": "No. 45, University Avenue, 9 Ward, Bahan, Yangon",
        "is_default": true,
        "created_at": "2026-10-18T10:00:00+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Ordered by `is_default` descending, then `id` descending.
- Only the authenticated customer's rows are returned.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `422` | `{"message": "The per page field must not be greater than 100.", "errors": {"per_page": ["The per page field must not be greater than 100."]}}` | Pagination outside the allowed range |

---

## POST /api/v1/customer/addresses

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/DatabaseFlow.md` §3 (`customer_addresses`)
- `specification/LogicFlow.md` §5 (delivery address selection)

### Method

`POST`

### Path

`/api/v1/customer/addresses`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (creates a row in their own address book).

### Request

| Field | Rules |
| --- | --- |
| `contact_name` | required, string, max 255 |
| `phone` | required, string, max 50 |
| `city` | required, string, max 100 |
| `township` | required, string, max 100 |
| `ward` | nullable, string, max 100 |
| `street` | nullable, string, max 255 |
| `building_no` | nullable, string, max 100 |
| `landmark` | nullable, string, max 255 |
| `full_address` | required, string, max 2000 |
| `is_default` | nullable, boolean |

```json
{
  "contact_name": "Kyaw Kyaw",
  "phone": "0987654321",
  "city": "Yangon",
  "township": "Bahan",
  "ward": "9",
  "street": "University Avenue",
  "building_no": "No. 45",
  "landmark": "Opposite the park",
  "full_address": "No. 45, University Avenue, 9 Ward, Bahan, Yangon",
  "is_default": false
}
```

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "address": {
      "id": 4,
      "customer_id": 12,
      "contact_name": "Kyaw Kyaw",
      "phone": "0987654321",
      "city": "Yangon",
      "township": "Bahan",
      "ward": "9",
      "street": "University Avenue",
      "building_no": "No. 45",
      "landmark": "Opposite the park",
      "full_address": "No. 45, University Avenue, 9 Ward, Bahan, Yangon",
      "is_default": true,
      "created_at": "2026-10-18T10:00:00+00:00"
    }
  },
  "message": "Address created successfully."
}
```

Notes:

- The first address for a customer becomes the default automatically, even when `is_default` is `false` or omitted.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `422` | `{"message": "The township field is required.", "errors": {"township": ["The township field is required."]}}` | Validation failure |

---

## GET /api/v1/customer/addresses/{address}

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/DatabaseFlow.md` §3 (`customer_addresses`)

### Method

`GET`

### Path

`/api/v1/customer/addresses/{address}`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own address only).

### Request

No body, no query parameters. `{address}` is the address id.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "address": {
      "id": 4,
      "customer_id": 12,
      "contact_name": "Kyaw Kyaw",
      "phone": "0987654321",
      "city": "Yangon",
      "township": "Bahan",
      "ward": "9",
      "street": "University Avenue",
      "building_no": "No. 45",
      "landmark": "Opposite the park",
      "full_address": "No. 45, University Avenue, 9 Ward, Bahan, Yangon",
      "is_default": true,
      "created_at": "2026-10-18T10:00:00+00:00"
    }
  }
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Address not found."}` | Unknown id, or the address belongs to another customer |

---

## PUT /api/v1/customer/addresses/{address}

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/DatabaseFlow.md` §3 (`customer_addresses`)

### Method

`PUT`

### Path

`/api/v1/customer/addresses/{address}`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own address only).

### Request

The payload replaces the address and uses the same rules as `POST /api/v1/customer/addresses`.

| Field | Rules |
| --- | --- |
| `contact_name` | required, string, max 255 |
| `phone` | required, string, max 50 |
| `city` | required, string, max 100 |
| `township` | required, string, max 100 |
| `ward` | nullable, string, max 100 |
| `street` | nullable, string, max 255 |
| `building_no` | nullable, string, max 100 |
| `landmark` | nullable, string, max 255 |
| `full_address` | required, string, max 2000 |
| `is_default` | nullable, boolean |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "address": {
      "id": 4,
      "customer_id": 12,
      "contact_name": "Kyaw Kyaw",
      "phone": "0987654321",
      "city": "Yangon",
      "township": "Bahan",
      "ward": "9",
      "street": "University Avenue",
      "building_no": "No. 45",
      "landmark": "Opposite the park",
      "full_address": "No. 45, University Avenue, 9 Ward, Bahan, Yangon",
      "is_default": true,
      "created_at": "2026-10-18T10:00:00+00:00"
    }
  },
  "message": "Address updated successfully."
}
```

Notes:

- Setting `is_default` to `true` demotes the previous default address in the same transaction.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Address not found."}` | Unknown id, or the address belongs to another customer |
| `422` | `{"message": "The township field is required.", "errors": {"township": ["The township field is required."]}}` | Validation failure |

---

## DELETE /api/v1/customer/addresses/{address}

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/DatabaseFlow.md` §3 (`customer_addresses`)

### Method

`DELETE`

### Path

`/api/v1/customer/addresses/{address}`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own address only).

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": null,
  "message": "Address deleted successfully."
}
```

Notes:

- Deleting the default address promotes the newest remaining address to default.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Address not found."}` | Unknown id, or the address belongs to another customer |

---

## GET /api/v1/customer/quotation-requests

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/LogicFlow.md` §5 (Quotation Request)
- `specification/DatabaseFlow.md` §3 (`quotation_requests`)
- `specification/RolesPermissions.md` §2 (Customer)

### Method

`GET`

### Path

`/api/v1/customer/quotation-requests`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own requests only).

### Request

Query parameters (all optional):

| Parameter | Rules |
| --- | --- |
| `page` | integer, min 1, default 1 |
| `per_page` | integer 1–100, default 15 |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_requests": [
      {
        "id": 31,
        "quotation_number": "QT-2026-0031",
        "status": "CUSTOMER_REVIEWING",
        "customer_name": "Aung Aung",
        "phone": "09123456789",
        "city": "Yangon",
        "township": "Hlaing",
        "item_count": 2,
        "created_at": "2026-10-18T10:30:00+00:00",
        "current_quotation_id": 71,
        "current_version": 1,
        "current_status": "VIEWED",
        "valid_until": "2026-10-27",
        "is_expired": false
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
}
```

Notes:

- Ordered by `id` descending (newest first).
- Only the authenticated customer's requests are returned.
- `current_*`, `valid_until` and `is_expired` describe the current quotation version (`is_current = true`). They are `null`/`false` while no version is current.
- `is_expired` is computed at request time from `valid_until` (date-only; the quotation is valid through the end of that day). Listing does not persist `EXPIRED`; the explicit view endpoint does.
- The pagination envelope is unchanged.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `422` | `{"message": "The per page field must not be greater than 100.", "errors": {"per_page": ["The per page field must not be greater than 100."]}}` | Pagination outside the allowed range |

---

## POST /api/v1/customer/quotation-requests

### Task

Task 06 — Customer Quotation Request.

### Specification

- `specification/LogicFlow.md` §5 (Quotation Request)
- `specification/DatabaseFlow.md` §3 (`quotation_requests`, `quotation_items`)
- `specification/MoneyAndValidationRules.md` §5 (quotation request validation)
- `specification/RolesPermissions.md` §2 (Customer)

### Method

`POST`

### Path

`/api/v1/customer/quotation-requests`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer. The owner is always the authenticated customer; a body-supplied `customer_id` is ignored.

### Request

| Field | Rules |
| --- | --- |
| `items` | required, array, min 1 |
| `items.*.product_id` | required, integer, exists on `products.id`, must be `PUBLISHED` and not `OUT_OF_STOCK` |
| `items.*.quantity` | required, integer, min 1, at least the product's `minimum_order_quantity` |
| `name` | required, string, max 255 |
| `phone` | required, string, max 50 |
| `company_name` | nullable, string, max 255 |
| `email` | nullable, valid email, max 255 |
| `city` | required, string, max 100 |
| `township` | nullable, string, max 100 |
| `delivery_address` | required, string, max 2000 |
| `landmark` | nullable, string, max 255 |
| `required_delivery_date` | nullable, date, today or later |
| `customer_note` | nullable, string, max 2000 |

Each product may appear only once. Per-item failures are keyed as `items.{index}.product_id` or `items.{index}.quantity`.

```json
{
  "items": [
    { "product_id": 15, "quantity": 3 }
  ],
  "name": "Aung Aung",
  "phone": "09123456789",
  "company_name": "Aung Trading Co., Ltd.",
  "email": "aung@example.com",
  "city": "Yangon",
  "township": "Hlaing",
  "delivery_address": "No. 123, Main Road, Hlaing Township",
  "landmark": "Near Thingaha Hotel",
  "required_delivery_date": "2026-10-28",
  "customer_note": "Please include bulk pricing where applicable."
}
```

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "customer_id": 12,
      "customer_name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "phone": "09123456789",
      "email": "aung@example.com",
      "delivery_address": "No. 123, Main Road, Hlaing Township",
      "city": "Yangon",
      "township": "Hlaing",
      "landmark": "Near Thingaha Hotel",
      "required_delivery_date": "2026-10-28",
      "customer_note": "Please include bulk pricing where applicable.",
      "status": "NEW",
      "items": [
        {
          "product_id": 15,
          "product_name_snapshot": "Plastic Chair",
          "specification_snapshot": "Blue, 45 cm",
          "quantity": 3,
          "display_price": 9000,
          "stock_status": "IN_STOCK"
        }
      ]
    }
  },
  "message": "Quotation request submitted successfully."
}
```

Notes:

- The quotation number follows `{prefix}-YYYY-####`; the prefix comes from the `quotation_number_prefix` master setting (default `QT`).
- Product name, specification, supplier, display price and stock status are snapshotted at submission time and never refreshed afterwards.
- `display_price` is the discount price when it is a real discount, otherwise the retail price; it may be `null` when the product has no price row.
- The request and all item snapshots are persisted in one transaction.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `422` | `{"message": "The items field is required.", "errors": {"items": ["The items field is required."]}}` | Validation failure; nothing is persisted |
| `422` | `{"message": "The selected product is not available for quotation requests.", "errors": {"items.0.product_id": ["The selected product is not available for quotation requests."]}}` | Product unpublished or out of stock |

---

## GET /api/v1/customer/quotation-requests/{quotationRequest}

### Task

Task 08 — Customer Quotation View and Actions.

### Specification

- `specification/LogicFlow.md` §8 (Customer Reviews Quotation)
- `specification/StatusDefinitions.md` §4–§6 (quotation request/version statuses, quotation actions)
- `specification/RolesPermissions.md` §3 (authenticated customer ownership)

### Method

`GET`

### Path

`/api/v1/customer/quotation-requests/{quotationRequest}`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own requests only). A request belonging to another customer answers `404` so its existence is not leaked.

### Request

No body or query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "QUOTATION_SENT",
      "customer_name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "phone": "09123456789",
      "email": "aung@example.com",
      "city": "Yangon",
      "township": "Hlaing",
      "landmark": "Near Thingaha Hotel",
      "delivery_address": "No. 123, Main Road, Hlaing Township",
      "required_delivery_date": "2026-10-28",
      "customer_note": "Please include bulk pricing where applicable.",
      "created_at": "2026-10-18T10:30:00+00:00",
      "items": [
        {
          "product_id": 15,
          "supplier_id": 3,
          "product_name_snapshot": "Plastic Chair",
          "specification_snapshot": "Blue, 45 cm",
          "quantity": 3,
          "display_price": 9000,
          "stock_status": "IN_STOCK"
        }
      ],
      "current_quotation_id": 71,
      "order": null,
      "is_expired": false,
      "can_accept": true,
      "can_reject": true,
      "can_request_change": true,
      "versions": [
        {
          "id": 71,
          "version": 2,
          "status": "VIEWED",
          "is_current": true,
          "is_expired": false,
          "valid_until": "2026-10-27",
          "delivery_date": "2026-10-25",
          "subtotal": 270000,
          "discount_amount": 0,
          "delivery_fee": 5000,
          "service_fee_percentage": 5,
          "service_fee": 13500,
          "total_amount": 288500,
          "cod_terms": "Full payment on delivery (COD).",
          "admin_note": "Prices confirmed with supplier.",
          "sent_at": "2026-10-20T11:01:00+00:00",
          "items": [
            {
              "id": 201,
              "product_id": 15,
              "supplier_id": 3,
              "product_name_snapshot": "Plastic Chair",
              "sku_snapshot": "CHAIR-001",
              "specification_snapshot": "Blue, 45 cm",
              "quantity": 3,
              "unit_price": 90000,
              "discount": 0,
              "line_total": 270000,
              "delivery_date": "2026-10-25",
              "warranty_note": "6 months",
              "supplier_note": "Confirmed stock"
            }
          ],
          "actions": [
            {
              "action": "VIEWED",
              "customer_note": null,
              "actor_type": "CUSTOMER",
              "actor_id": 12,
              "created_at": "2026-10-21T09:00:00+00:00"
            }
          ]
        }
      ]
    }
  }
}
```

Notes:

- `versions` is newest version first. Admin `DRAFT` versions are never exposed to the customer (`StatusDefinitions.md` §5); a version appears here only after it has been sent.
- Request `items` are the immutable request-time snapshots.
- Version-level `delivery_date` is derived from the item snapshots as the latest item delivery date.
- `cod_terms` is the stored quotation `payment_terms` text.
- `is_expired` and the `can_*` flags are computed at request time. This endpoint is side-effect free: it never writes `EXPIRED`, `VIEWED` or an action row.
- `can_accept`, `can_reject` and `can_request_change` are true only for an owned current version in `SENT`/`VIEWED`, not expired, while the request is in `QUOTATION_SENT`/`CUSTOMER_REVIEWING`.
- `order` is `null` until the customer accepts the current quotation. After acceptance it contains the created order summary (`id`, `order_number`, `order_status`, `payment_status`, `delivery_status`, `total_amount`, `created_at`) from `Quotation::order()`. Only the order belonging to the current quotation of the owned request is exposed; a request owned by another customer still answers `404`.
- `actor_type` is `CUSTOMER` (append-only action trail, same convention as the admin workflow tables).

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Quotation request not found."}` | Unknown id or the request belongs to another customer |

---

## POST /api/v1/customer/quotation-requests/{quotationRequest}/view

### Task

Task 08 — Customer Quotation View and Actions.

### Specification

- `specification/LogicFlow.md` §8 (Customer Reviews Quotation), §13 (expiry evaluated at API request time)
- `specification/StatusDefinitions.md` §10 (Quotation Request and Quotation Version transition tables)
- `specification/RolesPermissions.md` §3

### Method

`POST`

### Path

`/api/v1/customer/quotation-requests/{quotationRequest}/view`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own requests only). Foreign requests answer `404`.

### Request

No body.

Inside one transaction the current version is locked and:

1. If the current version is `SENT` and not expired, it becomes `VIEWED` with `viewed_at=now()`.
2. If the request is `QUOTATION_SENT`, it moves to `CUSTOMER_REVIEWING`. Newer request statuses are never regressed.
3. Exactly one `VIEWED` action row is appended. Repeat calls add no duplicate.
4. If the current version is expired (`valid_until` before today) and is `SENT`/`VIEWED`, the version and request are lazily persisted as `EXPIRED` through the transition table. No `VIEWED` action is written for expiry.

### Success response

`200 OK`

Returns exactly the same `data.quotation_request` payload as the detail endpoint, so the frontend can load the detail through this call.

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "status": "CUSTOMER_REVIEWING",
      "current_quotation_id": 71,
      "order": null,
      "is_expired": false,
      "can_accept": true,
      "can_reject": true,
      "can_request_change": true,
      "versions": [
        {
          "id": 71,
          "version": 1,
          "status": "VIEWED",
          "actions": [
            {
              "action": "VIEWED",
              "customer_note": null,
              "actor_type": "CUSTOMER",
              "actor_id": 12,
              "created_at": "2026-10-21T09:00:00+00:00"
            }
          ]
        }
      ]
    }
  }
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Quotation request not found."}` | Unknown id or the request belongs to another customer |
| `409` | `{"success": false, "message": "..."}` | A status transition would violate `StatusDefinitions.md` §10 (should not occur for valid stored state) |

---

## POST /api/v1/customer/quotations/{quotation}/accept

### Task

Task 08 — Customer Quotation View and Actions, extended by Task 09 — Transactional Order Conversion and Supplier Confirmation. Accepting a valid current quotation now converts it into exactly one order.

### Specification

- `specification/LogicFlow.md` §8 (Customer Reviews Quotation), §9 (Convert Accepted Quotation to Order), §16 (Transaction Boundaries)
- `specification/StatusDefinitions.md` §5, §6, §7, §10
- `specification/MoneyAndValidationRules.md` §7 (Order Conversion Validation)
- `specification/DatabaseFlow.md` §3 (`orders`, `order_items`, `deliveries`, `cash_payments`, `order_status_histories`)
- `specification/RolesPermissions.md` §2–§3 (own current quotation only)

### Method

`POST`

### Path

`/api/v1/customer/quotations/{quotation}/accept`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own current quotation only). A foreign quotation answers `404`.

### Request

| Field | Rules |
| --- | --- |
| `cod_terms_accepted` | required, boolean, must be accepted (`true`) |

```json
{
  "cod_terms_accepted": true
}
```

Inside one transaction the quotation row is locked and re-checked: `is_current = true`, status `SENT`/`VIEWED`, not expired, and request status `QUOTATION_SENT`/`CUSTOMER_REVIEWING`. On success the quotation becomes `ACCEPTED` (`accepted_at=now()`), the request becomes `ACCEPTED`, and exactly one `ACCEPTED` action row is appended with `actor_type: "CUSTOMER"`, the authenticated customer id and the request IP.

The same transaction converts the accepted version into one order:

- Order identity and customer snapshots come from the authenticated Customer and the quotation request (name, company, phone, email, delivery address, city, township, landmark, customer note).
- Money values are copied from the accepted quotation version without recalculation: `subtotal`, `discount`, `delivery_fee`, `service_fee_percentage`, `service_fee`, `total_amount`.
- The order starts at `order_status = SUPPLIER_CONFIRMATION_REQUIRED`, `payment_status = NOT_PAID`, `delivery_status = NOT_ASSIGNED`, `payment_method = CASH_ON_DELIVERY`.
- `order_items` are copied only from `quotation_version_items` (never from `quotation_items`).
- One delivery is created with `delivery_status = NOT_ASSIGNED`. Its `supplier_id` is set only when every order item shares one supplier; otherwise it is `null`.
- One `cash_payments` row is created with `amount_due = total_amount`, `amount_collected = 0`, `amount_remaining = total_amount`, `status = NOT_PAID`, and a `RCP-YYYY-####` receipt document number.
- One `order_status_histories` row is appended with `old_status = null`, `new_status = SUPPLIER_CONFIRMATION_REQUIRED`, `changed_by_type = "CUSTOMER"`, the authenticated customer id and the note `Order created from accepted quotation {quotation_number} v{version}.`

`order_number` format is `ORD-YYYY-####` (prefix from the `order_number_prefix` setting); `receipt_number` format is `RCP-YYYY-####`. Both are derived from the persisted row id.

A second concurrent/sequential accept sees `ACCEPTED`, or an existing order for the same quotation, and answers `409`; only one order and one action row exist. The unique `orders.quotation_id` index is the final concurrency guard. Any failure after partial writes rolls the whole transaction back: no order, order item, delivery, payment or history rows remain, and the quotation/request keep their prior statuses.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": {
      "id": 71,
      "version": 1,
      "status": "ACCEPTED",
      "total_amount": 288500,
      "valid_until": "2026-10-27"
    },
    "request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "ACCEPTED"
    },
    "order": {
      "id": 14,
      "order_number": "ORD-2026-0014",
      "order_status": "SUPPLIER_CONFIRMATION_REQUIRED",
      "payment_status": "NOT_PAID",
      "delivery_status": "NOT_ASSIGNED",
      "total_amount": 288500,
      "created_at": "2026-10-24T09:15:00+00:00"
    }
  },
  "message": "Quotation accepted."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Quotation not found."}` | Unknown id or the quotation belongs to another customer |
| `422` | `{"message": "The cod terms accepted field must be accepted.", "errors": {"cod_terms_accepted": ["The cod terms accepted field must be accepted."]}}` | Missing or false COD acknowledgement |
| `409` | `{"success": false, "message": "This quotation has expired."}` | `valid_until` is before today |
| `409` | `{"success": false, "message": "This quotation version is no longer current."}` | `is_current = false` (superseded or historical version) |
| `409` | `{"success": false, "message": "This quotation is no longer open for customer response."}` | Version is `ACCEPTED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `CHANGE_REQUESTED` or `DRAFT` |
| `409` | `{"success": false, "message": "The quotation request is not open for customer review."}` | Request is not in `QUOTATION_SENT`/`CUSTOMER_REVIEWING` |
| `409` | `{"success": false, "message": "An order already exists for this quotation."}` | A second accept or a concurrent duplicate insert for the same quotation version |

---

## POST /api/v1/customer/quotations/{quotation}/reject

### Task

Task 08 — Customer Quotation View and Actions.

### Specification

- `specification/LogicFlow.md` §8
- `specification/StatusDefinitions.md` §5, §6, §10
- `specification/RolesPermissions.md` §2–§3

### Method

`POST`

### Path

`/api/v1/customer/quotations/{quotation}/reject`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own current quotation only). A foreign quotation answers `404`.

### Request

| Field | Rules |
| --- | --- |
| `customer_note` | nullable, string, max 2000 |

```json
{
  "customer_note": "Price is too high for this quantity."
}
```

The same eligibility guards as accept apply (owned, `is_current`, not expired, version `SENT`/`VIEWED`, request `QUOTATION_SENT`/`CUSTOMER_REVIEWING`). The quotation becomes `REJECTED` (`rejected_at=now()`), the request becomes `REJECTED`, and one `REJECTED` action row is appended with the optional note.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": {
      "id": 71,
      "version": 1,
      "status": "REJECTED",
      "total_amount": 288500,
      "valid_until": "2026-10-27"
    },
    "request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "REJECTED"
    }
  },
  "message": "Quotation rejected."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Quotation not found."}` | Unknown id or another customer's quotation |
| `422` | `{"message": "The customer note field must not be greater than 2000 characters.", "errors": {"customer_note": ["..."]}}` | Note too long |
| `409` | `{"success": false, "message": "This quotation has expired."}` | Expired quotation |
| `409` | `{"success": false, "message": "This quotation version is no longer current."}` | Superseded/historical version |
| `409` | `{"success": false, "message": "This quotation is no longer open for customer response."}` | Already settled version |
| `409` | `{"success": false, "message": "The quotation request is not open for customer review."}` | Request no longer reviewable |

---

## POST /api/v1/customer/quotations/{quotation}/change-request

### Task

Task 08 — Customer Quotation View and Actions.

### Specification

- `specification/LogicFlow.md` §8 (customer note goes to Admin; request becomes `CHANGE_REQUESTED`)
- `specification/StatusDefinitions.md` §5, §6, §10
- `specification/RolesPermissions.md` §2–§3

### Method

`POST`

### Path

`/api/v1/customer/quotations/{quotation}/change-request`

### Authentication

Required. `auth:sanctum` bearer token with the `customer` ability.

### Roles

Customer (own current quotation only). A foreign quotation answers `404`.

### Request

| Field | Rules |
| --- | --- |
| `customer_note` | required, string, max 2000 |

```json
{
  "customer_note": "Please reduce the quantity to one unit."
}
```

Guards match accept/reject, but an expired quotation cannot request a change (`409`). On success the quotation becomes `CHANGE_REQUESTED`, the request becomes `CHANGE_REQUESTED`, and one `REQUESTED_CHANGE` action row is appended with the note. Admin can then create a new draft version (existing Admin workflow is unchanged).

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": {
      "id": 71,
      "version": 1,
      "status": "CHANGE_REQUESTED",
      "total_amount": 288500,
      "valid_until": "2026-10-27"
    },
    "request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "CHANGE_REQUESTED"
    }
  },
  "message": "Quotation change requested."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"success": false, "message": "Unauthenticated."}` | Missing, invalid or expired bearer token |
| `403` | `{"success": false, "message": "Forbidden. Customer access required."}` | Admin token or token without the `customer` ability |
| `404` | `{"success": false, "message": "Quotation not found."}` | Unknown id or another customer's quotation |
| `422` | `{"message": "The customer note field is required.", "errors": {"customer_note": ["The customer note field is required."]}}` | Missing note |
| `409` | `{"success": false, "message": "This quotation has expired."}` | Expired quotation |
| `409` | `{"success": false, "message": "This quotation version is no longer current."}` | Superseded/historical version |
| `409` | `{"success": false, "message": "This quotation is no longer open for customer response."}` | Already settled version |
| `409` | `{"success": false, "message": "The quotation request is not open for customer review."}` | Request no longer reviewable |

---

## Task 07 Admin Quotation Workflow — shared shapes

All endpoints below require an active Admin token (`auth:sanctum` + `admin` ability). Money values are integer MMK. The server calculates `line_total`, `subtotal`, `service_fee` and `total_amount`; client-supplied totals are ignored.

Quotation request statuses:

`NEW`, `CONTACTING_SUPPLIER`, `SUPPLIER_RESPONSE_PENDING`, `PREPARING_QUOTATION`, `QUOTATION_SENT`, `CUSTOMER_REVIEWING`, `CHANGE_REQUESTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`.

Quotation version statuses:

`DRAFT`, `SENT`, `VIEWED`, `CHANGE_REQUESTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `CANCELLED`.

Shared Admin request summary shape:

```json
{
  "id": 31,
  "quotation_number": "QT-2026-0031",
  "customer_id": 12,
  "customer_name": "Aung Aung",
  "company_name": "Aung Trading Co., Ltd.",
  "phone": "09123456789",
  "email": "aung@example.com",
  "city": "Yangon",
  "township": "Hlaing",
  "status": "NEW",
  "item_count": 2,
  "assigned_admin": { "id": 4, "name": "Daw Admin" },
  "required_delivery_date": "2026-10-28",
  "created_at": "2026-10-20T10:00:00+00:00"
}
```

Shared quotation version shape:

```json
{
  "id": 71,
  "quotation_request_id": 31,
  "quotation_number": "QT-2026-0031",
  "version": 1,
  "status": "DRAFT",
  "is_current": false,
  "subtotal": 270000,
  "discount": 0,
  "delivery_fee": 5000,
  "service_fee_percentage": 5,
  "service_fee": 13500,
  "total_amount": 288500,
  "payment_method": "CASH_ON_DELIVERY",
  "payment_terms": "Full payment on delivery (COD).",
  "valid_until": "2026-10-27",
  "admin_note": "Prices confirmed with supplier.",
  "sent_at": null,
  "viewed_at": null,
  "accepted_at": null,
  "rejected_at": null,
  "created_at": "2026-10-20T11:00:00+00:00",
  "created_by_admin": { "id": 4, "name": "Daw Admin" },
  "items": [
    {
      "id": 201,
      "product_id": 15,
      "supplier_id": 3,
      "product_name_snapshot": "Plastic Chair",
      "sku_snapshot": "CHAIR-001",
      "specification_snapshot": "Blue, 45 cm",
      "quantity": 3,
      "unit_price": 90000,
      "discount": 0,
      "line_total": 270000,
      "delivery_date": "2026-10-25",
      "warranty_note": "6 months",
      "supplier_note": "Confirmed stock",
      "supplier": { "id": 3, "shop_name": "Yangon Trading" }
    }
  ],
  "pdfs": [
    {
      "id": 41,
      "file_name": "QT-2026-0031-v1.pdf",
      "generated_at": "2026-10-20T11:01:00+00:00",
      "download_url": "/admin/quotations/71/pdf/download",
      "generated_by_admin": { "id": 4, "name": "Daw Admin" }
    }
  ],
  "email_logs": [
    {
      "id": 11,
      "recipient_email": "aung@example.com",
      "email_type": "QUOTATION_SENT",
      "subject": "Quotation QT-2026-0031 version 1",
      "status": "SENT",
      "sent_at": "2026-10-20T11:01:02+00:00",
      "error_message": null,
      "created_at": "2026-10-20T11:01:02+00:00"
    }
  ]
}
```

---

## GET /api/v1/admin/admins

### Task

Task 07 — Admin Quotation Workflow, Service Fee, and PDF Builder.

### Method / Path

`GET /api/v1/admin/admins`

### Authentication

Required. Admin token.

### Request

No body, no query parameters.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "admins": [
      { "id": 4, "name": "Daw Admin", "email": "admin@example.com", "role": "admin" }
    ]
  }
}
```

Only active Admins are returned, ordered by name. Used to populate assignment controls.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Non-admin token |

---

## GET /api/v1/admin/quotation-requests

### Task

Task 07 — Admin Quotation Workflow.

### Method / Path

`GET /api/v1/admin/quotation-requests`

### Authentication

Required. Admin token.

### Request

Optional query parameters:

| Parameter | Rules | Description |
| --- | --- | --- |
| `status` | one of the request statuses | Exact status filter |
| `assigned_admin_id` | existing Admin id | Requests assigned to that Admin |
| `unassigned` | boolean (`1`, `0`, `true`, `false`) | Only unassigned requests |
| `search` | string, max 100 | Matches number, customer, company, phone, email |
| `per_page` | integer, 1–100, default 15 | Page size |
| `page` | integer | Page number |

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_requests": [
      {
        "id": 31,
        "quotation_number": "QT-2026-0031",
        "customer_id": 12,
        "customer_name": "Aung Aung",
        "company_name": "Aung Trading Co., Ltd.",
        "phone": "09123456789",
        "email": "aung@example.com",
        "city": "Yangon",
        "township": "Hlaing",
        "status": "NEW",
        "item_count": 2,
        "assigned_admin": null,
        "required_delivery_date": "2026-10-28",
        "created_at": "2026-10-20T10:00:00+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "last_page": 1,
      "per_page": 15,
      "total": 1
    },
    "statuses": ["NEW", "CONTACTING_SUPPLIER", "SUPPLIER_RESPONSE_PENDING", "PREPARING_QUOTATION", "QUOTATION_SENT", "CUSTOMER_REVIEWING", "CHANGE_REQUESTED", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
    "service_fee_default_percentage": 5
  }
}
```

Notes:

- Newest requests are returned first.
- The list does not load request items, supplier groups, communications or quotation versions.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Non-admin token |
| `422` | Laravel validation shape | Invalid filter value |

---

## GET /api/v1/admin/quotation-requests/{quotationRequest}

### Task

Task 07 — Admin Quotation Workflow.

### Method / Path

`GET /api/v1/admin/quotation-requests/{quotationRequest}`

### Authentication

Required. Admin token.

### Request

No body.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "customer_id": 12,
      "customer_name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "phone": "09123456789",
      "email": "aung@example.com",
      "delivery_address": "No. 123, Main Road, Hlaing Township",
      "city": "Yangon",
      "township": "Hlaing",
      "landmark": "Near Thingaha Hotel",
      "required_delivery_date": "2026-10-28",
      "customer_note": "Please include bulk pricing where applicable.",
      "status": "PREPARING_QUOTATION",
      "item_count": 2,
      "assigned_admin": { "id": 4, "name": "Daw Admin" },
      "created_at": "2026-10-20T10:00:00+00:00",
      "updated_at": "2026-10-20T11:00:00+00:00",
      "items": [
        {
          "product_id": 15,
          "supplier_id": 3,
          "product_name_snapshot": "Plastic Chair",
          "specification_snapshot": "Blue, 45 cm",
          "quantity": 3,
          "display_price": 9000,
          "stock_status": "IN_STOCK",
          "sku": "CHAIR-001",
          "supplier": { "id": 3, "shop_name": "Yangon Trading" }
        }
      ],
      "suppliers": [
        {
          "supplier": {
            "id": 3,
            "shop_name": "Yangon Trading",
            "contact_person": "U Tun",
            "phone": "09-111-222-333",
            "viber_phone": "09-111-222-333",
            "email": "supplier@example.com",
            "delivery_time": "3–5 days",
            "warranty_policy": "6 months"
          },
          "items": [],
          "communications": []
        }
      ],
      "communications": [],
      "quotations": [],
      "current_quotation": null
    },
    "service_fee_default_percentage": 5,
    "quotation_validity_days": 7,
    "default_delivery_fee": 5000,
    "admins": [
      { "id": 4, "name": "Daw Admin", "email": "admin@example.com", "role": "admin" }
    ]
  }
}
```

Notes:

- Request items are immutable snapshots from the customer submission.
- `suppliers[].items` contains the same item objects grouped by supplier.
- Communications are append-only and newest first.
- Quotation versions are newest version first; `current_quotation` is the current sent version when one exists.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing/invalid/revoked token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Non-admin token |
| `404` | `{"message": "No query results for model [App\\Models\\QuotationRequest] 31"}` | Unknown request id |

---

## PATCH /api/v1/admin/quotation-requests/{quotationRequest}/assignment

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

`Content-Type: application/json`

```json
{ "assigned_admin_id": 4 }
```

Send `null` to unassign:

```json
{ "assigned_admin_id": null }
```

`assigned_admin_id` must reference an existing Admin.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "NEW",
      "assigned_admin": { "id": 4, "name": "Daw Admin" }
    }
  },
  "message": "Quotation request assignment updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Laravel validation shape | Unknown Admin id |
| `404` | Not found | Unknown request id |

---

## PATCH /api/v1/admin/quotation-requests/{quotationRequest}/status

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

`Content-Type: application/json`

```json
{ "status": "CONTACTING_SUPPLIER" }
```

Only transitions allowed by the quotation-request status graph are accepted. For example `NEW → CONTACTING_SUPPLIER`, `CONTACTING_SUPPLIER → PREPARING_QUOTATION`, and `QUOTATION_SENT → CUSTOMER_REVIEWING`. Sending a quotation version also moves the request to `QUOTATION_SENT` automatically.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation_request": {
      "id": 31,
      "quotation_number": "QT-2026-0031",
      "status": "CONTACTING_SUPPLIER",
      "assigned_admin": { "id": 4, "name": "Daw Admin" }
    }
  },
  "message": "Quotation request status updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `409` | `{"success": false, "message": "Invalid status transition for [quotation_request]: [NEW] -> [ACCEPTED]."}` | Transition not allowed |
| `422` | Laravel validation shape | Unknown status value |
| `404` | Not found | Unknown request id |

---

## POST /api/v1/admin/quotation-requests/{quotationRequest}/communications

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

`Content-Type: multipart/form-data`

| Field | Rules |
| --- | --- |
| `supplier_id` | required, existing supplier that owns at least one request item |
| `contact_method` | required: `VIBER`, `PHONE`, `EMAIL`, `TELEGRAM`, `OTHER` |
| `message_text` | nullable, string, max 5000 |
| `supplier_response` | nullable, string, max 5000 |
| `contacted_at` | nullable, date, defaults to now |
| `responded_at` | nullable, date, after/equal `contacted_at`; defaults to now when a response is present |
| `attachment` | nullable file: PDF, JPG, JPEG, PNG, WebP, max 5 MB |

The response text can record confirmed price, stock, delivery and warranty details. The log is append-only.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "communication": {
      "id": 88,
      "supplier_id": 3,
      "contact_method": "VIBER",
      "message_text": "Can you confirm 3 chairs and delivery date?",
      "supplier_response": "Confirmed 3 pcs at 90,000 MMK each; delivery in 5 days.",
      "attachment_path": "supplier-communications/31/quote.pdf",
      "attachment_url": "/admin/files/supplier-communications/31/quote.pdf",
      "contacted_at": "2026-10-20T11:00:00+00:00",
      "responded_at": "2026-10-20T11:05:00+00:00",
      "created_at": "2026-10-20T11:05:00+00:00",
      "admin": { "id": 4, "name": "Daw Admin" }
    },
    "request_status": "CONTACTING_SUPPLIER"
  },
  "message": "Supplier communication logged."
}
```

Status effect:

- A response present moves the request toward `CONTACTING_SUPPLIER`.
- No response moves it toward `SUPPLIER_RESPONSE_PENDING`.
- The movement follows valid transition paths; no history row is updated.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Laravel validation shape | Supplier not in request, unsupported file or invalid dates |
| `404` | Not found | Unknown request id |

---

## POST /api/v1/admin/quotation-requests/{quotationRequest}/quotations

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

`Content-Type: application/json`

```json
{
  "items": [
    {
      "product_id": 15,
      "quantity": 3,
      "unit_price": 90000,
      "discount": 0,
      "delivery_date": "2026-10-25",
      "warranty_note": "6 months",
      "supplier_note": "Confirmed stock"
    }
  ],
  "discount": 0,
  "delivery_fee": 5000,
  "service_fee_percentage": 5,
  "payment_method": "CASH_ON_DELIVERY",
  "payment_terms": "Full payment on delivery (COD).",
  "valid_until": "2026-10-27",
  "admin_note": "Prices confirmed with supplier."
}
```

Rules:

- `items` required, min 1; each `product_id` must exist and be distinct.
- `quantity` and `unit_price` required integers, min 1.
- `discount` per line and at quotation level nullable integers, min 0; line discount cannot exceed `quantity × unit_price`.
- `service_fee_percentage` nullable integer 0–100; when omitted/`null` the current Master Setting default is used.
- `valid_until` nullable date, today or later; defaults to today + `quotation_validity_days`.
- `payment_method` may only be `CASH_ON_DELIVERY`.
- `payment_terms` nullable max 1000; defaults to COD terms.

Server formula:

```text
line_total = quantity × unit_price − line_discount
subtotal = sum(line_total)
service_fee = round(subtotal × service_fee_percentage / 100)
total_amount = subtotal − discount + delivery_fee + service_fee
```

The new version starts as `DRAFT`, is not current, and snapshots product name, SKU, specification and supplier from the server data.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "quotation": {
      "id": 71,
      "quotation_request_id": 31,
      "quotation_number": "QT-2026-0031",
      "version": 1,
      "status": "DRAFT",
      "is_current": false,
      "subtotal": 270000,
      "service_fee_percentage": 5,
      "service_fee": 13500,
      "total_amount": 288500,
      "items": [],
      "pdfs": [],
      "email_logs": []
    }
  },
  "message": "Quotation draft created."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Laravel validation shape | Invalid item, fee, date or discount |
| `422` | `{"message": "A new version cannot be created for a closed request.", "errors": {"quotation_request": ["A new version cannot be created for a closed request."]}}` | Request is accepted, rejected or cancelled |
| `404` | Not found | Unknown request id |

---

## GET /api/v1/admin/quotations/{quotation}

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Method / Path

`GET /api/v1/admin/quotations/{quotation}`

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": { "...": "quotation version shape, including items, pdfs and email_logs" }
  }
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `404` | Not found | Unknown quotation version id |

---

## PUT /api/v1/admin/quotations/{quotation}

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

Same body and validation as `POST /api/v1/admin/quotation-requests/{quotationRequest}/quotations`.

Only a `DRAFT` version can be updated. Sent, accepted, superseded and historical versions are immutable.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": { "...": "updated quotation version shape" }
  },
  "message": "Quotation draft updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Laravel validation shape | Invalid details or version is not a draft |
| `404` | Not found | Unknown quotation version id |

---

## POST /api/v1/admin/quotations/{quotation}/send

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

No body.

Send one `DRAFT` version. The operation:

1. Validates the draft and moves it to `SENT`.
2. Marks previously current versions `SUPERSEDED` and clears their `is_current`.
3. Sets this version `is_current=true` and `sent_at=now()`.
4. Generates an immutable version-specific PDF.
5. Moves the request to `QUOTATION_SENT`.
6. Emails the customer and records the attempt.

Email failure does not roll back the sent quotation/PDF. The response still succeeds and the email log has `status: "FAILED"`.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "quotation": { "...": "sent quotation version shape", "status": "SENT", "is_current": true },
    "email": {
      "id": 11,
      "recipient_email": "aung@example.com",
      "email_type": "QUOTATION_SENT",
      "status": "SENT",
      "sent_at": "2026-10-20T11:01:02+00:00",
      "error_message": null
    }
  },
  "message": "Quotation sent."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Validation/envelope error | Version is not a draft or request cannot be quoted |
| `409` | Status transition error | Request path cannot reach `QUOTATION_SENT` |
| `404` | Not found | Unknown quotation version id |

---

## POST /api/v1/admin/quotations/{quotation}/resend

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

No body.

Resends the quotation email for any non-draft sent version and appends a new email-log attempt. Email failure is recorded as `FAILED` without changing version status.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "email": {
      "id": 12,
      "recipient_email": "aung@example.com",
      "email_type": "QUOTATION_SENT",
      "status": "FAILED",
      "sent_at": null,
      "error_message": "Connection could not be established.",
      "created_at": "2026-10-20T12:00:00+00:00"
    }
  },
  "message": "Quotation email resent."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `422` | Validation/envelope error | Version is a draft or customer email is missing |
| `404` | Not found | Unknown quotation version id |

---

## POST /api/v1/admin/quotations/{quotation}/pdf

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

No body.

Generates another immutable PDF for the version. Old PDF records/files are never overwritten.

### Success response

`201 Created`

```json
{
  "success": true,
  "data": {
    "pdf": {
      "id": 42,
      "file_name": "QT-2026-0031-v1-20261020-120000.pdf",
      "generated_at": "2026-10-20T12:00:00+00:00",
      "download_url": "/admin/quotations/71/pdf/download",
      "generated_by_admin": { "id": 4, "name": "Daw Admin" }
    }
  },
  "message": "Quotation PDF generated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `404` | Not found | Unknown quotation version id |

---

## GET /api/v1/admin/quotations/{quotation}/pdf/download

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

No body.

Downloads the newest PDF for the version. If no PDF exists (or the stored file is missing), a new PDF is generated first.

### Success response

`200 OK` with `Content-Type: application/pdf` and a `Content-Disposition: attachment` header. The body is the binary PDF.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `404` | Not found | Unknown quotation version id |

---

## GET /api/v1/admin/orders

### Task

Task 09 — Transactional Order Conversion and Supplier Confirmation (admin order queue).

### Specification

- `specification/LogicFlow.md` §9 (Convert Accepted Quotation to Order), §10 (Supplier Confirmation by Admin), §15 (Audit Logic)
- `specification/StatusDefinitions.md` §7 (Order Status), §10 (Order transitions)
- `specification/DatabaseFlow.md` §3 (`orders`), §5 (order list indexes)
- `specification/MoneyAndValidationRules.md` §7 (Order Conversion Validation)

### Method

`GET`

### Path

`/api/v1/admin/orders`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin).

### Request

Optional query parameters:

| Parameter | Rules | Description |
| --- | --- | --- |
| `order_status` | one of the `OrderStatus` values | Exact order status filter |
| `search` | string, max 100 | Matches `order_number`, `customer_name` or `phone` |
| `per_page` | integer, 1–100, default 15 | Page size |
| `page` | integer | Page number |

No body.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 14,
        "order_number": "ORD-2026-0014",
        "quotation_number": "QT-2026-0031",
        "customer_name": "Aung Aung",
        "phone": "09123456789",
        "order_status": "SUPPLIER_CONFIRMATION_REQUIRED",
        "payment_status": "NOT_PAID",
        "delivery_status": "NOT_ASSIGNED",
        "total_amount": 288500,
        "created_at": "2026-10-24T09:15:00+00:00"
      }
    ],
    "meta": {
      "current_page": 1,
      "last_page": 1,
      "per_page": 15,
      "total": 1
    }
  }
}
```

Notes:

- Newest orders are returned first (`created_at` desc, then `id` desc).
- The list does not load items, delivery, payment or status history; use the detail endpoint.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing, invalid or revoked bearer token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Customer token or token without the `admin` ability |
| `422` | Laravel validation shape | Invalid `order_status`, `search` or `per_page` value |

---

## GET /api/v1/admin/orders/{order}

### Task

Task 09 — Transactional Order Conversion and Supplier Confirmation (admin order detail and supplier-confirmation targets).

### Specification

- `specification/LogicFlow.md` §9, §10, §15
- `specification/StatusDefinitions.md` §7 (Order Status), §8 (Payment Status), §9 (Delivery Status), §10 (Order transitions)
- `specification/DatabaseFlow.md` §3 (`orders`, `order_items`, `deliveries`, `cash_payments`, `order_status_histories`)
- `specification/MoneyAndValidationRules.md` §4 (COD full-payment rules)

### Method

`GET`

### Path

`/api/v1/admin/orders/{order}`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin). Unknown order ids answer `404`.

### Request

No body.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "order": {
      "id": 14,
      "order_number": "ORD-2026-0014",
      "quotation_id": 71,
      "quotation_number": "QT-2026-0031",
      "quotation_request_id": 31,
      "customer_id": 12,
      "customer_name": "Aung Aung",
      "company_name": "Aung Trading Co., Ltd.",
      "phone": "09123456789",
      "email": "aung@example.com",
      "delivery_address": "No. 25, Bo Gyoke Road, Pabedan, Yangon",
      "city": "Yangon",
      "township": "Pabedan",
      "landmark": "Near Bogyoke Market",
      "subtotal": 275000,
      "discount": 5000,
      "delivery_fee": 3000,
      "service_fee_percentage": 5,
      "service_fee": 13500,
      "total_amount": 286500,
      "payment_method": "CASH_ON_DELIVERY",
      "payment_status": "NOT_PAID",
      "order_status": "SUPPLIER_CONFIRMATION_REQUIRED",
      "delivery_status": "NOT_ASSIGNED",
      "customer_note": "Please call before delivery.",
      "created_at": "2026-10-24T09:15:00+00:00",
      "updated_at": "2026-10-24T09:15:00+00:00",
      "items": [
        {
          "id": 41,
          "product_id": 8,
          "supplier_id": 3,
          "product_name_snapshot": "USB-C Fast Charger 30W",
          "sku_snapshot": "SKU-0008",
          "specification_snapshot": "30W, GaN, white",
          "quantity": 5,
          "unit_price": 25000,
          "discount": 0,
          "line_total": 125000,
          "supplier": {
            "id": 3,
            "shop_name": "Thiri Office Supply",
            "contact_person": "U Ko Ko Naing",
            "phone": "09310000003"
          }
        }
      ],
      "delivery": {
        "id": 9,
        "supplier_id": 3,
        "delivery_contact_name": "Aung Aung",
        "delivery_phone": "09123456789",
        "delivery_address": "No. 25, Bo Gyoke Road, Pabedan, Yangon",
        "city": "Yangon",
        "township": "Pabedan",
        "landmark": "Near Bogyoke Market",
        "delivery_fee": 3000,
        "delivery_partner": null,
        "tracking_number": null,
        "estimated_delivery_date": null,
        "shipped_at": null,
        "delivered_at": null,
        "received_by": null,
        "customer_note": "Please call before delivery.",
        "delivery_status": "NOT_ASSIGNED"
      },
      "cash_payment": {
        "id": 9,
        "receipt_number": "RCP-2026-0009",
        "amount_due": 286500,
        "amount_collected": 0,
        "amount_remaining": 286500,
        "status": "NOT_PAID",
        "collected_at": null
      },
      "status_histories": [
        {
          "old_status": null,
          "new_status": "SUPPLIER_CONFIRMATION_REQUIRED",
          "changed_by_type": "CUSTOMER",
          "changed_by_id": 12,
          "note": "Order created from accepted quotation QT-2026-0031 v1.",
          "created_at": "2026-10-24T09:15:00+00:00"
        }
      ],
      "quotation_request": {
        "id": 31,
        "quotation_number": "QT-2026-0031",
        "status": "ACCEPTED"
      },
      "available_statuses": ["ORDER_CONFIRMED", "SUPPLIER_UNAVAILABLE", "CANCELLED"]
    }
  }
}
```

Notes:

- `delivery` is the single MVP delivery record, or `null` if none exists.
- `cash_payment` is the COD payment document, or `null` if none exists.
- `status_histories` are returned oldest first.
- `available_statuses` contains only Task 09 supplier-confirmation targets that are valid from the current `order_status` via `StatusTransitionService`: `ORDER_CONFIRMED`, `PREPARING`, `SUPPLIER_UNAVAILABLE`, `CANCELLED`. Delivery and payment stages are never listed here.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing, invalid or revoked bearer token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Customer token or token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Order] {id}"}` | Unknown order id |

---

## PATCH /api/v1/admin/orders/{order}/status

### Task

Task 09 — Transactional Order Conversion and Supplier Confirmation (admin supplier-confirmation transitions).

### Specification

- `specification/LogicFlow.md` §10 (Supplier Confirmation by Admin), §13 (Cancellation Logic), §15 (Audit Logic)
- `specification/StatusDefinitions.md` §7 (Order Status), §10 (Order transitions)
- `specification/DatabaseFlow.md` §3 (`orders`, `order_status_histories`, `audit_logs`)

### Method

`PATCH`

### Path

`/api/v1/admin/orders/{order}/status`

### Authentication

Required. `auth:sanctum` bearer token with the `admin` ability.

### Roles

Admin (any active authenticated admin). Unknown order ids answer `404`.

### Request

| Field | Rules |
| --- | --- |
| `status` | required, one of `ORDER_CONFIRMED`, `PREPARING`, `SUPPLIER_UNAVAILABLE`, `CANCELLED` |
| `note` | nullable string, max 2000; required when `status` is `SUPPLIER_UNAVAILABLE` or `CANCELLED` |

```json
{
  "status": "SUPPLIER_UNAVAILABLE",
  "note": "Supplier confirmed the item is out of stock."
}
```

Inside one transaction the order row is locked and the current status re-read. The target must be one of the Task 09 supplier-confirmation values and must be a valid transition from the current status. Delivery and payment stages (`READY_TO_SHIP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED`, `RETURNED`, payment statuses) are rejected with `422` even where a later Task 10 workflow would allow them. On success:

- `orders.order_status` is updated.
- One `order_status_histories` row is appended with the old/new status, `changed_by_type = "ADMIN"`, the authenticated admin id and the note.
- One `audit_logs` row is written with `action = "order.status_updated"`, `entity_type = "order"`, the order id, old status and new status + note.

### Success response

`200 OK`

```json
{
  "success": true,
  "data": {
    "order": {
      "id": 14,
      "order_number": "ORD-2026-0014",
      "quotation_number": "QT-2026-0031",
      "customer_name": "Aung Aung",
      "phone": "09123456789",
      "order_status": "SUPPLIER_UNAVAILABLE",
      "payment_status": "NOT_PAID",
      "delivery_status": "NOT_ASSIGNED",
      "total_amount": 286500,
      "created_at": "2026-10-24T09:15:00+00:00"
    }
  },
  "message": "Order status updated."
}
```

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` | `{"message": "Unauthenticated."}` | Missing, invalid or revoked bearer token |
| `403` | `{"success": false, "message": "Forbidden. Admin access required."}` | Customer token or token without the `admin` ability |
| `404` | `{"message": "No query results for model [App\\Models\\Order] {id}"}` | Unknown order id |
| `422` | Laravel validation shape | Missing/invalid `status`, a delivery/payment target, note over 2000 chars, or missing note for `SUPPLIER_UNAVAILABLE`/`CANCELLED` |
| `409` | `{"success": false, "message": "Invalid status transition for [order]: [PREPARING] -> [ORDER_CONFIRMED]."}` | Target is not reachable from the current order status |

---

## GET /api/v1/admin/files/{path}

### Task

Task 07 — Admin Quotation Workflow.

### Authentication

Required. Admin token.

### Request

`{path}` is the private relative path returned as `attachment_path` on a supplier communication (for example `supplier-communications/31/quote.pdf`). It must resolve inside the `local` private disk.

### Success response

`200 OK` with the stored file as a download.

### Error responses

| Status | Body | Cause |
| --- | --- | --- |
| `401` / `403` | Authentication/ability errors | Missing token or non-admin token |
| `404` | `{"success": false, "message": "File not found."}` | Missing or unsafe path |
