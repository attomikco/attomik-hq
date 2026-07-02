import { LOGO_BLACK_B64 } from "@/lib/pdf/logos";

// The logo is embedded as an inline CID attachment (not a data URI, which
// Gmail strips, nor a hosted URL, which wouldn't render before deploy).
// The email HTML references it via <img src="cid:INVOICE_LOGO_CID">.
export const INVOICE_LOGO_CID = "attomik-logo";

const b64 = LOGO_BLACK_B64.replace(/^data:image\/\w+;base64,/, "");

/** Resend inline attachment for the brand logo. */
export const invoiceLogoAttachment = {
  filename: "attomik-logo.png",
  content: Buffer.from(b64, "base64"),
  contentId: INVOICE_LOGO_CID,
};
