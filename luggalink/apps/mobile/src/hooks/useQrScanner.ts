import { useCallback, useRef, useState } from "react";
import { Camera, type BarcodeScanningResult } from "expo-camera";

export function useQrScanner(onScanned: (data: string) => void) {
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">(
    "undetermined",
  );
  const hasScannedRef = useRef(false);

  const requestPermission = useCallback(async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : "denied");
    return status === "granted";
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      onScanned(result.data);
    },
    [onScanned],
  );

  const resetScanner = useCallback(() => {
    hasScannedRef.current = false;
  }, []);

  return {
    permissionStatus,
    requestPermission,
    handleBarcodeScanned,
    resetScanner,
  };
}
