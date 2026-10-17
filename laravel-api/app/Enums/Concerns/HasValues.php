<?php

namespace App\Enums\Concerns;

trait HasValues
{
    /**
     * Get all backing values of the enum cases.
     *
     * Useful for validation rules such as Rule::in().
     *
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(
            static fn (self $case): string => $case->value,
            self::cases(),
        );
    }
}
