/**
 * Visionneuse d'image ECG (JPEG/PNG) avec pinch-to-zoom et pan.
 * Utilise react-native-gesture-handler v2 + react-native-reanimated.
 */
import React, { useEffect, useState } from 'react';
import { View, Image, Text, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/i18n';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface ECGImageViewerProps {
  uri: string;
  height?: number;
  fullscreen?: boolean;
  onSingleTap?: () => void;
}

export function ECGImageViewer({ uri, height: fixedHeight, fullscreen = false, onSingleTap }: ECGImageViewerProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const containerHeight = fixedHeight ?? 260;
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [uri]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(0.5, Math.min(5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTap)
    .runOnJS(true)
    .onEnd(() => {
      if (onSingleTap) onSingleTap();
    });

  const tapGesture = Gesture.Exclusive(doubleTap, singleTap);
  const gesture = Gesture.Simultaneous(pinch, pan, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!uri) {
    return (
      <View
        style={[
          styles.placeholder,
          { height: containerHeight, backgroundColor: colors.semantic.cardBg },
        ]}
      >
        <Text style={[styles.placeholderText, { color: colors.neutral.textMuted }]}>
          {t.ecg.emptyTrace}
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View
        style={[
          styles.placeholder,
          { height: containerHeight, backgroundColor: colors.semantic.cardBg },
        ]}
      >
        <Text style={[styles.placeholderText, { color: colors.semantic.error }]}>
          {t.ecg.imageLoadError}
        </Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.container,
          {
            height: containerHeight,
            backgroundColor: colors.semantic.cardBg,
            borderColor: colors.neutral.border,
          },
        ]}
      >
        <AnimatedImage
          key={uri}
          source={{ uri }}
          style={[
            {
              width: screenWidth,
              height: containerHeight,
            },
            animatedStyle,
          ]}
          resizeMode="contain"
          onError={() => setLoadError(true)}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeholder: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  placeholderText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
