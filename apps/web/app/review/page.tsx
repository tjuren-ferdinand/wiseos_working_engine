"use client";

import ReviewWorkbench from "@/components/ReviewWorkbench";
import PageHeader from "@/components/ui/PageHeader";

export default function ReviewPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Granskning"
        title="Granska rättningar"
        subtitle="Granska och publicera AI-rättade prov till dina elever."
      />

      <ReviewWorkbench />
    </div>
  );
}
