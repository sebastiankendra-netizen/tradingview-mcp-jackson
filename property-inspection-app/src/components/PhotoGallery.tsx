import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../lib/theme';

interface PhotoItem {
  uri: string; // local URI or remote URL
  id?: string;
}

interface Props {
  photos: PhotoItem[];
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  readonly?: boolean;
  maxPhotos?: number;
}

export default function PhotoGallery({
  photos,
  onAdd,
  onRemove,
  readonly = false,
  maxPhotos = 10,
}: Props) {
  const canAdd = !readonly && photos.length < maxPhotos;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Add photo button */}
        {canAdd && (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
            <Ionicons name="camera" size={24} color={Colors.primary} />
            <Text style={styles.addLabel}>Add Photo</Text>
          </TouchableOpacity>
        )}

        {/* Photo thumbnails */}
        {photos.map((photo, index) => (
          <View key={photo.id ?? index} style={styles.thumbContainer}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
            {!readonly && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove?.(index)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Ionicons name="close-circle" size={20} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Empty state when readonly and no photos */}
        {readonly && photos.length === 0 && (
          <Text style={styles.emptyText}>No photos</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  addBtn: {
    width: 80,
    height: 80,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  addLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  thumbContainer: {
    position: 'relative',
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: Radius.sm,
    resizeMode: 'cover',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingVertical: Spacing.md,
  },
});
