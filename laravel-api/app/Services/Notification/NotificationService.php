<?php

namespace App\Services\Notification;

use App\Enums\NotificationType;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationRequest;

/**
 * Writes database-backed in-app notifications for Customers and Admins
 * (LogicFlow §14).
 *
 * Notifications are created after the business transaction commits, so a
 * notification problem can never undo a quotation, order or status change.
 * Customer notifications always use the ownership column that matches the
 * recipient so the notification API can scope every read defensively.
 */
class NotificationService
{
    public function quotationRequested(QuotationRequest $request, Customer $customer): void
    {
        $this->notifyCustomer(
            $customer,
            NotificationType::QUOTATION_REQUEST_RECEIVED,
            'Quotation request received',
            sprintf(
                'We received request %s. Our team will confirm pricing with the supplier.',
                $request->quotation_number,
            ),
            [
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
            ],
        );

        $this->notifyActiveAdmins(
            NotificationType::ADMIN_NEW_QUOTATION_REQUEST,
            'New quotation request',
            sprintf(
                '%s submitted request %s with %d line(s).',
                $request->customer_name,
                $request->quotation_number,
                $request->items()->count(),
            ),
            [
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
            ],
        );
    }

    public function quotationSent(Quotation $quotation): void
    {
        $quotation->loadMissing('quotationRequest');

        if ($quotation->quotationRequest === null) {
            return;
        }

        $this->notifyCustomerById(
            $quotation->quotationRequest->customer_id,
            NotificationType::QUOTATION_SENT,
            'Your quotation is ready',
            sprintf(
                'Quotation %s version %d is ready for review. It is valid until %s.',
                $quotation->quotation_number,
                $quotation->version,
                $quotation->valid_until?->format('d M Y') ?? 'further notice',
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'quotation_number' => $quotation->quotation_number,
                'version' => $quotation->version,
                'total_amount' => $quotation->total_amount,
            ],
        );
    }

