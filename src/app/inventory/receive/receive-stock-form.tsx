"use client";

import Link from "next/link";
import { Camera, PackagePlus, ScanBarcode, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
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

function ReceiveStockButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <PackagePlus size={16} />
      {pending ? "Saving stock..." : "Receive stock"}
    </Button>
  );
}

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
    <form action={receiveInventoryStock} className="space-y-5">
      <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Label htmlFor="barcode_lookup">1. Find item</Label>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Scan the barcode first. If the camera struggles, type the barcode or choose the item below.
            </p>
          </div>
          {isScanning ? (
            <Button type="button" variant="secondary" className="w-full gap-2 sm:w-auto" onClick={stopScanner}>
              <X size={16} />
              Stop
            </Button>
          ) : (
            <Button type="button" className="w-full gap-2 sm:w-auto" onClick={startScanner}>
              <Camera size={16} />
              Scan barcode
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              id="barcode_lookup"
              inputMode="numeric"
              value={barcodeValue}
              onChange={(event) => setBarcodeValue(event.target.value)}
              onBlur={(event) => {
                if (event.target.value.trim()) selectBarcode(event.target.value);
              }}
              className="h-11 pl-9"
              placeholder="Scan or enter barcode"
            />
          </div>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => selectBarcode(barcodeValue)}>
            Match item
          </Button>
        </div>

        <div className={isScanning ? "relative overflow-hidden rounded-[var(--radius-sm)] bg-black" : "hidden"}>
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover sm:aspect-video" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="h-24 w-[82%] rounded-[var(--radius-sm)] border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.35)] sm:h-28" />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 w-[90%] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-center text-xs font-medium text-white sm:w-auto">
            Keep the barcode horizontal and well lit
          </div>
        </div>

        <p className="text-xs text-[var(--muted)]">{scanStatus}</p>
      </section>

      <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="space-y-2">
          <Label htmlFor="inventory_item_id">Selected item</Label>
          <select
            id="inventory_item_id"
            name="inventory_item_id"
            required
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="">Choose item if barcode was not scanned</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.brand_name ? ` - ${item.brand_name}` : ""}
                {item.barcode ? ` - ${item.barcode}` : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedItem ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {selectedItem.name}
              {selectedItem.brand_name ? ` - ${selectedItem.brand_name}` : ""}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {hasSavedPackageSize
                ? `${selectedItem.default_package_size} ${stockUnit} per pack. Enter only how many packs you bought.`
                : "No package size saved yet. Add it once below so future receipts are faster."}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">2. Purchase details</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Fill these in from the receipt or package.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vendor_id">Bought from</Label>
            <select
              id="vendor_id"
              name="vendor_id"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
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

          <CostFields
            key={selectedItem?.id ?? "no-item"}
            currency={currency}
            stockUnit={stockUnit}
            idPrefix="receive_"
            defaultPackageSize={selectedItem?.default_package_size}
            defaultPackageUnit={selectedItem?.default_package_unit}
            lockPackageSize={hasSavedPackageSize}
            mode="receive"
          />

          <div className="space-y-2">
            <Label htmlFor="expiration_date">Expiration date</Label>
            <Input id="expiration_date" name="expiration_date" type="date" className="h-11" />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Optional receipt notes</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Use these only if you need traceability.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="batch_code">Receipt or batch code</Label>
            <Input id="batch_code" name="batch_code" className="h-11" placeholder="Receipt #, lot #, or delivery code" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              placeholder="Receipt notes or purchase details"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/inventory"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            Cancel
          </Link>
          <ReceiveStockButton />
        </div>
      </div>
    </form>
  );
}
