<?php

namespace App\Services\Quotation;

use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Models\Admin;
use App\Models\EmailLog;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use App\Models\SupplierCommunication;
use App\Services\Audit\AuditLogService;
use App\Services\Setting\SettingService;
use App\Services\Status\StatusTransitionService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Admin quotation workflow: assignment, supplier contact, version drafts,
 * price snapshots, sending and resending.
 *
 * Totals are always derived here; request items are never modified by this
 * service.
 */
class QuotationWorkflowService
{
    public function __construct(
        private readonly SettingService $settings,
        private readonly StatusTransitionService $statuses,
        private readonly QuotationTotalsCalculator $calculator,
        private readonly QuotationPdfService $pdfs,
        private readonly QuotationEmailService $emails,
        private readonly AuditLogService $auditLogs,
    ) {}

    public function assign(
        QuotationRequest $quotationRequest,
        ?int $assignedAdminId,
        Admin $admin,
        ?string $ip = null,
    ): QuotationRequest {
        $old = ['assigned_admin_id' => $quotationRequest->assigned_admin_id];

        $quotationRequest->update(['assigned_admin_id' => $assignedAdminId]);

        $this->auditLogs->log(
            $admin,
            'quotation_request.assigned',
            'quotation_request',
            (string) $quotationRequest->id,
            $old,
            ['assigned_admin_id' => $assignedAdminId],
            $ip,
        );

        return $quotationRequest->refresh()->load('assignedAdmin');
    }

