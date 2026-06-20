import { useCallback, useState } from "react";
import { Camera, type CameraCapturedPicture } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

export function useCamera() {
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">(
    "undetermined",
  );

  const requestPermission = useCallback(async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : "denied");
    return status === "granted";
  }, []);

  const pickFromLibrary = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  }, []);

  return {
    permissionStatus,
    requestPermission,
    pickFromLibrary,
  };
}

export type { CameraCapturedPicture };
