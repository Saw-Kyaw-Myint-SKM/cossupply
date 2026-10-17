<?php

namespace App\Models;

use App\Enums\SupplierStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'shop_name',
        'company_name',
        'contact_person',
        'phone',
        'viber_phone',
        'email',
        'logo',
        'address',
        'city',
        'township',
        'business_description',
        'delivery_area',
        'delivery_time',
        'warranty_policy',
        'return_policy',
        'status',
        'verified',
        'created_by_admin_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'verified' => 'boolean',
            'status' => SupplierStatus::class,
        ];
    }

    /**
     * The admin who created the supplier.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by_admin_id');
    }

    /**
     * The products supplied by this supplier.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * The admin/supplier communication log entries.
     */
    public function communications(): HasMany
    {
        return $this->hasMany(SupplierCommunication::class);
    }
}
