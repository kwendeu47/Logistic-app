import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView } from "expo-camera";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { colors, spacing, typography } from "../../constants/theme";
import { getApiErrorMessage } from "../../api/client";
import * as bookingsApi from "../../api/bookings.api";
import { useQrScanner } from "../../hooks/useQrScanner";
import type { BookingsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<BookingsStackParamList, "QrScan">;

export function QrScanScreen({ route, navigation }: Props) {
  const { bookingId, stage } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScanned(data: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      if (stage === "QR_SCAN_DEPARTURE" || stage === "QR_SCAN_ARRIVAL") {
        await bookingsApi.scanQrCheckpoint(bookingId, { scannedCode: data, stage, photoUrls: [] });
      }
      navigation.goBack();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setIsSubmitting(false);
      resetScanner();
    }
  }

  const { permissionStatus, requestPermission, handleBarcodeScanned, resetScanner } = useQrScanner(handleScanned);

  useEffect(() => {
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (permissionStatus !== "granted") {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is needed to scan the QR seal.</Text>
        <Button label="Grant camera access" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={isSubmitting ? undefined : handleBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.overlayText}>Point the camera at the QR seal</Text>
      </SafeAreaView>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
        </View>
      )}

      {error && (
        <SafeAreaView style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Try again" onPress={() => setError(null)} style={styles.retryButton} />
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  camera: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: spacing.lg },
  overlayText: {
    ...typography.body,
    color: colors.white,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  errorOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorText: { ...typography.body, color: colors.danger, marginBottom: spacing.md, textAlign: "center" },
  retryButton: {},
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionText: { ...typography.body, color: colors.text, textAlign: "center", marginBottom: spacing.lg },
});
