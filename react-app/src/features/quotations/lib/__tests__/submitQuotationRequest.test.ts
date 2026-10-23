/**
 * Unit tests for the quotation-request submission orchestration (Task 06).
 *
 * The key business rule from LogicFlow §5 lives here: the cart is cleared
 * only after a successful request — a failed POST (validation or otherwise)
 * must preserve the buyer's order list.
 */
import { describe, expect, it, vi } from 'vitest';
import { submitQuotationRequest, type QuotationSubmitContext } from '../submitQuotationRequest';
import type { QuotationRequest } from '../../api/quotationsApi';

const quotationRequest: QuotationRequest = {
  id: 42,
  quotation_number: 'QT-2026-0042',
  status: 'NEW',
  customer_name: 'Daw Hla',
  phone: '09-770-100-200',
  city: 'Yangon',
  township: 'Bahan',
  delivery_address: 'No. 12, Merchant St',
  items: [],
};

function context(overrides: Partial<QuotationSubmitContext> = {}): QuotationSubmitContext {
  return {
    payload: {
      items: [{ product_id: 1, quantity: 2 }],
      name: 'Daw Hla',
      phone: '09-770-100-200',
      city: 'Yangon',
      delivery_address: 'No. 12, Merchant St',
    },
    clearCart: vi.fn(),
    ...overrides,
  };
}

/** Alias narrowing: a failure result or an unreachable error for the type checker. */
function expectFailure(
  result: Awaited<ReturnType<typeof submitQuotationRequest>>,
): Extract<typeof result, { ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected the submission to fail');
  return result;
}

const successResponse = () => ({
  success: true,
  data: { quotation_request: quotationRequest },
});

describe('submitQuotationRequest', () => {
  it('clears the cart exactly once on a 201 and returns the created request', async () => {
    const deps = { createRequest: vi.fn().mockResolvedValue(successResponse()) };
    const order = context();

    const result = await submitQuotationRequest(order, deps);

    expect(deps.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Daw Hla', items: [{ product_id: 1, quantity: 2 }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected the submission to succeed');
    expect(result.quotationRequest.quotation_number).toBe('QT-2026-0042');
    expect(order.clearCart).toHaveBeenCalledTimes(1);
  });

  it('preserves the cart on validation failure (422) and surfaces keyed errors', async () => {
    const order = context({ addressInput: null });
    const deps = {
      createRequest: vi.fn().mockResolvedValue({
        success: false,
        status: 422,
        message: 'The given data was invalid.',
        errors: { 'items.0.quantity': ['The quantity must be at least 2.'] },
      }),
    };

    const result = await submitQuotationRequest(order, deps);
    const failure = expectFailure(result);

    expect(failure.errors).toEqual({ 'items.0.quantity': ['The quantity must be at least 2.'] });
    expect(failure.message).toBe('The given data was invalid.');
    expect(order.clearCart).not.toHaveBeenCalled();
  });

  it('preserves the cart on a network failure and names the problem', async () => {
    const order = context({ addressInput: null });
    const result = await submitQuotationRequest(order, {
      createRequest: vi
        .fn()
        .mockResolvedValue({ success: false, message: 'Network error', status: undefined }),
    });

    const failure = expectFailure(result);

    expect(failure.message).toBe('Network error');
    expect(order.clearCart).not.toHaveBeenCalled();
  });

  it('flags 401/403 as needing a login redirect without clearing the cart', async () => {
    for (const status of [401, 403]) {
      const order = context({ addressInput: null });
      const result = await submitQuotationRequest(order, {
        createRequest: vi
          .fn()
          .mockResolvedValue({ success: false, status, message: 'Unauthenticated.' }),
      });

      const failure = expectFailure(result);

      expect(failure.needsLogin).toBe(true);
      expect(order.clearCart).not.toHaveBeenCalled();
    }
  });

  it('saves the requested address first, then submits the request', async () => {
    const createAddress = vi.fn().mockResolvedValue({ success: true, data: {} });
    const createRequest = vi.fn().mockResolvedValue(successResponse());
    const order = context({
      addressInput: {
        contact_name: 'U Min',
        phone: '09-1',
        city: 'Mandalay',
        township: 'Chanayethazan',
        full_address: '86th St',
      },
    });

    await submitQuotationRequest(order, { createAddress: createAddress as never, createRequest: createRequest as never });

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({ contact_name: 'U Min', city: 'Mandalay' }),
    );
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(order.clearCart).toHaveBeenCalledTimes(1);
  });

  it('stops on address-save failure without submitting or clearing the cart', async () => {
    const createAddress = vi.fn().mockResolvedValue({
      success: false,
      status: 422,
      message: 'The given data was invalid.',
      errors: { phone: ['The phone field is required.'] },
    });
    const createRequest = vi.fn();
    const order = context({
      addressInput: { contact_name: '', phone: '', city: '', township: '', full_address: '' },
    });

    const result = await submitQuotationRequest(order, {
      createAddress: createAddress as never,
      createRequest: createRequest as never,
    });
    const failure = expectFailure(result);

    expect(failure.errors).toEqual({ phone: ['The phone field is required.'] });
    expect(createRequest).not.toHaveBeenCalled();
    expect(order.clearCart).not.toHaveBeenCalled();
  });
});
