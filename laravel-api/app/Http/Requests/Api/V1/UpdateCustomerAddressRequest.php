<?php

namespace App\Http\Requests\Api\V1;

/**
 * A PUT replaces the full address payload, so update validation is
 * identical to creation (same required/nullable fields, same defaults).
 */
class UpdateCustomerAddressRequest extends StoreCustomerAddressRequest {}
