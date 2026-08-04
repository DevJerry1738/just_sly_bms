import React, { useState } from "react";
import { Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { productImportService, generateImportTemplate, type ImportPreview } from "@/services/product-import.service";
import { useAuth } from "@/providers/auth-provider";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setLoading(true);

    try {
      const res = await productImportService.preview(selected);
      setPreview(res);
      setStep("preview");
    } catch (err) {
      alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || !file || !user) return;
    setLoading(true);

    try {
      await productImportService.importRows(
        preview.valid,
        file.name,
        user.id,
        user.displayName ?? user.email
      );
      onSuccess();
      handleClose();
    } catch (err) {
      alert("Error committing product import.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setStep("upload");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Upload an Excel sheet (.xlsx) to import multiple products into the product catalog.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-4 hover:border-primary transition-colors">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Click or drag Excel file to this area to upload</p>
                <p className="text-xs text-muted-foreground">Supports .xlsx and .xls formats</p>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                disabled={loading}
                className="cursor-pointer text-sm"
              />
            </div>

            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium">Need the standard import format?</p>
                <p className="text-xs text-muted-foreground">Download the sample template pre-filled with example data.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => generateImportTemplate()}>
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Rows</p>
                <p className="text-xl font-bold text-blue-600">{preview.totalRows}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Valid Rows</p>
                <p className="text-xl font-bold text-emerald-600">{preview.valid.length}</p>
              </div>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Invalid Rows</p>
                <p className="text-xl font-bold text-rose-600">{preview.invalid.length}</p>
              </div>
            </div>

            {preview.invalid.length > 0 && (
              <div className="border border-rose-500/20 rounded-lg p-3 bg-rose-500/5 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Validation Errors (Row skipped during import):
                </p>
                <ul className="text-xs space-y-1 text-rose-500">
                  {preview.invalid.map((inv, idx) => (
                    <li key={idx}>
                      Row {inv.rowIndex}: {inv.errors.map((e) => e.message).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border rounded-lg overflow-x-auto max-h-56">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Code</th>
                    <th className="p-2">Unit</th>
                    <th className="p-2">Cost</th>
                    <th className="p-2">Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2 font-medium">{r.name}</td>
                      <td className="p-2">{r.code || "Auto"}</td>
                      <td className="p-2">{r.baseUnit}</td>
                      <td className="p-2 font-mono">₦{r.costPrice}</td>
                      <td className="p-2 font-mono">₦{r.retailPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {step === "preview" && (
            <Button onClick={handleCommit} disabled={loading || preview?.valid.length === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Import {preview?.valid.length} Valid Products
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
