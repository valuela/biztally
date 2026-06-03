"use client";

import Link from "next/link";
import { Camera, PackagePlus, ScanBarcode, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";
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

const retailBarcodeFormats = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
];

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
  const lastScannedBarcodeRef = useRef("");
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
      setScanStatus(`Scanned ${normalized}, but no inventory item uses this barcode.`);
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
    setScanStatus("Starting rear camera...");
    lastScannedBarcodeRef.current = "";

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, retailBarcodeFormats);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 300,
        tryPlayVideoTimeout: 5000,
      });
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const controls = await reader.decodeFromConstraints(constraints, videoRef.current, (result, error) => {
        if (result) {
          const text = result.getText().trim();
          if (text && text !== lastScannedBarcodeRef.current) {
            lastScannedBarcodeRef.current = text;
            selectBarcode(text);
          }
          return;
        }

        if (error && !(error instanceof NotFoundException)) {
          setScanStatus(error.message);
        }
      });

      scannerControlsRef.current = controls;
      setScanStatus("Hold the barcode inside the frame, fill most of the box, and keep it steady.");
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

          <div className={isScanning ? "relative overflow-hidden rounded-[var(--radius-sm)] bg-black md:max-w-xl" : "hidden"}>
            <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="h-24 w-[82%] rounded-[var(--radius-sm)] border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.35)] sm:h-28" />
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              Keep the barcode horizontal and well lit
            </div>
          </div>

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
