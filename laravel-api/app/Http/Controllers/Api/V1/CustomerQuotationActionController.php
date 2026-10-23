<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AcceptQuotationRequest;
use App\Http\Requests\Api\V1\RejectQuotationRequest;
use App\Http\Requests\Api\V1\RequestQuotationChangeRequest;
use App\Http\Resources\CustomerQuotationActionResultResource;
use App\Models\Quotation;
use App\Services\Quotation\CustomerQuotationActionService;
use Illuminate\Http\JsonResponse;

/**
 * Customer quotation responses (LogicFlow §8): accept, reject and request
 * a change on the current quotation version.
 *
 * Ownership is resolved from the authenticated customer and double-checked
 * inside the locking transaction. A foreign quotation id answers 404 so its
 * existence is never leaked.
 */
class CustomerQuotationActionController extends Controller
{
    public function __construct(
        private readonly CustomerQuotationActionService $actions,
    ) {}

    /**
     * Accept the current quotation. Status-only in Task 08; Task 09 will
     * populate `data.order`.
     */
    public function accept(AcceptQuotationRequest $request, Quotation $quotation): JsonResponse
    {
        $result = $this->actions->accept(
            $request->user(),
            $quotation,
            $request->boolean('cod_terms_accepted'),
            $request->ip(),
        );

        if ($result === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        return $this->successResponse(
            new CustomerQuotationActionResultResource($result),
            'Quotation accepted.',
        );
    }

    /**
     * Reject the current quotation with an optional note.
     */
    public function reject(RejectQuotationRequest $request, Quotation $quotation): JsonResponse
    {
        $result = $this->actions->reject(
            $request->user(),
            $quotation,
            $request->validated('customer_note'),
            $request->ip(),
        );

        if ($result === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        return $this->successResponse(
            new CustomerQuotationActionResultResource($result),
            'Quotation rejected.',
        );
    }

    /**
     * Ask Admin for a revised quotation version.
     */
    public function requestChange(RequestQuotationChangeRequest $request, Quotation $quotation): JsonResponse
    {
        $result = $this->actions->requestChange(
            $request->user(),
            $quotation,
            $request->validated('customer_note'),
            $request->ip(),
        );

        if ($result === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        return $this->successResponse(
            new CustomerQuotationActionResultResource($result),
            'Quotation change requested.',
        );
    }
}