    public function quotationAccepted(Quotation $quotation, Customer $customer, Order $order): void
    {
        $this->notifyCustomer(
            $customer,
            NotificationType::QUOTATION_ACCEPTED,
            'Quotation accepted',
            sprintf(
                'You accepted quotation %s version %d. Order %s has been created.',
                $quotation->quotation_number,
                $quotation->version,
                $order->order_number,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
        );

        $this->notifyActiveAdmins(
            NotificationType::ADMIN_QUOTATION_ACCEPTED,
            'Quotation accepted',
            sprintf(
                '%s accepted quotation %s version %d.',
                $customer->name,
                $quotation->quotation_number,
                $quotation->version,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
        );

        $this->notifyActiveAdmins(
            NotificationType::ADMIN_SUPPLIER_CONFIRMATION_REQUIRED,
            'Supplier confirmation required',
            sprintf(
                'Order %s needs supplier confirmation before preparation.',
                $order->order_number,
            ),
            [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'order_status' => $order->order_status->value,
            ],
        );
    }

    public function quotationRejected(Quotation $quotation, Customer $customer): void
    {
        $this->notifyCustomer(
            $customer,
            NotificationType::QUOTATION_REJECTED,
            'Quotation rejected',
            sprintf(
                'You rejected quotation %s version %d.',
                $quotation->quotation_number,
                $quotation->version,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
            ],
        );

        $this->notifyActiveAdmins(
            NotificationType::ADMIN_QUOTATION_REJECTED,
            'Quotation rejected',
            sprintf(
                '%s rejected quotation %s version %d.',
                $customer->name,
                $quotation->quotation_number,
                $quotation->version,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
            ],
        );
    }

    public function quotationChangeRequested(
        Quotation $quotation,
        Customer $customer,
        string $note,
    ): void {
        $this->notifyCustomer(
            $customer,
            NotificationType::QUOTATION_CHANGE_REQUESTED,
            'Change request sent',
            sprintf(
                'We sent your change request for quotation %s version %d to the team.',
                $quotation->quotation_number,
                $quotation->version,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'customer_note' => $note,
            ],
        );

        $this->notifyActiveAdmins(
            NotificationType::ADMIN_QUOTATION_CHANGE_REQUESTED,
            'Customer requested a change',
            sprintf(
                '%s requested a change to quotation %s version %d: %s',
                $customer->name,
                $quotation->quotation_number,
                $quotation->version,
                $note,
            ),
            [
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'customer_note' => $note,
            ],
        );
    }

    public function orderConfirmed(Order $order): void
    {
        $this->notifyCustomerById(
            $order->customer_id,
            NotificationType::ORDER_CONFIRMED,
            'Order confirmed',
            sprintf(
                'Order %s is confirmed with the supplier and is now being prepared.',
                $order->order_number,
            ),
            $this->orderData($order),
        );
    }

    public function orderOutForDelivery(Order $order): void
    {
        $this->notifyCustomerById(
            $order->customer_id,
            NotificationType::ORDER_OUT_FOR_DELIVERY,
            'Order out for delivery',
            sprintf(
                'Order %s is on its way. Please prepare %s MMK in cash for full payment on delivery.',
                $order->order_number,
                number_format($order->total_amount),
            ),
            $this->orderData($order),
        );
    }

    public function orderDelivered(Order $order): void
    {
        $this->notifyCustomerById(
            $order->customer_id,
            NotificationType::ORDER_DELIVERED,
            'Order delivered',
            sprintf(
                'Order %s was delivered in full. Cash collection is pending confirmation.',
                $order->order_number,
            ),
            $this->orderData($order),
        );
    }

    public function paymentConfirmed(Order $order): void
    {
        $this->notifyCustomerById(
            $order->customer_id,
            NotificationType::PAYMENT_CONFIRMED,
            'Payment confirmed',
            sprintf(
                'We received the full COD payment for order %s. The order is complete.',
                $order->order_number,
            ),
            $this->orderData($order),
        );
    }

    public function orderCancelled(Order $order): void
    {
        $this->notifyCustomerById(
            $order->customer_id,
            NotificationType::ORDER_CANCELLED,
            'Order cancelled',
            sprintf(
                'Order %s has been cancelled. Contact our team if you need help.',
                $order->order_number,
            ),
            $this->orderData($order),
        );
    }

    public function cashCollected(Order $order, Admin $admin): void
    {
        $this->notifyActiveAdmins(
            NotificationType::ADMIN_CASH_COLLECTION_RECORDED,
            'Cash collection recorded',
            sprintf(
                '%s recorded full cash collection for order %s (%s MMK).',
                $admin->name,
                $order->order_number,
                number_format($order->total_amount),
            ),
            $this->orderData($order) + [
                'payment_status' => $order->payment_status->value,
                'recorded_by_admin_id' => $admin->id,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function notifyCustomer(
        Customer $customer,
        NotificationType $type,
        string $title,
        string $message,
        array $data = [],
        ?Quotation $quotation = null,
        ?Order $order = null,
    ): Notification {
        return Notification::create([
            'recipient_type' => 'CUSTOMER',
            'recipient_id' => $customer->id,
            'customer_id' => $customer->id,
            'admin_id' => null,
            'quotation_id' => $quotation?->id,
            'order_id' => $order?->id,
            'type' => $type->value,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'is_read' => false,
        ]);
    }

    /**
     * Customer notifications raised from an order or quotation only carry the
     * owner id, so resolve the Customer row when the caller has no instance.
     *
     * @param  array<string, mixed>  $data
     */
    public function notifyCustomerById(
        ?int $customerId,
        NotificationType $type,
        string $title,
        string $message,
        array $data = [],
    ): ?Notification {
        if ($customerId === null) {
            return null;
        }

        $customer = Customer::query()->find($customerId);

        if ($customer === null) {
            return null;
        }

        $quotationId = isset($data['quotation_id']) ? (int) $data['quotation_id'] : null;
        $orderId = isset($data['order_id']) ? (int) $data['order_id'] : null;

        return Notification::create([
            'recipient_type' => 'CUSTOMER',
            'recipient_id' => $customer->id,
            'customer_id' => $customer->id,
            'admin_id' => null,
            'quotation_id' => $quotationId,
            'order_id' => $orderId,
            'type' => $type->value,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'is_read' => false,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function notifyAdmin(
        Admin $admin,
        NotificationType $type,
        string $title,
        string $message,
        array $data = [],
    ): Notification {
        return Notification::create([
            'recipient_type' => 'ADMIN',
            'recipient_id' => $admin->id,
            'customer_id' => null,
            'admin_id' => $admin->id,
            'quotation_id' => isset($data['quotation_id']) ? (int) $data['quotation_id'] : null,
            'order_id' => isset($data['order_id']) ? (int) $data['order_id'] : null,
            'type' => $type->value,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'is_read' => false,
        ]);
    }

    /**
     * Fan out one operational event to every active Admin recipient.
     *
     * @param  array<string, mixed>  $data
     */
    public function notifyActiveAdmins(
        NotificationType $type,
        string $title,
        string $message,
        array $data = [],
    ): void {
        Admin::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->get()
            ->each(function (Admin $admin) use ($type, $title, $message, $data): void {
                $this->notifyAdmin($admin, $type, $title, $message, $data);
            });
    }

    /**
     * @return array<string, mixed>
     */
    private function orderData(Order $order): array
    {
        return [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'order_status' => $order->order_status->value,
            'quotation_request_id' => $order->quotation_request_id,
        ];
    }
}
