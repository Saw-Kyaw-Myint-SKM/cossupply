<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\QuotationRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AssignQuotationRequestRequest;
use App\Http\Requests\Api\V1\SaveQuotationVersionRequest;
use App\Http\Requests\Api\V1\StoreSupplierCommunicationRequest;
use App\Http\Requests\Api\V1\UpdateQuotationRequestStatusRequest;
use App\Http\Resources\AdminQuotationRequestResource;
use App\Http\Resources\QuotationVersionResource;
use App\Http\Resources\SupplierCommunicationResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\QuotationRequest;
use App\Services\Quotation\QuotationWorkflowService;
use App\Services\Setting\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminQuotationRequestController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly QuotationWorkflowService $workflow,
        private readonly SettingService $settings,
    ) {}

    /**
     * Quotation queue with status/assignment/search filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(QuotationRequestStatus::values())],
            'assigned_admin_id' => ['nullable', 'integer', 'exists:admins,id'],
            'unassigned' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = QuotationRequest::query()
            ->with('assignedAdmin')
            ->withCount('items')
            ->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['assigned_admin_id'])) {
            $query->where('assigned_admin_id', $filters['assigned_admin_id']);
        }

        if (($filters['unassigned'] ?? false) === true) {
            $query->whereNull('assigned_admin_id');
        }

        if (isset($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search): void {
                $query->where('quotation_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('company_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $requests = $query->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'quotation_requests' => AdminQuotationRequestResource::collection($requests->items()),
            'meta' => $this->paginationMeta($requests),
            'statuses' => QuotationRequestStatus::values(),
            'service_fee_default_percentage' => (int) $this->settings->get('quotation_service_fee_percentage', 0),
        ]);
    }

    /**
     * Full request detail: immutable request items, supplier groups,
     * communication log and every quotation version.
     */
    public function show(QuotationRequest $quotationRequest): JsonResponse
    {
        $this->loadDetail($quotationRequest);

        return $this->successResponse([
            'quotation_request' => new AdminQuotationRequestResource($quotationRequest),
            'service_fee_default_percentage' => (int) $this->settings->get('quotation_service_fee_percentage', 0),
            'quotation_validity_days' => (int) $this->settings->get('quotation_validity_days', 7),
            'default_delivery_fee' => (int) $this->settings->get('default_delivery_fee', 0),
            'admins' => $this->assignableAdmins(),
        ]);
    }

    /**
     * Active staff options for the assignment control.
     */
    public function admins(): JsonResponse
    {
        return $this->successResponse(['admins' => $this->assignableAdmins()]);
    }

    public function assign(
        AssignQuotationRequestRequest $request,
        QuotationRequest $quotationRequest,
    ): JsonResponse {
        $quotationRequest = $this->workflow->assign(
            $quotationRequest,
            $request->validated('assigned_admin_id'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['quotation_request' => new AdminQuotationRequestResource($quotationRequest)],
            'Quotation request assignment updated.',
        );
    }

    public function updateStatus(
        UpdateQuotationRequestStatusRequest $request,
        QuotationRequest $quotationRequest,
    ): JsonResponse {
        $quotationRequest = $this->workflow->updateStatus(
            $quotationRequest,
            $request->validated('status'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['quotation_request' => new AdminQuotationRequestResource($quotationRequest)],
            'Quotation request status updated.',
        );
    }

    public function storeCommunication(
        StoreSupplierCommunicationRequest $request,
        QuotationRequest $quotationRequest,
    ): JsonResponse {
        $communication = $this->workflow->logCommunication(
            $quotationRequest,
            $request->validated(),
            $request->file('attachment'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            [
                'communication' => new SupplierCommunicationResource($communication),
                'request_status' => $quotationRequest->refresh()->status->value,
            ],
            'Supplier communication logged.',
            201,
        );
    }

    /**
     * Create the next draft quotation version.
     */
    public function storeVersion(
        SaveQuotationVersionRequest $request,
        QuotationRequest $quotationRequest,
    ): JsonResponse {
        $quotation = $this->workflow->createVersion(
            $quotationRequest,
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['quotation' => new QuotationVersionResource($quotation)],
            'Quotation draft created.',
            201,
        );
    }

    private function loadDetail(QuotationRequest $quotationRequest): void
    {
        $quotationRequest->loadCount('items');
        $quotationRequest->load([
            'assignedAdmin',
            'items.product',
            'items.supplier',
            'communications' => fn ($query) => $query->with('admin')->orderByDesc('contacted_at')->orderByDesc('id'),
            'quotations' => fn ($query) => $query
                ->with(['items.supplier', 'pdfs', 'emailLogs', 'createdByAdmin'])
                ->orderByDesc('version'),
        ]);
    }

    /**
     * @return list<array{id: int, name: string, email: string, role: string}>
     */
    private function assignableAdmins(): array
    {
        return Admin::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role'])
            ->map(fn (Admin $admin): array => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
            ])
            ->all();
    }
}
