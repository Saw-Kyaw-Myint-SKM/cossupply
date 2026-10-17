<?php

namespace App\Exceptions;

use RuntimeException;

class InvalidStatusTransitionException extends RuntimeException
{
    /**
     * Create a new invalid status transition exception.
     */
    public function __construct(
        public readonly string $domain,
        public readonly string $from,
        public readonly string $to,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Invalid status transition for [{$domain}]: [{$from}] -> [{$to}].",
        );
    }
}
