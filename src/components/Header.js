import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';

/**
 * Standard Header for Void Ultra
 * @param {string} title
 * @param {boolean} showBack
 * @param {React.ReactNode} rightContent
 * @param {string} subTitle
 */
export default function Header({ title, showBack, rightContent, subTitle }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={s.container}>
        <View style={s.left}>
          {showBack && (
            <Pressable 
              onPress={() => navigation.goBack()} 
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
              hitSlop={15}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </Pressable>
          )}
          <View>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            {subTitle ? <Text style={s.subTitle}>{subTitle}</Text> : null}
          </View>
        </View>

        <View style={s.right}>
          {rightContent}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: 10,
    marginLeft: -4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: -2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
