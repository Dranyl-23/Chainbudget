import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  
  // Phase management:
  // 1 = Initial Splash (Single text line)
  // 2 = Initialization Checklist Card
  // 3 = Initialization Complete (Large circular checkmark)
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  // Checklist items completion state
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [step4Done, setStep4Done] = useState(false);

  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const completeFade = useRef(new Animated.Value(0)).current;
  const completeScale = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0.15)).current;
  const containerFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // --- Step 1 & 2: App Launch & Brand introduction ---
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0.35,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();

    // --- Transition to Step 3: Initialization Checklist ---
    const t1 = setTimeout(() => {
      setPhase(2);
      setStep1Done(true);
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Animated.timing(progressAnim, {
        toValue: 0.55,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }, 1200);

    const t2 = setTimeout(() => {
      setStep2Done(true);
      Animated.timing(progressAnim, {
        toValue: 0.75,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 1800);

    const t3 = setTimeout(() => {
      setStep3Done(true);
      Animated.timing(progressAnim, {
        toValue: 0.9,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 2400);

    const t4 = setTimeout(() => {
      setStep4Done(true);
      Animated.timing(progressAnim, {
        toValue: 1.0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }, 2900);

    // --- Transition to Step 4: Initialization Complete ---
    const t5 = setTimeout(() => {
      setPhase(3);
      Animated.parallel([
        Animated.timing(completeFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(completeScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }, 3400);

    // --- Transition to Step 5: Landing Page ---
    const t6 = setTimeout(() => {
      Animated.timing(containerFade, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerFade, paddingTop: insets.top }]}>
      {/* Background Decorators */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient 
          colors={['#05040F', '#0B0A18', '#05040F']} 
          style={StyleSheet.absoluteFillObject}
          locations={[0, 0.5, 1]}
        />
        
        {/* Subtle Blockchain Network Abstract Background */}
        <Image 
          source={require('../../assets/Blocks.png')}
          style={{ position: 'absolute', top: -screenWidth * 0.16, right: -screenWidth * 0.32, width: screenWidth * 1.1, height: screenWidth * 1.1, opacity: 0.05 }}
          resizeMode="contain"
        />
        <Image 
          source={require('../../assets/Blocks.png')}
          style={{ position: 'absolute', bottom: -screenWidth * 0.16, left: -screenWidth * 0.37, width: screenWidth * 1.0, height: screenWidth * 1.0, opacity: 0.04 }}
          resizeMode="contain"
        />
      </View>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {phase !== 3 ? (
          <>
            {/* Hero Element (Logo + Glow) */}
            <Animated.View 
              style={[
                styles.logoContainer, 
                { 
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }] 
                }
              ]}
            >
              {/* Subtle Cyan Glow Behind Logo */}
              <View style={styles.glowCore} />
              <View style={styles.glowOuter} />
              
              <Image 
                source={require('../../assets/3D-Chainbudget.png')} 
                style={styles.logo}
                resizeMode="contain" 
              />
            </Animated.View>

            {/* Branding */}
            <Animated.View style={[styles.brandingContainer, { opacity: contentFade }]}>
              <Text style={styles.titleText}>
                <Text style={{ color: '#ffffff' }}>Chain</Text>
                <Text style={{ color: '#00E5FF' }}>Budget</Text>
              </Text>
              <Text style={styles.subtitleText}>Transparent & Accountable</Text>
            </Animated.View>

            {/* Step 2 vs Step 3 Central Display */}
            {phase === 1 ? (
              /* Phase 1: Simple text status */
              <Animated.View style={[styles.phase1Container, { opacity: contentFade }]}>
                <Text style={styles.singleStatusText}>Initializing secure ledger</Text>
                
                <View style={styles.progressTrack}>
                  <Animated.View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }
                    ]} 
                  />
                </View>
              </Animated.View>
            ) : (
              /* Phase 2: Checklist Card (Step 3 in mock-up) */
              <Animated.View style={[styles.checklistCard, { opacity: cardFade }]}>
                {/* Item 1 */}
                <View style={styles.checklistItem}>
                  <Ionicons 
                    name={step1Done ? "checkmark" : "ellipse-outline"} 
                    size={16} 
                    color={step1Done ? "#10b981" : "rgba(255,255,255,0.3)"} 
                  />
                  <Text style={[styles.checklistText, step1Done && styles.checklistTextActive]}>
                    Initializing secure ledger
                  </Text>
                </View>

                {/* Item 2 */}
                <View style={styles.checklistItem}>
                  <Ionicons 
                    name={step2Done ? "checkmark" : "ellipse-outline"} 
                    size={16} 
                    color={step2Done ? "#10b981" : "rgba(255,255,255,0.3)"} 
                  />
                  <Text style={[styles.checklistText, step2Done && styles.checklistTextActive]}>
                    Connecting to network
                  </Text>
                </View>

                {/* Item 3 */}
                <View style={styles.checklistItem}>
                  <Ionicons 
                    name={step3Done ? "checkmark" : "ellipse-outline"} 
                    size={16} 
                    color={step3Done ? "#10b981" : "rgba(255,255,255,0.3)"} 
                  />
                  <Text style={[styles.checklistText, step3Done && styles.checklistTextActive]}>
                    Verifying integrity
                  </Text>
                </View>

                {/* Item 4 */}
                <View style={styles.checklistItem}>
                  {step4Done ? (
                    <Ionicons name="checkmark" size={16} color="#10b981" />
                  ) : step3Done ? (
                    <ActivityIndicator size="small" color="#00E5FF" style={{ transform: [{ scale: 0.7 }] }} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={16} color="rgba(255,255,255,0.3)" />
                  )}
                  <Text style={[styles.checklistText, step4Done && styles.checklistTextActive]}>
                    Loading resources
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        ) : (
          /* Step 4: Initialization Complete Screen */
          <Animated.View 
            style={[
              styles.completeContainer, 
              { 
                opacity: completeFade,
                transform: [{ scale: completeScale }] 
              }
            ]}
          >
            {/* Glowing Layered Checkmark Badge */}
            <View style={styles.completeIconWrapper}>
              <View style={styles.completeIconGlow} />
              <View style={styles.completeIconBadge}>
                <Ionicons name="checkmark-sharp" size={44} color="#10b981" />
              </View>
            </View>

            {/* Header Text */}
            <Text style={styles.completeTitle}>Initialization Complete</Text>
            <Text style={styles.completeSubtitle}>Redirecting to landing page...</Text>

            {/* Progress track at 100% */}
            <View style={[styles.progressTrack, { marginTop: 32 }]}>
              <View style={[styles.progressBar, { width: '100%', backgroundColor: '#00E5FF' }]} />
            </View>
          </Animated.View>
        )}
      </View>

      {/* Security Footer (Constant across all splash steps) */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.footerInner}>
          <Ionicons name="cube-outline" size={15} color="#00E5FF" style={{ opacity: 0.8 }} />
          <Text style={styles.footerText}>Secured by Polygon</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05040F',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  logo: {
    width: 140,
    height: 140,
    zIndex: 10,
  },
  glowCore: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    zIndex: 1,
  },
  glowOuter: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    zIndex: 0,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 15,
    color: '#00E5FF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  phase1Container: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    marginTop: 20,
  },
  singleStatusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 280,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 2,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  checklistCard: {
    width: '100%',
    maxWidth: 290,
    backgroundColor: '#0B0A1C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  checklistText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    marginLeft: 12,
    fontWeight: '500',
  },
  checklistTextActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  completeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  completeIconWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    position: 'relative',
  },
  completeIconGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    zIndex: 0,
  },
  completeIconBadge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2.5,
    borderColor: '#10b981',
    backgroundColor: '#070614',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00E5FF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  completeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
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
    opacity: 0.7,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 6,
    fontWeight: '600',
  },
});
