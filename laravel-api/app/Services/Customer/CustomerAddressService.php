<?php

namespace App\Services\Customer;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Customer address book management.
 *
 * A customer has at most one default address. The first address created
 * for a customer becomes the default automatically; moving the default
 * demotes the previous one, and deleting the default promotes the newest
 * remaining address. Every method assumes the caller has already verified
 * that the rows belong to the given customer.
 */
class CustomerAddressService
{
    /**
     * All address rows owned by the customer: the default first, then the
     * newest.
     */
    public function paginate(Customer $customer, int $perPage): LengthAwarePaginator
    {
        return CustomerAddress::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    /**
     * Find one address owned by the customer, or null when it does not
     * exist or belongs to someone else (ownership must never be leaked
     * through a 403).
     */
    public function findOwned(Customer $customer, ?CustomerAddress $address): ?CustomerAddress
    {
        if ($address === null || (int) $address->customer_id !== (int) $customer->id) {
            return null;
        }

        return $address;
    }

    /**
     * Find one owned address by id, or null when the owner differs.
     */
    public function findOwnedById(Customer $customer, int $id): ?CustomerAddress
    {
        return $this->findOwned($customer, CustomerAddress::query()->whereKey($id)->first());
    }

    /**
     * Create an address and enforce the single-default rule atomically.
     *
     * When the customer has no addresses yet, the new one is always the
     * default regardless of the requested flag.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(Customer $customer, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $data): CustomerAddress {
            $existing = CustomerAddress::query()
                ->where('customer_id', $customer->id)
                ->lockForUpdate()
                ->get();

            $makeDefault = (bool) ($data['is_default'] ?? false) || $existing->isEmpty();

            if ($makeDefault) {
                $this->demoteDefaults($existing);
            }

            return CustomerAddress::create([
                'customer_id' => $customer->id,
                'contact_name' => $data['contact_name'],
                'phone' => $data['phone'],
                'city' => $data['city'],
                'township' => $data['township'],
                'ward' => $data['ward'] ?? null,
                'street' => $data['street'] ?? null,
                'building_no' => $data['building_no'] ?? null,
                'landmark' => $data['landmark'] ?? null,
                'full_address' => $data['full_address'],
                'is_default' => $makeDefault,
            ]);
        });
    }

    /**
     * Replace the full payload of an owned address and re-enforce the
     * single-default rule. The previous default (on another address) is
     * demoted when this address becomes the default.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Customer $customer, CustomerAddress $address, array $data): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $address, $data): CustomerAddress {
            if ((bool) ($data['is_default'] ?? false)) {
                $this->demoteDefaults(
                    CustomerAddress::query()
                        ->where('customer_id', $customer->id)
                        ->whereKeyNot($address->id)
                        ->lockForUpdate()
                        ->get(),
                );
            }

            $address->update([
                'contact_name' => $data['contact_name'],
                'phone' => $data['phone'],
                'city' => $data['city'],
                'township' => $data['township'],
                'ward' => $data['ward'] ?? null,
                'street' => $data['street'] ?? null,
                'building_no' => $data['building_no'] ?? null,
                'landmark' => $data['landmark'] ?? null,
                'full_address' => $data['full_address'],
                'is_default' => (bool) ($data['is_default'] ?? $address->is_default),
            ]);

            return $address;
        });
    }

    /**
     * Delete an owned address. When the deleted address was the default,
     * the newest remaining address (if any) is promoted; the customer may
     * also be left with no default when it was the only address.
     */
    public function delete(Customer $customer, CustomerAddress $address): void
    {
        DB::transaction(function () use ($customer, $address): void {
            $wasDefault = (bool) $address->is_default;

            $address->delete();

            if ($wasDefault) {
                CustomerAddress::query()
                    ->where('customer_id', $customer->id)
                    ->orderByDesc('id')
                    ->limit(1)
                    ->update(['is_default' => true]);
            }
        });
    }

    /**
     * Demote every address in the set that currently holds the default
     * flag.
     *
     * @param  iterable<int, CustomerAddress>  $addresses
     */
    private function demoteDefaults(iterable $addresses): void
    {
        foreach ($addresses as $address) {
            if ((bool) $address->is_default) {
                $address->update(['is_default' => false]);
            }
        }
    }
}
