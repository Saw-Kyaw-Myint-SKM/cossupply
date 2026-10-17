# CoSupply API Documentation

Backend: Laravel 12 REST API (this `laravel-api` directory is the project backend).

## Conventions

- Base URL: `http://localhost:8000` (local development).
- API prefix: `/api/v1` (configured in `bootstrap/app.php` as `apiPrefix: 'api/v1'`).
- Authentication: Laravel Sanctum bearer tokens. `Authorization: Bearer <token>`.
- Token abilities: `admin` (Admin account) and `customer` (Customer account).
- Success envelope: `{"success": true, "data": {...}, "message": "..."}` (`message` optional).
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
