import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'tamagui';
import {
  BarChart2,
  Bot,
  Camera,
  Home,
  TrendingUp,
} from '@tamagui/lucide-icons';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';

const TAB_BAR_HEIGHT = 64;

function hapticSelection() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

// Mint gradient FAB with glow ring + web hover states
function CenterFAB() {
  const router = useRouter();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);
  const hoverScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * hoverScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: 1 + (1 - scale.value) * 2 }],
  }));

  function onPress() {
    scale.value = withSpring(0.88, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    glowOpacity.value = withTiming(0.9, { duration: 100 }, () => {
      glowOpacity.value = withTiming(0.5, { duration: 400 });
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/scan/camera');
  }

  const hoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => {
      hoverScale.value = withSpring(1.12, { damping: 12, stiffness: 300 });
      glowOpacity.value = withTiming(0.85, { duration: 180 });
    },
    onMouseLeave: () => {
      hoverScale.value = withSpring(1, { damping: 14, stiffness: 300 });
      glowOpacity.value = withTiming(0.5, { duration: 220 });
    },
  } : {};

  return (
    <Animated.View style={[styles.fabWrapper, animStyle]}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.fabGlow, glowStyle]} />
      <TouchableOpacity
        onPress={onPress}
        style={styles.fab}
        accessibilityLabel="Scan a meal"
        accessibilityRole="button"
        activeOpacity={1}
        {...hoverProps}
      >
        {/* Gradient circle via SVG */}
        <Svg
          width={62}
          height={62}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          viewBox="0 0 62 62"
        >
          <Defs>
            <LinearGradient id="fabGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2DD4BF" />
              <Stop offset="1" stopColor="#0098A0" />
            </LinearGradient>
          </Defs>
          <Circle cx="31" cy="31" r="31" fill="url(#fabGrad)" />
        </Svg>
        <View style={styles.fabIconWrap}>
          <Camera size={26} color="white" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Individual tab button with hover & press animation
function TabButton({
  route,
  isFocused,
  options,
  navigation,
  active,
  inactive,
}: any) {
  const scale = useSharedValue(1);
  const bg = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const hoverStyle = useAnimatedStyle(() => ({
    opacity: bg.value,
  }));

  const IconComp = options.tabBarIcon;
  const color = isFocused ? active : inactive;

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={() => {
        if (!isFocused) {
          hapticSelection();
          navigation.navigate(route.name);
        }
        scale.value = withSpring(0.88, { damping: 12, stiffness: 400 }, () => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        });
      }}
      // Web hover via pointer events
      {...(Platform.OS === 'web' ? {
        onMouseEnter: () => {
          scale.value = withSpring(1.12, { damping: 14, stiffness: 350 });
          bg.value = withTiming(1, { duration: 160 });
        },
        onMouseLeave: () => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
          bg.value = withTiming(0, { duration: 200 });
        },
      } : {})}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.title}
    >
      {/* Hover pill background */}
      <Animated.View
        style={[
          styles.hoverPill,
          { backgroundColor: isFocused ? 'rgba(45,212,191,0.1)' : 'rgba(186,202,197,0.07)' },
          hoverStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View style={animStyle}>
        {IconComp ? <IconComp size={22} color={color} /> : null}
      </Animated.View>
      {/* Active indicator dot */}
      <View
        style={[
          styles.indicator,
          { opacity: isFocused ? 1 : 0, backgroundColor: active },
        ]}
      />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.insights'),
          tabBarIcon: ({ color, size }) => <BarChart2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan-placeholder"
        options={{
          title: t('tabs.scan'),
          tabBarButton: () => <CenterFAB />,
        }}
      />
      <Tabs.Screen
        name="simulation"
        options={{
          title: t('tabs.simulation'),
          tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: t('tabs.coach'),
          tabBarIcon: ({ color, size }) => <Bot size={size} color={color} />,
        }}
      />
      {/* scan-placeholder hidden from tab title but keeps route */}
    </Tabs>
  );
}

function GlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = theme.background?.val === '#0E1726' ||
    (theme.background?.val ?? '').includes('14,23');

  const active = '#2DD4BF';
  const inactive = isDark ? 'rgba(186,202,197,0.45)' : 'rgba(107,122,118,0.6)';

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom }]}>
      {/* Frosted glass layer */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark
                ? 'rgba(14,23,38,0.93)'
                : 'rgba(247,249,251,0.95)',
            },
          ]}
        />
      )}

      {/* Top border — mint tint */}
      <View style={styles.topBorder} />

      {/* Tabs row */}
      <View style={styles.tabRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          // Skip hidden screens
          if (options.href === null) return null;

          const isFocused = state.index === index;

          // Center FAB slot
          if (options.tabBarButton) {
            return (
              <View key={route.key} style={styles.fabSlot}>
                {options.tabBarButton({})}
              </View>
            );
          }

          return (
            <TabButton
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              navigation={navigation}
              active={active}
              inactive={inactive}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    height: TAB_BAR_HEIGHT + 34,
    position: 'relative',
    overflow: 'visible',
  },
  topBorder: {
    height: 1,
    backgroundColor: 'rgba(45,212,191,0.18)',
  },
  tabRow: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    gap: 4,
    position: 'relative',
  },
  hoverPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 12,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  fabIconWrap: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(45,212,191,0.28)',
    top: -9,
    left: -9,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(45,212,191,0.5)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
  },
});
