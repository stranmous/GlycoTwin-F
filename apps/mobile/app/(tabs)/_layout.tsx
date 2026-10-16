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

// Warm Teal FAB with diffused glow ring + web hover states
function CenterFAB() {
  const router = useRouter();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);
  const hoverScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * hoverScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: 1 + (1 - scale.value) * 1.5 }],
  }));

  function onPress() {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    glowOpacity.value = withTiming(0.8, { duration: 100 }, () => {
      glowOpacity.value = withTiming(0.4, { duration: 350 });
    });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push('/scan/camera');
  }

  const hoverProps = Platform.OS === 'web' ? {
    onMouseEnter: () => {
      hoverScale.value = withSpring(1.08, { damping: 12, stiffness: 300 });
      glowOpacity.value = withTiming(0.7, { duration: 180 });
    },
    onMouseLeave: () => {
      hoverScale.value = withSpring(1, { damping: 14, stiffness: 300 });
      glowOpacity.value = withTiming(0.4, { duration: 220 });
    },
  } : {};

  return (
    <Animated.View style={[styles.fabWrapper, animStyle]}>
      {/* Diffused glow ring */}
      <Animated.View style={[styles.fabGlow, glowStyle]} />
      <TouchableOpacity
        onPress={onPress}
        style={styles.fab}
        accessibilityLabel="Scan a meal"
        accessibilityRole="button"
        activeOpacity={1}
        {...hoverProps}
      >
        <Svg
          width={62}
          height={62}
          style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
          viewBox="0 0 62 62"
        >
          <Defs>
            <LinearGradient id="fabGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2AA89A" />
              <Stop offset="1" stopColor="#006A61" />
            </LinearGradient>
          </Defs>
          <Circle cx="31" cy="31" r="31" fill="url(#fabGrad)" />
        </Svg>
        <View style={styles.fabIconWrap}>
          <Camera size={26} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Individual tab button with warm indicators
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
        scale.value = withSpring(0.92, { damping: 12, stiffness: 400 }, () => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        });
      }}
      {...(Platform.OS === 'web' ? {
        onMouseEnter: () => {
          scale.value = withSpring(1.08, { damping: 14, stiffness: 350 });
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
      <Animated.View
        style={[
          styles.hoverPill,
          { backgroundColor: isFocused ? 'rgba(42,168,154,0.08)' : 'rgba(61,61,61,0.04)' },
          hoverStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View style={animStyle}>
        {IconComp ? <IconComp size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} /> : null}
      </Animated.View>
      {/* Warm active indicator dot */}
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
    </Tabs>
  );
}

function GlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = theme.background?.val === '#1C1917' ||
    (theme.background?.val ?? '').includes('28,25');

  const active = '#2AA89A';
  const inactive = isDark ? '#A8A29E' : '#8E8E8E';

  return (
    <View style={[styles.tabBarOuter, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark
                ? '#292524'
                : '#FFFFFF',
            },
          ]}
        />
      )}

      {/* Top subtle warm border */}
      <View style={styles.topBorder} />

      {/* Tabs row */}
      <View style={styles.tabRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          if (options.href === null) return null;

          const isFocused = state.index === index;

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
    minHeight: TAB_BAR_HEIGHT,
    position: 'relative',
    overflow: 'visible',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  topBorder: {
    height: 1,
    backgroundColor: 'rgba(61,61,61,0.06)',
  },
  tabRow: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 4,
    position: 'relative',
  },
  hoverPill: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    bottom: 6,
    borderRadius: 14,
  },
  indicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
    bottom: 12,
    alignSelf: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(42,168,154,0.22)',
    top: -7,
    left: -7,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(42,168,154,0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
});
