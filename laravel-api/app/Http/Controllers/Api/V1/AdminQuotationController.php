<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SaveQuotationVersionRequest;
use App\Http\Resources\EmailLogResource;
use App\Http\Resources\QuotationPdfResource;
use App\Http\Resources\QuotationVersionResource;
use App\Models\Quotation;
use App\Services\Quotation\QuotationWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminQuotationController extends Controller
{
    public function __construct(
        private readonly QuotationWorkflowService $workflow,
    ) {}

    /**
     * Show one version with item snapshots, PDFs and email attempts.
     */
    public function show(Quotation $quotation): JsonResponse
    {
        $this->loadVersion($quotation);

        return $this->successResponse(['quotation' => new QuotationVersionResource($quotation)]);
    }

    /**
     * Edit a draft version. Sent and historical versions are immutable.
     */
    public function update(SaveQuotationVersionRequest $request, Quotation $quotation): JsonResponse
    {
        $quotation = $this->workflow->updateVersion(
            $quotation,
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['quotation' => new QuotationVersionResource($quotation)],
            'Quotation draft updated.',
        );
    }

    /**
     * Mark the draft sent, supersede the prior current version, generate the
     * version PDF and email the customer.
     */
    public function send(Request $request, Quotation $quotation): JsonResponse
    {
        $result = $this->workflow->send($quotation, $request->user(), $request->ip());

        return $this->successResponse([
            'quotation' => new QuotationVersionResource($result['quotation']),
            'email' => new EmailLogResource($result['email']),
        ], 'Quotation sent.');
    }

    public function resend(Request $request, Quotation $quotation): JsonResponse
    {
        $email = $this->workflow->resend($quotation, $request->user(), $request->ip());

        return $this->successResponse(
            ['email' => new EmailLogResource($email)],
            'Quotation email resent.',
        );
    }

    /**
     * Generate a new immutable PDF record for this version.
     */
    public function generatePdf(Request $request, Quotation $quotation): JsonResponse
    {
        $pdf = $this->workflow->generatePdf($quotation, $request->user(), $request->ip());

        return $this->successResponse(
            ['pdf' => new QuotationPdfResource($pdf)],
            'Quotation PDF generated.',
            201,
        );
    }

    /**
     * Download the newest PDF for this version, generating one when needed.
     */
    public function downloadPdf(Request $request, Quotation $quotation): StreamedResponse
    {
        $pdf = $quotation->pdfs()->orderByDesc('generated_at')->orderByDesc('id')->first();

        if ($pdf === null || ! Storage::disk('local')->exists($pdf->file_path)) {
            $pdf = $this->workflow->generatePdf($quotation, $request->user(), $request->ip());
        }

        return Storage::disk('local')->download($pdf->file_path, $pdf->file_name);
    }

    private function loadVersion(Quotation $quotation): void
    {
        $quotation->load([
            'items.supplier',
            'pdfs' => fn ($query) => $query->with('generatedByAdmin')->orderByDesc('generated_at'),
            'emailLogs' => fn ($query) => $query->orderByDesc('id'),
            'createdByAdmin',
            'quotationRequest',
        ]);
    }
}
