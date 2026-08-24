import type { SalesSchema, SaleItemSchema, BranchSchema, OrganizationSchema } from "@/database/schema";
import { Printer, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef } from "react";
import { LOGO_IMAGES } from "@/components/common/logo";

interface ReceiptViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SalesSchema;
  items: SaleItemSchema[];
  branch?: BranchSchema | null;
  organization?: OrganizationSchema | null;
  /** If true, the print action emits a SALE_REPRINTED event */
  isReprint?: boolean;
  onReprint?: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCashierName(rawName?: string | null, fallbackId?: string): string {
  const val = rawName || fallbackId || "Cashier";
  if (val.includes("@")) {
    const username = val.split("@")[0];
    return username.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return val;
}

export function ReceiptView({
  open,
  onOpenChange,
  sale,
  items,
  branch,
  organization,
  isReprint = false,
  onReprint,
}: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const format = organization?.receipt_format || "compact_thermal";
  const showLogo = organization?.show_receipt_logo ?? true;
  const taxNote = organization?.receipt_tax_note || "";

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContent = receiptRef.current.innerHTML;
    const isA4 = format === "a4";
    const printWindow = window.open("", "_blank", isA4 ? "width=800,height=900" : "width=400,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt — ${sale.saleNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: ${isA4 ? "sans-serif" : "'Courier New', monospace"};
              font-size: ${isA4 ? "12px" : "11px"};
              width: ${isA4 ? "100%" : "80mm"};
              padding: ${isA4 ? "24px" : "8px"};
              color: #000;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .total-row { font-size: 14px; font-weight: bold; }
            .muted { color: #555; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { padding: 4px 0; text-align: left; }
            td:last-child, th:last-child { text-align: right; white-space: nowrap; }
          </style>
        </head>
        <body onload="window.print(); window.close();">${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    if (isReprint && onReprint) onReprint();
  };

  const branchName = branch?.name ?? organization?.name ?? "Store";
  const branchAddress = [branch?.address, branch?.city].filter(Boolean).join(", ") || organization?.address || "";
  const receiptPrefix = branch?.receiptPrefix ?? organization?.receipt_header ?? "";
  const receiptFooter = organization?.receipt_footer ?? "Thank you for your purchase!";

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={format === "a4" ? "max-w-xl" : "max-w-sm"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isReprint ? "Reprint Receipt" : "Sale Receipt"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Printed Content */}
        {format === "compact_thermal" ? (
          <div
            ref={receiptRef}
            className="bg-white text-black rounded-md border p-4 text-[11px] font-mono space-y-2"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {showLogo && (
              <div className="flex justify-center mb-2">
                <img src={LOGO_IMAGES.noBg} alt="Logo" className="h-8 w-auto object-contain grayscale" />
              </div>
            )}
            <div className="center bold" style={{ textAlign: "center" }}>
              <div className="bold" style={{ fontSize: 14, fontWeight: "bold" }}>{branchName}</div>
              {branchAddress && <div className="muted">{branchAddress}</div>}
              {receiptPrefix && <div className="muted" style={{ fontStyle: "italic", marginTop: 2 }}>{receiptPrefix}</div>}
            </div>

            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            <div className="row" style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>Receipt #</span>
              <span className="bold">{sale.saleNumber}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>Date</span>
              <span>{formatDate(sale.createdAt)}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>Cashier</span>
              <span>{formatCashierName(sale.createdByName, sale.createdBy)}</span>
            </div>

            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {items.map((item) => {
                  const label = item.packagingLabel
                    ? `${item.productName} (${item.packagingLabel})`
                    : item.productName;
                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: "top", paddingBottom: 4 }}>
                        <div>{label}</div>
                        <div className="muted">
                          {item.quantity} × ₦{item.unitPrice.toFixed(2)}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                        ₦{item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {sale.discountAmount > 0 && (
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span>₦{subtotal.toFixed(2)}</span>
              </div>
            )}
            {sale.discountAmount > 0 && (
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Discount</span>
                <span>-₦{sale.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              className="row total-row"
              style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 14 }}
            >
              <span>TOTAL</span>
              <span>₦{sale.totalAmount.toFixed(2)}</span>
            </div>
            <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Payment</span>
              <span className="bold" style={{ textTransform: "capitalize" }}>
                {sale.paymentMethod.replace("_", " ")}
              </span>
            </div>

            <div className="divider" style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {taxNote && (
              <div className="center" style={{ textAlign: "center", fontSize: 10, color: "#666" }}>
                {taxNote}
              </div>
            )}
            <div className="center" style={{ textAlign: "center", fontSize: 11, color: "#444", marginTop: 2 }}>
              {receiptFooter}
            </div>
            {isReprint && (
              <div className="center" style={{ textAlign: "center", fontSize: 10, color: "#888", marginTop: 4 }}>
                *** REPRINT ***
              </div>
            )}
          </div>
        ) : (
          <div
            ref={receiptRef}
            className="bg-white text-black rounded-md border p-6 text-xs font-sans space-y-4"
          >
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base uppercase">{branchName}</h3>
                {branchAddress && <p className="text-gray-600">{branchAddress}</p>}
                {receiptPrefix && <p className="italic text-gray-500 mt-1">{receiptPrefix}</p>}
              </div>
              {showLogo && (
                <img src={LOGO_IMAGES.noBg} alt="Logo" className="h-10 w-auto object-contain" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3">
              <div>
                <span className="text-gray-500">Receipt #: </span>
                <span className="font-bold">{sale.saleNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Date: </span>
                <span>{formatDate(sale.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-500">Cashier: </span>
                <span>{formatCashierName(sale.createdByName, sale.createdBy)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Payment Method: </span>
                <span className="capitalize">{sale.paymentMethod.replace("_", " ")}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border-b pb-3">
              <thead>
                <tr className="border-b font-bold">
                  <th className="py-1">Description</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Unit Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-1.5">{item.productName}</td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right">₦{item.unitPrice.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-bold">₦{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right space-y-1 font-bold text-sm">
              {sale.discountAmount > 0 && (
                <div className="text-xs font-normal text-gray-600">
                  Discount: -₦{sale.discountAmount.toFixed(2)}
                </div>
              )}
              <div>TOTAL: ₦{sale.totalAmount.toFixed(2)}</div>
            </div>

            <div className="border-t pt-3 text-center text-xs text-gray-600 space-y-1">
              {taxNote && <p className="text-[11px] text-gray-500">{taxNote}</p>}
              <p className="font-medium">{receiptFooter}</p>
              {isReprint && <p className="text-[10px] text-gray-400">*** REPRINT ***</p>}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            {isReprint ? "Reprint" : "Print"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
