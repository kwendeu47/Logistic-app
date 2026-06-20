import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";

interface PhotoUploadGridProps {
  photos: string[];
  minPhotos?: number;
  maxPhotos?: number;
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
}

export function PhotoUploadGrid({
  photos,
  minPhotos = 2,
  maxPhotos = 6,
  onAddPhoto,
  onRemovePhoto,
}: PhotoUploadGridProps) {
  const remaining = Math.max(0, minPhotos - photos.length);
  const canAddMore = photos.length < maxPhotos;

  return (
    <View>
      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <View key={uri + index} style={styles.cell}>
            <Image source={{ uri }} style={styles.photo} />
            <TouchableOpacity style={styles.removeButton} onPress={() => onRemovePhoto(index)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {canAddMore && (
          <TouchableOpacity style={[styles.cell, styles.addCell]} onPress={onAddPhoto}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addLabel}>Add photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={remaining > 0 ? styles.warning : styles.helper}>
        {remaining > 0
          ? `Add ${remaining} more photo${remaining > 1 ? "s" : ""} (minimum ${minPhotos} required)`
          : `${photos.length} of ${maxPhotos} photos added`}
      </Text>
    </View>
  );
}

const CELL_SIZE = 96;

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.overlay,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  addCell: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  addIcon: { fontSize: 24, color: colors.primary, fontWeight: "700" },
  addLabel: { ...typography.small, color: colors.primary, marginTop: 2 },
  warning: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
  helper: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
});
