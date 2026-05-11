import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, DeviceEventEmitter, Dimensions } from 'react-native';

const ALERT_EVENT = 'SHOW_CUSTOM_ALERT';

export const CustomAlertManager = {
  alert: (title, message, buttons = [], options = {}) => {
    DeviceEventEmitter.emit(ALERT_EVENT, { title, message, buttons, options });
  }
};

export default function CustomAlert() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(ALERT_EVENT, (c) => setConfig(c));
    return () => sub.remove();
  }, []);

  if (!config) return null;

  const handlePress = (button) => {
    setConfig(null);
    if (button?.onPress) button.onPress();
  };

  const defaultButtons = [{ text: 'OK', onPress: () => {} }];
  const buttons = config.buttons && config.buttons.length > 0 ? config.buttons : defaultButtons;

  // Render vertical layout if more than 2 buttons for better UI
  const isVertical = buttons.length > 2;

  return (
    <Modal
      transparent
      visible={true}
      animationType="fade"
      onRequestClose={() => {
        if (config.options?.cancelable !== false) setConfig(null);
      }}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.textContainer}>
            {!!config.title && <Text style={s.title}>{config.title}</Text>}
            {!!config.message && <Text style={s.message}>{config.message}</Text>}
          </View>
          
          <View style={[s.buttonsWrapper, isVertical ? s.buttonsVertical : s.buttonsHorizontal]}>
            {buttons.map((b, i) => {
              const destructive = b.style === 'destructive';
              const cancel = b.style === 'cancel' || b.style === 'default'; // keep default neutral if you have destructive
              
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    s.button,
                    isVertical ? s.buttonVert : s.flexibleButton,
                    destructive && s.btnDestructive,
                    cancel && s.btnCancel,
                    pressed && s.btnPressed,
                    !isVertical && i === 0 && buttons.length === 2 && s.btnLeft,
                  ]}
                  onPress={() => handlePress(b)}
                >
                  <Text style={[
                    s.buttonText,
                    destructive && s.textDestructive,
                    cancel && s.textCancel,
                  ]}>
                    {b.text || 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
  },
  buttonsHorizontal: {
    flexDirection: 'row',
  },
  buttonsVertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexibleButton: {
    flex: 1,
  },
  buttonVert: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  btnLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5E5',
  },
  btnPressed: {
    backgroundColor: '#F0F0F0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  textDestructive: {
    color: '#EF4444',
  },
  textCancel: {
    color: '#888',
    fontWeight: '500',
  },
});
