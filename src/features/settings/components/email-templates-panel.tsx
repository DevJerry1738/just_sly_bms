import { useState, useEffect } from "react";
import { formatSafe } from "@/lib/format-date";
import { Mail, Edit, Save, Variable, CheckCircle, Code } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { emailTemplateRepository } from "@/repositories/email-template.repository";
import { systemSettingsService } from "@/services/settings/system-settings.service";
import type { EmailTemplateSchema } from "@/database/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function EmailTemplatesPanel() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplateSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateSchema | null>(null);

  // Edit form state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const items = await emailTemplateRepository.getAllTemplates();
      setTemplates(items);
    } catch (err) {
      console.error("[EmailTemplatesPanel] Failed to load templates:", err);
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleOpenEditor = (t: EmailTemplateSchema) => {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBody(t.body);
    setIsActive(t.isActive);
  };

  const handleInsertVariable = (v: string) => {
    setBody((prev) => `${prev} {{${v}}}`);
  };

  const handleSave = async () => {
    if (!selectedTemplate || !user) return;
    setSaving(true);
    try {
      await systemSettingsService.updateEmailTemplate(
        selectedTemplate.id,
        { subject, body, isActive },
        user.id,
        user.email || "Admin"
      );
      toast.success(`Updated template '${selectedTemplate.name}'`);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (err) {
      console.error("[EmailTemplatesPanel] Save failed:", err);
      toast.error("Failed to save email template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border shadow-xs">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="size-4 text-primary" /> Email Dispatch Templates
        </CardTitle>
        <CardDescription>
          Manage subject lines and content templates for automated transactional emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading email templates...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {t.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{t.key}</span>
                    </div>
                    <h4 className="text-sm font-semibold">{t.name}</h4>
                  </div>
                  <Badge variant={t.isActive ? "default" : "secondary"} className="text-[10px]">
                    {t.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Subject Line:</p>
                  <p className="text-xs font-mono bg-muted/40 p-2 rounded truncate">{t.subject}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                  <span>Updated: {formatSafe(t.updatedAt, "MMM dd, yyyy")}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenEditor(t)}>
                    <Edit className="size-3.5 mr-1" /> Edit Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Editor Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Code className="size-4 text-primary" /> Edit Email Template: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Template Active Status</Label>
                  <p className="text-[11px] text-muted-foreground">Enables or disables dispatch for this notification trigger.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-xs font-semibold">
                  Email Subject Line
                </Label>
                <Input
                  id="subject"
                  className="h-9 text-xs font-mono"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body" className="text-xs font-semibold">
                    Email Body Content (Plain text / HTML)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Click variable to insert</span>
                </div>

                {/* Variable helper chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {selectedTemplate?.variables.map((v) => (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[10px] font-mono gap-1"
                      onClick={() => handleInsertVariable(v)}
                    >
                      <Variable className="size-2.5" /> {"{{" + v + "}}"}
                    </Badge>
                  ))}
                </div>

                <Textarea
                  id="body"
                  rows={8}
                  className="font-mono text-xs"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="size-4 mr-1.5" /> {saving ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
