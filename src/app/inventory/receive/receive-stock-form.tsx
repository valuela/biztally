"use client";

import Link from "next/link";
import { Camera, PackagePlus, ScanBarcode, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CostFields } from "../new/cost-fields";
import { receiveInventoryStock } from "./actions";

type InventoryOption = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  barcode: string | null;
  default_package_size: string | number | null;
  default_package_unit: string | null;
};

type VendorOption = {
  id: string;
  name: string;
};

export function ReceiveStockForm({
  currency,
  items,
  vendors,
}: {
  currency: string;
  items: InventoryOption[];
  vendors: VendorOption[];
}) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanStatus, setScanStatus] = useState("Scan a barcode or enter it manually.");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);
  const stockUnit = selectedItem?.default_package_unit ?? selectedItem?.unit ?? "";
  const hasSavedPackageSize = selectedItem?.default_package_size != null && selectedItem.default_package_size !== "";

  function findItemByBarcode(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;
    return items.find((item) => item.barcode?.trim() === normalized) ?? null;
  }

  function selectBarcode(value: string) {
    const normalized = value.trim();
    setBarcodeValue(normalized);

    const matchedItem = findItemByBarcode(normalized);
    if (!matchedItem) {
      setScanStatus(`No inventory item found for barcode ${normalized}.`);
      return false;
    }

    setSelectedItemId(matchedItem.id);
    setScanStatus(`Matched ${matchedItem.name}${matchedItem.brand_name ? ` - ${matchedItem.brand_name}` : ""}.`);
    stopScanner();
    return true;
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setIsScanning(false);
  }

  async function startScanner() {
    if (!videoRef.current) return;

    setIsScanning(true);
    setScanStatus("Starting camera...");

    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          selectBarcode(result.getText());
          return;
        }

        if (error && !(error instanceof NotFoundException)) {
          setScanStatus(error.message);
        }
      });

      scannerControlsRef.current = controls;
      setScanStatus("Point your camera at the item barcode.");
    } catch (error) {
      setIsScanning(false);
      setScanStatus(error instanceof Error ? error.message : "Camera scanning is not available in this browser.");
    }
  }

  return (
    <form action={receiveInventoryStock} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-4 md:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label htmlFor="barcode_lookup">Find item by barcode</Label>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Scan with your phone camera, then enter purchase details for the matched item.
              </p>
            </div>
            <div className="flex gap-2">
              {isScanning ? (
                <Button type="button" variant="secondary" className="gap-2" onClick={stopScanner}>
                  <X size={16} />
                  Stop
                </Button>
              ) : (
                <Button type="button" className="gap-2" onClick={startScanner}>
                  <Camera size={16} />
                  Scan barcode
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                id="barcode_lookup"
                value={barcodeValue}
                onChange={(event) => setBarcodeValue(event.target.value)}
                onBlur={(event) => {
                  if (event.target.value.trim()) {
                    selectBarcode(event.target.value);
                  }
                }}
                className="pl-9"
                placeholder="Scan or enter barcode"
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => selectBarcode(barcodeValue)}>
              Match item
            </Button>
          </div>

          <video
            ref={videoRef}
            muted
            playsInline
            className={isScanning ? "aspect-video w-full rounded-[var(--radius-sm)] bg-black object-cover md:max-w-xl" : "hidden"}
          />

          <p className="text-xs text-[var(--muted)]">{scanStatus}</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="inventory_item_id">Existing item</Label>
          <select
            id="inventory_item_id"
            name="inventory_item_id"
            required
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.brand_name ? ` - ${item.brand_name}` : ""}
                {item.barcode ? ` - ${item.barcode}` : ""}
              </option>
            ))}
          </select>
          {selectedItem ? (
            <p className="text-xs text-[var(--muted)]">
              {hasSavedPackageSize
                ? `This item uses ${selectedItem.default_package_size} ${stockUnit} per pack.`
                : `Stock will be added in ${selectedItem.unit}. Add the package size once for this batch.`}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor_id">Bought from</Label>
          <select
            id="vendor_id"
            name="vendor_id"
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            defaultValue=""
          >
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch_code">Batch or receipt code</Label>
          <Input id="batch_code" name="batch_code" placeholder="Receipt #, lot #, or delivery code" />
        </div>

        <CostFields
          key={selectedItem?.id ?? "no-item"}
          currency={currency}
          stockUnit={stockUnit}
          idPrefix="receive_"
          defaultPackageSize={selectedItem?.default_package_size}
          defaultPackageUnit={selectedItem?.default_package_unit}
          lockPackageSize={hasSavedPackageSize}
        />

        <div className="space-y-2">
          <Label htmlFor="expiration_date">Expiration date</Label>
          <Input id="expiration_date" name="expiration_date" type="date" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="min-h-[110px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Receipt notes or purchase details"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
        >
          Cancel
        </Link>
        <Button type="submit" className="gap-2">
          <PackagePlus size={16} />
          Receive stock
        </Button>
      </div>
    </form>
  );
}
