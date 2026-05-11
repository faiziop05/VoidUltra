import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { toggleChecklistItem } from '../utils/database';
import { useTheme } from '../theme/useTheme';

export default function ChecklistBlock({ items = [], onToggle }) {
  const [localItems, setLocalItems] = useState(items);
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleToggle = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !item.is_checked;
    setLocalItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, is_checked: newVal } : i)
    );
    await toggleChecklistItem(item.id, newVal);
    if (onToggle) onToggle(item.id, newVal);
  };

  if (!localItems || localItems.length === 0) return null;

  return (
    <View style={styles.container}>
      {localItems.map(item => (
        <Pressable
          key={item.id}
          style={styles.row}
          onPress={() => handleToggle(item)}
          hitSlop={8}
        >
          <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
            <Ionicons
              name="checkmark"
              size={12}
              color={colors.background}
              style={{ opacity: item.is_checked ? 1 : 0 }}
            />
          </View>
          <Text style={[styles.itemText, item.is_checked && styles.itemTextDone]}>
            {item.content}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    paddingLeft: 46,
    marginBottom: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: colors.primary,
    lineHeight: 22,
  },
  itemTextDone: {
    color: colors.secondary,
    textDecorationLine: 'line-through',
  },
});
