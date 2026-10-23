<?php

use App\Http\Controllers\Api\V1\AdminAuthController;
use App\Http\Controllers\Api\V1\AdminCategoryController;
use App\Http\Controllers\Api\V1\AdminPrivateFileController;
use App\Http\Controllers\Api\V1\AdminProductController;
use App\Http\Controllers\Api\V1\AdminQuotationController;
use App\Http\Controllers\Api\V1\AdminQuotationRequestController;
use App\Http\Controllers\Api\V1\AdminSettingController;
use App\Http\Controllers\Api\V1\AdminSupplierController;
use App\Http\Controllers\Api\V1\CustomerAddressController;
use App\Http\Controllers\Api\V1\CustomerAuthController;
use App\Http\Controllers\Api\V1\CustomerProfileController;
use App\Http\Controllers\Api\V1\CustomerQuotationRequestController;
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

    // Customer profile (self-service; email/phone managed server-side)
    Route::get('/customer/profile', [CustomerProfileController::class, 'show']);
    Route::put('/customer/profile', [CustomerProfileController::class, 'update']);

    // Customer address book
    Route::get('/customer/addresses', [CustomerAddressController::class, 'index']);
    Route::post('/customer/addresses', [CustomerAddressController::class, 'store']);
    Route::get('/customer/addresses/{address}', [CustomerAddressController::class, 'show']);
    Route::put('/customer/addresses/{address}', [CustomerAddressController::class, 'update']);
    Route::delete('/customer/addresses/{address}', [CustomerAddressController::class, 'destroy']);

    // Quotation requests (submitted from the cart, customer-owned reads)
    Route::get('/customer/quotation-requests', [CustomerQuotationRequestController::class, 'index']);
    Route::post('/customer/quotation-requests', [CustomerQuotationRequestController::class, 'store']);
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

    // Quotation request queue, assignment, supplier logs and version drafts
    Route::get('/admin/admins', [AdminQuotationRequestController::class, 'admins']);
    Route::get('/admin/quotation-requests', [AdminQuotationRequestController::class, 'index']);
    Route::get('/admin/quotation-requests/{quotationRequest}', [AdminQuotationRequestController::class, 'show']);
    Route::patch('/admin/quotation-requests/{quotationRequest}/assignment', [AdminQuotationRequestController::class, 'assign']);
    Route::patch('/admin/quotation-requests/{quotationRequest}/status', [AdminQuotationRequestController::class, 'updateStatus']);
    Route::post('/admin/quotation-requests/{quotationRequest}/communications', [AdminQuotationRequestController::class, 'storeCommunication']);
    Route::post('/admin/quotation-requests/{quotationRequest}/quotations', [AdminQuotationRequestController::class, 'storeVersion']);

    // Quotation version draft lifecycle, PDF and email resend
    Route::get('/admin/quotations/{quotation}', [AdminQuotationController::class, 'show']);
    Route::put('/admin/quotations/{quotation}', [AdminQuotationController::class, 'update']);
    Route::post('/admin/quotations/{quotation}/send', [AdminQuotationController::class, 'send']);
    Route::post('/admin/quotations/{quotation}/resend', [AdminQuotationController::class, 'resend']);
    Route::post('/admin/quotations/{quotation}/pdf', [AdminQuotationController::class, 'generatePdf']);
    Route::get('/admin/quotations/{quotation}/pdf/download', [AdminQuotationController::class, 'downloadPdf']);

    // Private file streaming (receipts, cash payment proofs, signatures, attachments)
    Route::get('/admin/files/{path}', [AdminPrivateFileController::class, 'show'])
        ->where('path', '.*');
});
