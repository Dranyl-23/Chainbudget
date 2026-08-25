import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onFinish: () => void;
}

const STATUS_MESSAGES = [
  'Connecting to Polygon Amoy network...',
  'Verifying zero-knowledge vault...',
  'Synchronizing decentralized ledger...',
  'Workspace ready',
];

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Dynamic cycling micro-status
  const [statusIndex, setStatusIndex] = useState(0);

  // ── Animation Controllers ──
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  const contentFade = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(16)).current;

  const progressAnim = useRef(new Animated.Value(0.08)).current;
  const statusFade = useRef(new Animated.Value(1)).current;
  const containerFade = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Periodic Specular Shimmer Ray across 3D metallic wallet
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
      ])
    );
    shimmerLoop.start();

    // ── STAGE 1: Smooth Entrance ──
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 900,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 900,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.32,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // ── STAGE 2: Micro-Status Message 2 ──
    const t1 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusFade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(statusFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setStatusIndex(1);

      Animated.timing(progressAnim, {
        toValue: 0.62,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 1200);

    // ── STAGE 3: Micro-Status Message 3 ──
    const t2 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusFade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(statusFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setStatusIndex(2);

      Animated.timing(progressAnim, {
        toValue: 0.88,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 2200);

    // ── STAGE 4: Micro-Status Message 4 (Workspace Ready) ──
    const t3 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusFade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(statusFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setStatusIndex(3);

      Animated.timing(progressAnim, {
        toValue: 1.0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 3100);

    // ── STAGE 5: Cinematic Smooth Dissolve Exit ──
    const t4 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerFade, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, 3800);

    return () => {
      shimmerLoop.stop();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerFade, paddingTop: insets.top }]}>
      {/* ── ATMOSPHERIC BACKGROUND ── */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={['#03020A', '#070617', '#020108']}
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.5, 1]}
        />

        {/* Subtle Blockchain Network Abstract Background */}
        <Image
          source={require('../../assets/Blocks.png')}
          style={{
            position: 'absolute',
            top: -screenWidth * 0.15,
            right: -screenWidth * 0.3,
            width: screenWidth * 1.15,
            height: screenWidth * 1.15,
            opacity: 0.05,
          }}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/Blocks.png')}
          style={{
            position: 'absolute',
            bottom: -screenWidth * 0.15,
            left: -screenWidth * 0.35,
            width: screenWidth * 1.05,
            height: screenWidth * 1.05,
            opacity: 0.04,
          }}
          resizeMode="contain"
        />
      </View>

      {/* ── MAIN HERO & CONTENT ── */}
      <View style={styles.contentContainer}>
        <Animated.View
          style={[
            styles.heroSection,
            {
              transform: [{ scale: exitScale }],
            },
          ]}
        >
          {/* ── 3D FLOATING WALLET CONTAINER ── */}
          <View style={styles.heroWrapper}>
            {/* Static 3D Wallet Logo */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image
                source={require('../../assets/3D-Chainbudget.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              {/* Specular Light-Ray Shimmer */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmerSweep,
                  {
                    transform: [
                      {
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-140, 140],
                        }),
                      },
                      { rotate: '25deg' },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.65)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </Animated.View>
          </View>

          {/* ── BRANDING & TYPOGRAPHY ── */}
          <Animated.View
            style={[
              styles.brandingContainer,
              {
                opacity: contentFade,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <Text style={styles.titleText}>
              <Text style={{ color: '#ffffff' }}>Chain</Text>
              <Text style={{ color: '#00E5FF' }}>Budget</Text>
            </Text>

            {/* Futuristic Protocol Tagline Pill */}
            <View style={styles.taglinePill}>
              <View style={styles.livePulseDot} />
              <Text style={styles.subtitleText}>ON-CHAIN TREASURY PROTOCOL</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── SLEEK QUANTUM NEON LOADER ── */}
        <Animated.View
          style={[
            styles.loaderSection,
            {
              opacity: contentFade,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {/* Ambient Progress Track */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={['#00E5FF', '#8B5CF6', '#EC4899', '#10B981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>

          {/* Micro-Status Telemetry Text */}
          <Animated.View style={{ opacity: statusFade, alignItems: 'center', marginTop: 12 }}>
            <Text style={styles.statusText}>
              {STATUS_MESSAGES[statusIndex]}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── MINIMALIST SECURITY FOOTER ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 22) }]}>
        <View style={styles.footerInner}>
          <Ionicons name="shield-checkmark" size={13} color="#00E5FF" style={{ opacity: 0.9 }} />
          <Text style={styles.footerText}>SECURED BY POLYGON</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03020A',
  },
  topAmbientMesh: {
    position: 'absolute',
    top: '12%',
    left: '15%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  bottomAmbientMesh: {
    position: 'absolute',
    bottom: '15%',
    right: '10%',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(147, 51, 234, 0.04)',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  heroWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    position: 'relative',
    height: 155,
    width: 155,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'hidden',
    borderRadius: 40,
  },
  logo: {
    width: 148,
    height: 148,
  },
  shimmerSweep: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 50,
    height: 200,
    zIndex: 15,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  titleText: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 8,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.18)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  subtitleText: {
    fontSize: 10.5,
    color: '#00E5FF',
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  loaderSection: {
    width: '100%',
    maxWidth: 260,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 14,
    paddingVertical: 5.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    letterSpacing: 1.3,
    marginLeft: 6,
    fontWeight: '800',
  },
});