    public function updateStatus(
        QuotationRequest $quotationRequest,
        string $status,
        Admin $admin,
        ?string $ip = null,
    ): QuotationRequest {
        $from = $quotationRequest->status->value;

        $this->statuses->assertTransition(
            StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
            $from,
            $status,
        );

        $quotationRequest->update(['status' => $status]);

        $this->auditLogs->log(
            $admin,
            'quotation_request.status_updated',
            'quotation_request',
            (string) $quotationRequest->id,
            ['status' => $from],
            ['status' => $status],
            $ip,
        );

        return $quotationRequest->refresh();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function logCommunication(
        QuotationRequest $quotationRequest,
        array $data,
        ?UploadedFile $attachment,
        Admin $admin,
        ?string $ip = null,
    ): SupplierCommunication {
        return DB::transaction(function () use ($quotationRequest, $data, $attachment, $admin, $ip): SupplierCommunication {
            $request = QuotationRequest::query()
                ->whereKey($quotationRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $attachmentPath = $attachment?->store(
                'supplier-communications/'.$request->id,
                'local',
            );

            $response = isset($data['supplier_response']) && trim((string) $data['supplier_response']) !== ''
                ? trim((string) $data['supplier_response'])
                : null;

            $contactedAt = $data['contacted_at'] ?? now();
            $respondedAt = $data['responded_at'] ?? ($response !== null ? now() : null);

            $communication = SupplierCommunication::create([
                'quotation_request_id' => $request->id,
                'supplier_id' => (int) $data['supplier_id'],
                'admin_id' => $admin->id,
                'contact_method' => (string) $data['contact_method'],
                'message_text' => $data['message_text'] ?? null,
                'supplier_response' => $response,
                'attachment_path' => $attachmentPath,
                'contacted_at' => $contactedAt,
                'responded_at' => $respondedAt,
            ]);

            $target = $response !== null
                ? QuotationRequestStatus::CONTACTING_SUPPLIER
                : QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING;

            $this->moveRequestTo($request, $target, false);

            $this->auditLogs->log(
                $admin,
                'supplier_communication.created',
                'quotation_request',
                (string) $request->id,
                [],
                [
                    'communication_id' => $communication->id,
                    'supplier_id' => $communication->supplier_id,
                    'contact_method' => $communication->contact_method,
                    'has_response' => $response !== null,
                ],
                $ip,
            );

            return $communication->fresh(['supplier', 'admin']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createVersion(
        QuotationRequest $quotationRequest,
        array $data,
        Admin $admin,
        ?string $ip = null,
    ): Quotation {
        return DB::transaction(function () use ($quotationRequest, $data, $admin, $ip): Quotation {
            $request = QuotationRequest::query()
                ->whereKey($quotationRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($request->status, [
                QuotationRequestStatus::ACCEPTED,
                QuotationRequestStatus::REJECTED,
                QuotationRequestStatus::CANCELLED,
            ], true)) {
                throw ValidationException::withMessages([
                    'quotation_request' => ['A new version cannot be created for a closed request.'],
                ]);
            }

            $version = (int) Quotation::query()
                ->where('quotation_request_id', $request->id)
                ->max('version') + 1;

            $prepared = $this->prepareVersion($data);

            $quotation = Quotation::create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
                'version' => $version,
                'status' => QuotationVersionStatus::DRAFT->value,
                'is_current' => false,
                'subtotal' => $prepared['subtotal'],
                'discount' => $prepared['discount'],
                'delivery_fee' => $prepared['delivery_fee'],
                'service_fee_percentage' => $prepared['service_fee_percentage'],
                'service_fee' => $prepared['service_fee'],
                'total_amount' => $prepared['total_amount'],
                'payment_method' => 'CASH_ON_DELIVERY',
                'payment_terms' => $prepared['payment_terms'],
                'valid_until' => $prepared['valid_until'],
                'admin_note' => $data['admin_note'] ?? null,
                'created_by_admin_id' => $admin->id,
            ]);

            $this->replaceItems($quotation, $prepared['items']);

            $this->moveRequestTo($request, QuotationRequestStatus::PREPARING_QUOTATION, false);

            $this->auditLogs->log(
                $admin,
                'quotation.created',
                'quotation',
                (string) $quotation->id,
                [],
                [
                    'quotation_request_id' => $request->id,
                    'version' => $version,
                    'total_amount' => $quotation->total_amount,
                ],
                $ip,
            );

            return $quotation->fresh(['items.supplier', 'pdfs', 'emailLogs']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateVersion(
        Quotation $quotation,
        array $data,
        Admin $admin,
        ?string $ip = null,
    ): Quotation {
        return DB::transaction(function () use ($quotation, $data, $admin, $ip): Quotation {
            $version = Quotation::query()
                ->whereKey($quotation->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($version->status !== QuotationVersionStatus::DRAFT) {
                throw ValidationException::withMessages([
                    'quotation' => ['Only draft quotation versions can be edited.'],
                ]);
            }

            $prepared = $this->prepareVersion($data);

            $old = [
                'subtotal' => $version->subtotal,
                'discount' => $version->discount,
                'delivery_fee' => $version->delivery_fee,
                'service_fee_percentage' => $version->service_fee_percentage,
                'service_fee' => $version->service_fee,
                'total_amount' => $version->total_amount,
            ];

            $version->update([
                'subtotal' => $prepared['subtotal'],
                'discount' => $prepared['discount'],
                'delivery_fee' => $prepared['delivery_fee'],
                'service_fee_percentage' => $prepared['service_fee_percentage'],
                'service_fee' => $prepared['service_fee'],
                'total_amount' => $prepared['total_amount'],
                'payment_method' => 'CASH_ON_DELIVERY',
                'payment_terms' => $prepared['payment_terms'],
                'valid_until' => $prepared['valid_until'],
                'admin_note' => $data['admin_note'] ?? null,
            ]);

            $version->items()->delete();
            $this->replaceItems($version, $prepared['items']);

            $request = QuotationRequest::query()
                ->whereKey($version->quotation_request_id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->moveRequestTo($request, QuotationRequestStatus::PREPARING_QUOTATION, false);

            $this->auditLogs->log(
                $admin,
                'quotation.updated',
                'quotation',
                (string) $version->id,
                $old,
                [
                    'subtotal' => $version->subtotal,
                    'discount' => $version->discount,
                    'delivery_fee' => $version->delivery_fee,
                    'service_fee_percentage' => $version->service_fee_percentage,
                    'service_fee' => $version->service_fee,
                    'total_amount' => $version->total_amount,
                ],
                $ip,
            );

            return $version->fresh(['items.supplier', 'pdfs', 'emailLogs']);
        });
    }

    /**
     * Send a draft version and email the customer.
     *
     * Email delivery happens after the database commit so a mail failure can
     * never roll back the sent quotation.
     *
     * @return array{quotation: Quotation, email: EmailLog}
     */
    public function send(Quotation $quotation, Admin $admin, ?string $ip = null): array
    {
        $sent = DB::transaction(function () use ($quotation, $admin, $ip): Quotation {
            $version = Quotation::query()
                ->whereKey($quotation->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($version->status !== QuotationVersionStatus::DRAFT) {
                throw ValidationException::withMessages([
                    'quotation' => ['Only a draft quotation version can be sent.'],
                ]);
            }

            $request = QuotationRequest::query()
                ->whereKey($version->quotation_request_id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($request->status, [
                QuotationRequestStatus::ACCEPTED,
                QuotationRequestStatus::REJECTED,
                QuotationRequestStatus::CANCELLED,
            ], true)) {
                throw ValidationException::withMessages([
                    'quotation_request' => ['The request is closed and cannot receive a new quotation.'],
                ]);
            }

            $currentVersions = Quotation::query()
                ->where('quotation_request_id', $request->id)
                ->where('id', '!=', $version->id)
                ->where('is_current', true)
                ->lockForUpdate()
                ->get();

            foreach ($currentVersions as $current) {
                if (in_array($current->status, [
                    QuotationVersionStatus::ACCEPTED,
                    QuotationVersionStatus::REJECTED,
                    QuotationVersionStatus::CANCELLED,
                ], true)) {
                    throw ValidationException::withMessages([
                        'quotation' => ['A settled quotation version cannot be superseded.'],
                    ]);
                }

                $this->statuses->assertTransition(
                    StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                    $current->status->value,
                    QuotationVersionStatus::SUPERSEDED->value,
                );

                $current->update([
                    'status' => QuotationVersionStatus::SUPERSEDED->value,
                    'is_current' => false,
                ]);
            }

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::DRAFT->value,
                QuotationVersionStatus::SENT->value,
            );

            $version->update([
                'status' => QuotationVersionStatus::SENT->value,
                'is_current' => true,
                'sent_at' => now(),
            ]);

            $this->moveRequestTo($request, QuotationRequestStatus::QUOTATION_SENT, true);

            $pdf = $this->pdfs->generate($version, $admin);

            $this->auditLogs->log(
                $admin,
                'quotation.pdf_generated',
                'quotation',
                (string) $version->id,
                [],
                ['pdf_id' => $pdf->id, 'file_name' => $pdf->file_name],
                $ip,
            );

            $this->auditLogs->log(
                $admin,
                'quotation.sent',
                'quotation',
                (string) $version->id,
                ['status' => QuotationVersionStatus::DRAFT->value],
                [
                    'status' => QuotationVersionStatus::SENT->value,
                    'superseded_version_ids' => $currentVersions->pluck('id')->all(),
                ],
                $ip,
            );

            return $version->fresh(['items.supplier', 'pdfs', 'emailLogs']);
        });

        $email = $this->emails->send($sent);

        return [
            'quotation' => $sent->fresh(['items.supplier', 'pdfs', 'emailLogs']),
            'email' => $email,
        ];
    }

    public function resend(Quotation $quotation, Admin $admin, ?string $ip = null): EmailLog
    {
        $quotation->refresh();

        if ($quotation->sent_at === null) {
            throw ValidationException::withMessages([
                'quotation' => ['Only a quotation that has been sent can be resent.'],
            ]);
        }

        if (! $quotation->pdfs()->exists()) {
            $this->pdfs->generate($quotation, $admin);
            $quotation->load('pdfs');
        }

        $email = $this->emails->send($quotation, true);

        $this->auditLogs->log(
            $admin,
            'quotation.email_resent',
            'quotation',
            (string) $quotation->id,
            [],
            [
                'email_log_id' => $email->id,
                'email_status' => $email->status,
            ],
            $ip,
        );

        return $email;
    }

    public function generatePdf(
        Quotation $quotation,
        Admin $admin,
        ?string $ip = null,
    ): QuotationPdf {
        $pdf = $this->pdfs->generate($quotation, $admin);

        $this->auditLogs->log(
            $admin,
            'quotation.pdf_generated',
            'quotation',
            (string) $quotation->id,
            [],
            ['pdf_id' => $pdf->id, 'file_name' => $pdf->file_name],
            $ip,
        );

        return $pdf;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *     items: list<array<string, mixed>>,
     *     subtotal: int,
     *     discount: int,
     *     delivery_fee: int,
     *     service_fee_percentage: int,
     *     service_fee: int,
     *     total_amount: int,
     *     payment_terms: string,
     *     valid_until: string
     * }
     */
    private function prepareVersion(array $data): array
    {
        $productIds = collect($data['items'])->pluck('product_id')->map(fn ($id): int => (int) $id);
        $products = Product::query()
            ->with('supplier')
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        $lineInputs = [];
        foreach ($data['items'] as $item) {
            $lineInputs[] = [
                'quantity' => (int) $item['quantity'],
                'unit_price' => (int) $item['unit_price'],
                'discount' => (int) ($item['discount'] ?? 0),
            ];
        }

        $defaultPercentage = (int) $this->settings->get('quotation_service_fee_percentage', 0);
        $percentage = array_key_exists('service_fee_percentage', $data)
            && $data['service_fee_percentage'] !== null
            ? (int) $data['service_fee_percentage']
            : $defaultPercentage;

        $discount = (int) ($data['discount'] ?? 0);
        $deliveryFee = (int) ($data['delivery_fee'] ?? 0);

        try {
            $totals = $this->calculator->calculate($lineInputs, $discount, $deliveryFee, $percentage);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'items' => [$exception->getMessage()],
            ]);
        }

        $items = [];

        foreach ($data['items'] as $index => $item) {
            $product = $products->get((int) $item['product_id']);

            if ($product === null) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => ['The selected product no longer exists.'],
                ]);
            }

            $priced = $totals['items'][$index];

            $items[] = [
                'product_id' => $product->id,
                'supplier_id' => $product->supplier_id,
                'product_name_snapshot' => $product->name_en ?? $product->name_mm,
                'sku_snapshot' => $product->sku,
                'specification_snapshot' => $product->specification,
                'quantity' => $priced['quantity'],
                'unit_price' => $priced['unit_price'],
                'discount' => $priced['discount'],
                'line_total' => $priced['line_total'],
                'delivery_date' => $item['delivery_date'] ?? null,
                'warranty_note' => $item['warranty_note'] ?? null,
                'supplier_note' => $item['supplier_note'] ?? null,
            ];
        }

        $validityDays = (int) $this->settings->get('quotation_validity_days', 7);

        return [
            'items' => $items,
            'subtotal' => $totals['subtotal'],
            'discount' => $discount,
            'delivery_fee' => $deliveryFee,
            'service_fee_percentage' => $percentage,
            'service_fee' => $totals['service_fee'],
            'total_amount' => $totals['total_amount'],
            'payment_terms' => (string) ($data['payment_terms'] ?? 'Full payment on delivery (COD).'),
            'valid_until' => (string) ($data['valid_until'] ?? now()->addDays($validityDays)->toDateString()),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function replaceItems(Quotation $quotation, array $items): void
    {
        foreach ($items as $item) {
            QuotationVersionItem::create([...$item, 'quotation_id' => $quotation->id]);
        }
    }

    /**
     * Move a request to the requested status only along a valid transition
     * path. When `$strict` is false and the request is already beyond the
     * workflow stage, the status is left unchanged.
     */
    private function moveRequestTo(
        QuotationRequest $request,
        QuotationRequestStatus $target,
        bool $strict,
    ): void {
        $from = $request->status->value;

        if ($from === $target->value) {
            return;
        }

        $path = $this->statuses->path(
            StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
            $from,
            $target->value,
        );

        if ($path === null) {
            if (! $strict) {
                return;
            }

            throw ValidationException::withMessages([
                'status' => ["The request cannot move from {$from} to {$target->value}."],
            ]);
        }

        $request->update(['status' => $target->value]);
    }
}
