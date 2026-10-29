<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Lenient phone-number rule for MVP contact fields.
 *
 * Accepts local Myanmar numbers and international formats: an optional
 * leading `+`, digits, spaces, dashes and parentheses. The number must
 * contain between 7 and 15 digits, which covers local mobile numbers
 * (`09-770-100-200`) and E.164 values (`+95 9 770 100 200`) without
 * rejecting the formatting customers actually type.
 */
class PhoneNumber implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail('The :attribute must be a valid phone number.');

            return;
        }

        $phone = trim($value);

        if (preg_match('/^\+?[0-9()\s-]+$/', $phone) !== 1) {
            $fail('The :attribute must be a valid phone number (7-15 digits; spaces, dashes and a leading + are allowed).');

            return;
        }

        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (strlen($digits) < 7 || strlen($digits) > 15) {
            $fail('The :attribute must be a valid phone number (7-15 digits; spaces, dashes and a leading + are allowed).');
        }
    }
}
