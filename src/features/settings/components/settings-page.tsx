import { useEffect, useState } from "react";
import { Building2, FileText, Globe, Palette, Settings } from "lucide-react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardsSkeleton } from "@/components/common/skeletons";
import { GeneralSettingsForm } from "./general-settings-form";
import { CompanyProfileForm } from "./company-profile-form";
import { BrandingSettingsForm } from "./branding-settings-form";
import { ReceiptSettingsForm } from "./receipt-settings-form";

export function SettingsPage() {
  const [orgData, setOrgData] = useState<OrganizationSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    organizationRepository.getPrimaryOrganization().then((data) => {
      if (active) {
        setOrgData(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !orgData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Settings" description="Manage organization profile, branding, tax, and thermal receipt formats." />
        <CardsSkeleton count={2} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Organization Settings"
        description="Configure suite identity, legal registration, corporate branding, and point-of-sale receipt formats."
      />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted">
          <TabsTrigger value="general" className="text-xs gap-1.5 px-3">
            <Globe className="size-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="company" className="text-xs gap-1.5 px-3">
            <Building2 className="size-3.5" /> Company Profile
          </TabsTrigger>
          <TabsTrigger value="branding" className="text-xs gap-1.5 px-3">
            <Palette className="size-3.5" /> Branding
          </TabsTrigger>
          <TabsTrigger value="receipt" className="text-xs gap-1.5 px-3">
            <FileText className="size-3.5" /> Receipt Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsForm initialData={orgData} onSaved={setOrgData} />
        </TabsContent>

        <TabsContent value="company">
          <CompanyProfileForm initialData={orgData} onSaved={setOrgData} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSettingsForm initialData={orgData} onSaved={setOrgData} />
        </TabsContent>

        <TabsContent value="receipt">
          <ReceiptSettingsForm initialData={orgData} onSaved={setOrgData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
