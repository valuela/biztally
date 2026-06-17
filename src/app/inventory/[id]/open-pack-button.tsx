"use client";

import { PackageOpen } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { openInventoryPack } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" className="h-10 gap-2" disabled={pending}>
      <PackageOpen size={16} />
      {pending ? "Opening..." : "Open pack"}
    </Button>
  );
}

export function OpenPackButton({ itemId }: { itemId: string }) {
  const action = openInventoryPack.bind(null, itemId);

  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
