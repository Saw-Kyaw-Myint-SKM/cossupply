<?php

namespace Database\Factories;

use App\Enums\QuotationRequestStatus;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\QuotationRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuotationRequest>
 */
class QuotationRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_number' => 'QT-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'customer_id' => Customer::factory(),
            'customer_name' => fake()->name(),
            'company_name' => null,
            'phone' => fake()->numerify('09#########'),
            'email' => fake()->safeEmail(),
            'delivery_address' => fake()->address(),
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'landmark' => null,
            'required_delivery_date' => now()->addDays(7)->toDateString(),
            'customer_note' => null,
            'status' => QuotationRequestStatus::NEW->value,
            'assigned_admin_id' => null,
        ];
    }

    /**
     * Indicate that the request has been cancelled.
     */
    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::CANCELLED->value,
        ]);
    }

    /**
     * Indicate that an admin is contacting the suppliers.
     */
    public function contactingSupplier(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::CONTACTING_SUPPLIER->value,
        ]);
    }

    /**
     * Indicate that the request is waiting on supplier responses.
     */
    public function supplierResponsePending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING->value,
        ]);
    }

    /**
     * Indicate that an admin is preparing the quotation version.
     */
    public function preparingQuotation(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::PREPARING_QUOTATION->value,
        ]);
    }

    /**
     * Indicate that a quotation version has been sent to the customer.
     */
    public function quotationSent(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::QUOTATION_SENT->value,
        ]);
    }

    /**
     * Indicate that the customer is reviewing the current quotation.
     */
    public function customerReviewing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::CUSTOMER_REVIEWING->value,
        ]);
    }

    /**
     * Indicate that the customer asked for a change.
     */
    public function changeRequested(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::CHANGE_REQUESTED->value,
        ]);
    }

    /**
     * Indicate that the customer accepted the current quotation.
     */
    public function accepted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::ACCEPTED->value,
        ]);
    }

    /**
     * Indicate that the customer rejected the current quotation.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::REJECTED->value,
        ]);
    }

    /**
     * Indicate that the quotation expired and the request was closed.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::EXPIRED->value,
        ]);
    }

    /**
     * Assign the request to the given admin.
     */
    public function assignedTo(Admin $admin): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_admin_id' => $admin->id,
        ]);
    }

    /**
     * Leave the request unassigned.
     */
    public function unassigned(): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_admin_id' => null,
        ]);
    }
}
