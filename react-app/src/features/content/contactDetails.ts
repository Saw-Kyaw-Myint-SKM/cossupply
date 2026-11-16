/**
 * Public contact channels for the storefront contact page.
 *
 * These are placeholders: replace the handles and hrefs with the real
 * CoSupply accounts before launch. Keeping them in one module means the
 * contact page (and any future footer or help link) always show the same
 * channels, and switching a number never means hunting through JSX.
 */
export interface ContactChannelDetail {
  /** What the buyer sees, e.g. the Viber number or support address. */
  handle: string;
  /** Where the card sends the buyer: viber://, https://, mailto: or tel:. */
  href: string;
}

export const CONTACT_DETAILS = {
  viber: { handle: '09 000 000 000', href: 'viber://chat?number=%2B959000000000' },
  telegram: { handle: '@cossupply', href: 'https://t.me/cossupply' },
  email: { handle: 'support@cos.shop', href: 'mailto:support@cos.shop' },
  phone: { handle: '09 000 000 000', href: 'tel:+959000000000' },
} as const satisfies Record<string, ContactChannelDetail>;

export type ContactChannelId = keyof typeof CONTACT_DETAILS;

/** Reading order: chat first, then the async and direct channels. */
export const CONTACT_CHANNEL_ORDER: readonly ContactChannelId[] = [
  'viber',
  'telegram',
  'email',
  'phone',
];
