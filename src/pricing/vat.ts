/** Finnish VAT on electricity, included in every price the providers give */
export const VAT_PERCENT = 25.5;

/** A price with VAT included, without it */
export const withoutVat = (price: number): number =>
  price / (1 + VAT_PERCENT / 100);
