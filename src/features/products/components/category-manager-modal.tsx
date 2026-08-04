import React, { useState, useEffect } from "react";
import { Plus, Tag, ChevronRight, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { categoryRepository } from "@/repositories/category.repository";
import type { CategorySchema } from "@/database/schema";

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

function CategoryForm({
  categories,
  onSave,
  onCancel,
  editTarget,
}: {
  categories: CategorySchema[];
  onSave: () => void;
  onCancel: () => void;
  editTarget?: CategorySchema | null;
}) {
  const [name, setName] = useState(editTarget?.name ?? "");
  const [parentId, setParentId] = useState(editTarget?.parentId ?? "");
  const [description, setDescription] = useState(editTarget?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Category name is required."); return; }
    setSaving(true);
    setError("");
    try {
      if (editTarget) {
        await categoryRepository.updateCategory(editTarget.id, {
          name: name.trim(),
          parentId: parentId || null,
          description: description.trim() || undefined,
        });
      } else {
        await categoryRepository.createCategory({
          name: name.trim(),
          parentId: parentId || null,
          description: description.trim() || undefined,
        });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-xl bg-muted/30">
      <h4 className="text-sm font-semibold">{editTarget ? "Edit Category" : "Add New Category"}</h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="cat-name">Category Name *</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beverages"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-parent">Parent Category (optional)</Label>
          <select
            id="cat-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
          >
            <option value="">— Top Level —</option>
            {categories
              .filter((c) => !editTarget || c.id !== editTarget.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Description (optional)</Label>
          <Input
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {editTarget ? "Update" : "Add Category"}
        </Button>
      </div>
    </form>
  );
}

export function CategoryManagerModal({ isOpen, onClose, onCategoriesChanged }: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<CategorySchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CategorySchema | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await categoryRepository.getActiveCategories();
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setShowForm(false);
      setEditTarget(null);
    }
  }, [isOpen]);

  const handleSaved = () => {
    setShowForm(false);
    setEditTarget(null);
    loadCategories();
    onCategoriesChanged?.();
  };

  const handleEdit = (cat: CategorySchema) => {
    setEditTarget(cat);
    setShowForm(true);
  };

  const handleArchive = async (cat: CategorySchema) => {
    if (!confirm(`Archive category "${cat.name}"? Products in this category will become uncategorized.`)) return;
    await categoryRepository.archiveCategory(cat.id);
    loadCategories();
    onCategoriesChanged?.();
  };

  // Group into parent → children
  const rootCategories = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Manage Categories
          </DialogTitle>
          <DialogDescription>
            View, add, and edit product categories. Sub-categories are indented under their parent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add button */}
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Category
            </Button>
          )}

          {/* Inline form */}
          {showForm && (
            <CategoryForm
              categories={categories}
              editTarget={editTarget}
              onSave={handleSaved}
              onCancel={() => { setShowForm(false); setEditTarget(null); }}
            />
          )}

          {/* Category list */}
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No categories yet. Add your first category above.
            </div>
          ) : (
            <div className="space-y-1">
              {rootCategories.map((root) => (
                <React.Fragment key={root.id}>
                  {/* Root row */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                    <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{root.name}</span>
                      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{root.code}</Badge>
                      {root.description && (
                        <p className="text-xs text-muted-foreground truncate">{root.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(root)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => handleArchive(root)} title="Archive" className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Children rows */}
                  {childrenOf(root.id).map((child) => (
                    <div key={child.id} className="flex items-center gap-2 p-2.5 pl-8 rounded-lg hover:bg-muted/40 transition-colors group">
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate">{child.name}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{child.code}</Badge>
                        {child.description && (
                          <p className="text-xs text-muted-foreground truncate">{child.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(child)} title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleArchive(child)} title="Archive" className="text-muted-foreground hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
