"use client";

import { Trash2 } from "lucide-react";
import { deleteSale } from "./actions";

export function DeleteSaleButton({ saleId }: { saleId: string }) {
  return (
    <form
      action={deleteSale.bind(null, saleId)}
      onSubmit={(event) => {
        if (!window.confirm("Delete this sale? Its quantity will return to production availability.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        <Trash2 size={15} />
        Delete
      </button>
    </form>
  );
}
