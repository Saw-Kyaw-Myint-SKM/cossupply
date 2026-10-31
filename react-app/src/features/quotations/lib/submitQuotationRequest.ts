/**
 * Quotation request submission orchestration (Task 06).
 *
 * One testable seam for the page's submit flow: optionally save a new
 * address to the address book, POST the quotation request, and — strictly
 * only on success — clear the cart (LogicFlow §5: the cart is cleared after
 * the request, and a failed request must never lose the buyer's snapshot).
 *
 * The cart is emptied through the injected `clearCart` function, never by
 * touching storage here, so the "preserved on failure / cleared on success"
 * behavior is a pure unit-testable decision.
 */
import type { Translator } from '../../../lib/i18n-context';
import type { ApiResponse } from '../../../api/client';
import type { CustomerAddress, CustomerAddressInput } from '../../customer/api/addressesApi';
import { createCustomerAddress } from '../../customer/api/addressesApi';
import { createQuotationRequest, type QuotationRequest, type QuotationRequestInput } from '../api/quotationsApi';

export type QuotationSubmitResult =
  | { ok: true; quotationRequest: QuotationRequest }
  | {
      ok: false;
      /** Which API call rejected the submission. */
      stage: 'address' | 'request';
      message: string;
      /** 422 field errors, keyed with Laravel keys (e.g. `items.0.quantity`). */
      errors?: Record<string, string[]>;
      /** 401/403: the caller should send the buyer back to `/login`. */
      needsLogin: boolean;
    };

export interface QuotationSubmitContext {
  payload: QuotationRequestInput;
  /** When set, this address is saved first, then the request is submitted. */
  addressInput?: CustomerAddressInput | null;
  t: Translator;
  /** Invoked from the cart context after — and only after — a 201. */
  clearCart: () => void;
}

/** Injectable API calls so tests can stub the transport. */
export interface QuotationSubmitDeps {
  createAddress?: (
    input: CustomerAddressInput,
  ) => Promise<ApiResponse<{ address: CustomerAddress }>>;
  createRequest?: (
    input: QuotationRequestInput,
  ) => Promise<ApiResponse<{ quotation_request: QuotationRequest }>>;
}

function asFailure(
  response: ApiResponse<unknown>,
  stage: 'address' | 'request',
  fallback: string,
): QuotationSubmitResult {
  const needsLogin = response.status === 401 || response.status === 403;

  return {
    ok: false,
    stage,
    message: response.message ?? fallback,
    errors: response.errors,
    needsLogin,
  };
}

/**
 * Submit the quotation request. Returns the result to the caller; cart
 * clearing only ever happens on the success path (a 201 from the request
 * endpoint, after any requested address save also succeeded).
 */
export async function submitQuotationRequest(
  context: QuotationSubmitContext,
  deps: QuotationSubmitDeps = {},
): Promise<QuotationSubmitResult> {
  const createAddress =
    deps.createAddress ?? ((input: CustomerAddressInput) => createCustomerAddress(input));
  const createRequest =
    deps.createRequest ?? ((input: QuotationRequestInput) => createQuotationRequest(input));

  if (context.addressInput) {
    const addressResponse = await createAddress(context.addressInput);

    if (!addressResponse.success) {
      return asFailure(addressResponse, 'address', context.t('addressSaveFailed'));
    }
  }

  const response = await createRequest(context.payload);

  if (!response.success || !response.data) {
    const result = asFailure(
      response,
      'request',
      context.t('quotationSubmitFailed'),
    );

    return result;
  }

  context.clearCart();
  return { ok: true, quotationRequest: response.data.quotation_request };
}
