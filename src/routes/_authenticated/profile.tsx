import { createFileRoute } from "@tanstack/react-router";

import { UserProfilePage } from "@/features/profile/components/user-profile-page";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Just Sly Suite" },
      { name: "description", content: "Manage your account profile, security and preferences." },
      { property: "og:title", content: "Profile — Just Sly Suite" },
      { property: "og:description", content: "Manage your account profile, security and preferences." },
    ],
  }),
  component: UserProfilePage,
});
