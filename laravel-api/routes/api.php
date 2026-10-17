<?php

use App\Http\Controllers\Api\V1\AdminAuthController;
use App\Http\Controllers\Api\V1\AdminCategoryController;
use App\Http\Controllers\Api\V1\AdminPrivateFileController;
use App\Http\Controllers\Api\V1\AdminProductController;
use App\Http\Controllers\Api\V1\AdminSettingController;
use App\Http\Controllers\Api\V1\AdminSupplierController;
use App\Http\Controllers\Api\V1\CustomerAuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PublicCategoryController;
use App\Http\Controllers\Api\V1\PublicProductController;
use App\Http\Controllers\Api\V1\PublicSupplierController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

/*
|--------------------------------------------------------------------------
| Health Check (Public)
|--------------------------------------------------------------------------
*/
Route::get('/health', [HealthController::class, 'check']);

/*
|--------------------------------------------------------------------------
| Public Catalog Routes (Guest browsing, no authentication)
|--------------------------------------------------------------------------
*/
Route::get('/products', [PublicProductController::class, 'index']);
Route::get('/products/{productId}', [PublicProductController::class, 'show']);
Route::get('/categories', [PublicCategoryController::class, 'index']);
Route::get('/suppliers', [PublicSupplierController::class, 'index']);

/*
|--------------------------------------------------------------------------
| Customer Authentication Routes (Public)
|--------------------------------------------------------------------------
*/
Route::post('/auth/register', [CustomerAuthController::class, 'register']);
Route::post('/auth/login', [CustomerAuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Protected Customer Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'customer'])->group(function () {
    Route::post('/auth/logout', [CustomerAuthController::class, 'logout']);
    Route::get('/auth/user', [CustomerAuthController::class, 'user']);
});

/*
|--------------------------------------------------------------------------
| Admin Authentication Routes (Public)
|--------------------------------------------------------------------------
*/
Route::post('/admin/login', [AdminAuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Protected Admin Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::post('/admin/logout', [AdminAuthController::class, 'logout']);
    Route::get('/admin/user', [AdminAuthController::class, 'user']);

    // Master settings
    Route::get('/admin/settings', [AdminSettingController::class, 'index']);
    Route::put('/admin/settings/{setting}', [AdminSettingController::class, 'update']);
    Route::patch('/admin/settings', [AdminSettingController::class, 'bulkUpdate']);

    // Catalog: categories, suppliers and products
    Route::apiResource('/admin/categories', AdminCategoryController::class);
    Route::apiResource('/admin/suppliers', AdminSupplierController::class)->except('destroy');
    Route::apiResource('/admin/products', AdminProductController::class);
    Route::patch('/admin/products/{product}/status', [AdminProductController::class, 'updateStatus']);

    // Private file streaming (receipts, cash payment proofs, signatures, attachments)
    Route::get('/admin/files/{path}', [AdminPrivateFileController::class, 'show'])
        ->where('path', '.*');
});
