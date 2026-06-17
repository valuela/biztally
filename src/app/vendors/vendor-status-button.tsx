"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { toggleVendorStatus } from "./actions";

function SubmitButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" className="h-9 px-3 text-xs" disabled={pending}>
      {pending ? "Updating..." : isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function VendorStatusButton({ vendorId, isActive }: { vendorId: string; isActive: boolean }) {
  const action = toggleVendorStatus.bind(null, vendorId, isActive);
  return (
    <form action={action}>
      <SubmitButton isActive={isActive} />
    </form>
  );
}
