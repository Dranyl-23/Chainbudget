import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
  Image,
  ScrollView,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';
import AnimatedToggleSwitch from '../components/AnimatedToggleSwitch';
import api from '../lib/api';

const ORG_TYPES = [
  { value: 'student_org', label: 'Student Org', category: 'Institutional', governing: 'OSA / Student Affairs', icon: 'school-outline', desc: 'University councils, academic societies & clubs' },
  { value: 'barangay', label: 'Barangay / SK Fund', category: 'Institutional', governing: 'DILG / COMELEC', icon: 'business-outline', desc: 'Barangay LGU units, youth councils & public funds' },
  { value: 'cooperative', label: 'Cooperative', category: 'Institutional', governing: 'CDA', icon: 'people-outline', desc: 'Credit, agrarian, multipurpose & transport coops' },
  { value: 'homeowners_association', label: 'Homeowners (HOA)', category: 'Institutional', governing: 'DHSUD / HLURB', icon: 'key-outline', desc: 'Subdivision & condo residential associations' },
  { value: 'ngo', label: 'NGO / Foundation', category: 'Institutional', governing: 'SEC / BIR', icon: 'heart-outline', desc: 'Non-stock non-profits, foundations & charities' },
  { value: 'church', label: 'Church / Religious', category: 'Community', governing: 'SEC / Diocesan HQ', icon: 'home-outline', desc: 'Churches, parishes, ministries & fellowships' },
  { value: 'sports_club', label: 'Sports Club', category: 'Community', governing: 'NSA / League / LGU', icon: 'trophy-outline', desc: 'Athletic teams, dojos & sporting clubs' },
  { value: 'startup', label: 'Startup / Company', category: 'Commercial & Informal', governing: 'DTI / SEC', icon: 'rocket-outline', desc: 'Ventures, small enterprises & corporate teams' },
  { value: 'fundraising', label: 'Fundraising Campaign', category: 'Commercial & Informal', governing: 'DSWD / Barangay', icon: 'gift-outline', desc: 'Disaster relief, medical aid & charity pools' },
  { value: 'family', label: 'Family / Estate', category: 'Commercial & Informal', governing: 'Private / Civil', icon: 'people-circle-outline', desc: 'Shared household splitting & family trusts' },
];

const ID_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'umid', label: 'UMID / SSS / GSIS' },
  { value: 'national_id', label: 'Philippine National ID (PhilSys)' },
  { value: 'school_id', label: 'Institutional / School ID' },
  { value: 'prc_id', label: 'PRC ID' },
  { value: 'postal_id', label: 'Postal ID' },
  { value: 'voters_id', label: "Voter's ID" },
];

const getPillarBadge = (grp: any) => {
  const kinds = grp?.kinds || [];
  if (grp?.id?.startsWith('rep_') || kinds.some((k: string) => k.includes('id') || k.includes('selfie'))) {
    return { name: 'Pillar 3 · Signatory KYC', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' };
  }
  if (
    grp?.id?.includes('authorization') ||
    grp?.id?.includes('resolution') ||
    kinds.some((k: string) => k.includes('resolution') || k.includes('endorsement') || k.includes('authorization') || k.includes('plan'))
  ) {
    return { name: 'Pillar 2 · Signatory Authority', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
  }
  return { name: 'Pillar 1 · Institutional Existence', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
};

export default function CreateOrganizationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { user, refreshUser } = useAuth();
  const { refreshOrgs, setActiveOrgId } = useOrg();
  const { showToast } = useToast();
  const { on: onSocketEvent } = useSocket();

  const initialAppId = route.params?.applicationId;

  // Global wizard state
  const [appId, setAppId] = useState<string | null>(initialAppId || null);
  const [application, setApplication] = useState<any>(null);
  const [requirements, setRequirements] = useState<any>(null);
  const [stepIndex, setStepIndex] = useState<number>(0); // 0: Category, 1: Details, 2: Rep, 3: Docs, 4: Governance, 5: Review
  const [loading, setLoading] = useState<boolean>(true);
  const [savingStep, setSavingStep] = useState<boolean>(false);

  // Form State: Step 0 (Category)
  const [selectedType, setSelectedType] = useState<string>('student_org');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Form State: Step 1 (Details)
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [yearEstablished, setYearEstablished] = useState('');
  const [mission, setMission] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [extras, setExtras] = useState<Record<string, string>>({});

  // Form State: Step 2 (Representative)
  const [repFullName, setRepFullName] = useState('');
  const [repPosition, setRepPosition] = useState('');
  const [repIdType, setRepIdType] = useState('national_id');
  const [repIdLast4, setRepIdLast4] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [authorizedConfirmed, setAuthorizedConfirmed] = useState(true);
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);

  // Form State: Step 3 (Documents)
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form State: Step 4 (Governance)
  const [requiredApprovals, setRequiredApprovals] = useState('2');
  const [highValueThreshold, setHighValueThreshold] = useState('10000');
  const [isPrivate, setIsPrivate] = useState(false);
  const [officers, setOfficers] = useState<any[]>([]);
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [newOfficerRole, setNewOfficerRole] = useState('2');
  const [newOfficerLabel, setNewOfficerLabel] = useState('Finance Officer');

  // Form State: Step 5 (Review & Consents)
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentAccuracy, setConsentAccuracy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success Celebration Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // 1. Fetch requirements for chosen category
  const loadRequirements = useCallback(async (typeKey: string) => {
    try {
      const res = await api.get(`/org-applications/requirements?type=${typeKey}`);
      setRequirements(res.data);
    } catch {
      showToast('Could not load category requirements.', 'error');
    }
  }, [showToast]);

  // Populate state from application object
  const populateFromApp = useCallback((app: any) => {
    setApplication(app);
    setAppId(app.id || app._id);
    setSelectedType(app.type || 'student_org');

    // Details
    const b = app.basics || {};
    setDisplayName(b.displayName || '');
    setLegalName(b.legalName || '');
    setRegistrationNumber(b.registrationNumber || '');
    setYearEstablished(b.yearEstablished ? String(b.yearEstablished) : '');
    setMission(b.mission || '');
    setIntendedUse(b.intendedUse || '');
    setExtras(b.extras || {});

    const addr = app.address || {};
    setRegion(addr.region || '');
    setProvince(addr.province || '');
    setCity(addr.city || '');
    setBarangay(addr.barangay || '');
    setStreet(addr.street || '');
    setPostalCode(addr.postalCode || '');

    // Representative
    const rep = app.representative || {};
    setRepFullName(rep.fullName || user?.displayName || '');
    setRepPosition(rep.position || '');
    setRepIdType(rep.idType || 'national_id');
    setRepIdLast4(rep.idLast4 || '');
    setAuthorizedConfirmed(true);

    const contact = app.contact || {};
    setContactEmail(contact.email || user?.email || '');
    setRepPhone(contact.phone || '');
    setEmailVerified(Boolean(contact.emailVerified));

    // Governance
    const gov = app.governance || {};
    setRequiredApprovals(gov.requiredApprovals ? String(gov.requiredApprovals) : '2');
    setHighValueThreshold(gov.highValueThreshold ? String(gov.highValueThreshold) : '10000');
    setIsPrivate(Boolean(gov.isPrivate));
    setOfficers(gov.officers || []);

    // Set initial step based on status or progress
    if (['submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'revoked'].includes(app.status)) {
      setStepIndex(6); // Status screen
    } else {
      const stepMap: Record<string, number> = {
        details: 1,
        representative: 2,
        documents: 3,
        governance: 4,
        review: 5,
      };
      setStepIndex(stepMap[app.currentStep] || 1);
    }
  }, [user]);

  // 2. Initialize application on mount
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        if (appId) {
          const res = await api.get(`/org-applications/${appId}`);
          if (!isCancelled && res.data?.application) {
            populateFromApp(res.data.application);
            await loadRequirements(res.data.application.type || 'student_org');
          }
        } else {
          // Check for existing drafts first
          const mineRes = await api.get('/org-applications/mine');
          const mine = mineRes.data?.applications || [];
          if (!isCancelled && mine.length > 0) {
            const activeDraft = mine[0];
            const fullRes = await api.get(`/org-applications/${activeDraft.id}`);
            if (!isCancelled && fullRes.data?.application) {
              populateFromApp(fullRes.data.application);
              await loadRequirements(fullRes.data.application.type || 'student_org');
              return;
            }
          }
          await loadRequirements(selectedType);
        }
      } catch {
        if (!isCancelled) showToast('Failed to initialize application.', 'error');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    init();
    return () => {
      isCancelled = true;
    };
  }, [appId, loadRequirements, populateFromApp, selectedType, showToast]);

  // 3. Listen to Socket events for live verification updates
  useEffect(() => {
    const unsub = onSocketEvent('org_verification_updated', async (payload: any) => {
      if (appId && payload?.applicationId === appId) {
        showToast(`Verification status updated: ${payload.status}`, 'info');
        try {
          const res = await api.get(`/org-applications/${appId}`);
          if (res.data?.application) {
            populateFromApp(res.data.application);
            if (res.data.application.status === 'approved') {
              await triggerSuccessHaptic();
              setShowSuccessModal(true);
              Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
            }
          }
        } catch {}
      }
    });
    return unsub;
  }, [appId, onSocketEvent, populateFromApp, scaleAnim, showToast]);

  // Handle Category selection & create draft (Step 0 -> Step 1)
  const handleStartApplication = async () => {
    setSavingStep(true);
    await triggerLightHaptic();
    try {
      const res = await api.post('/org-applications', { orgType: selectedType });
      const created = res.data?.application;
      setAppId(created.id);
      populateFromApp(created);
      await loadRequirements(selectedType);
      setStepIndex(1);
      showToast('Draft created! Proceed with organization details.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to start application.', 'error');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 1: Save Details
  const handleSaveDetails = async () => {
    if (displayName.trim().length < 2) {
      showToast('Please enter an organization display name (min 2 chars).', 'warning');
      return;
    }
    if (legalName.trim().length > 0 && legalName.trim().length < 2) {
      showToast('Official legal name must be at least 2 characters.', 'warning');
      return;
    }
    if (requirements?.details?.registrationRequired && !registrationNumber.trim()) {
      showToast(`${requirements.details.registrationLabel || 'Registration number'} is required.`, 'warning');
      return;
    }
    const year = Number(yearEstablished);
    const currYear = new Date().getFullYear();
    if (yearEstablished && (isNaN(year) || year < 1900 || year > currYear)) {
      showToast(`Establishment year must be between 1900 and ${currYear}.`, 'warning');
      return;
    }
    const minMission = requirements?.details?.missionMinLength || 30;
    if (mission.trim().length > 0 && mission.trim().length < minMission) {
      showToast(`Mission statement should be at least ${minMission} characters.`, 'warning');
      return;
    }

    // Dynamic Philippine Affiliation Metadata Check
    if (requirements?.details?.extraFields) {
      for (const f of requirements.details.extraFields) {
        const val = (extras[f.key] || '').trim();
        if (f.required && !val) {
          showToast(`${f.label} is required.`, 'warning');
          return;
        }
        if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
          showToast(`${f.label} must be a valid email address.`, 'warning');
          return;
        }
      }
    }

    setSavingStep(true);
    await triggerLightHaptic();
    try {
      const res = await api.patch(`/org-applications/${appId}/steps/details`, {
        displayName: displayName.trim(),
        legalName: legalName.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        yearEstablished: yearEstablished ? Number(yearEstablished) : undefined,
        mission: mission.trim() || undefined,
        intendedUse: intendedUse.trim() || undefined,
        extras,
        address: {
          region: region.trim() || undefined,
          province: province.trim() || undefined,
          city: city.trim() || undefined,
          barangay: barangay.trim() || undefined,
          street: street.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
        },
      });
      populateFromApp(res.data.application);
      setStepIndex(2);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save details.', 'error');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 2: OTP Actions & Save Representative
  const handleSendOtp = async () => {
    const trimmedEmail = contactEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      showToast('Please enter a valid official contact email.', 'warning');
      return;
    }
    if (requirements?.representative?.emailDomainSuffixes?.length) {
      const match = requirements.representative.emailDomainSuffixes.some((s: string) =>
        trimmedEmail.endsWith(s)
      );
      if (!match) {
        showToast(
          `Official email must end with ${requirements.representative.emailDomainSuffixes.join(' or ')}`,
          'warning'
        );
        return;
      }
    }

    setSendingOtp(true);
    await triggerLightHaptic();
    try {
      // 1. Save identity step first so backend has contact.email
      await api.patch(`/org-applications/${appId}/steps/representative`, {
        fullName: repFullName.trim() || 'Representative',
        position: repPosition.trim() || 'Officer',
        idType: repIdType,
        idNumber: repIdLast4.trim() || '0000',
        email: trimmedEmail,
        phone: repPhone.trim() ? repPhone.trim().replace(/[\s-]/g, '') : undefined,
        authorizedConfirmed: true,
      });

      // 2. Request 6-digit OTP
      await api.post(`/org-applications/${appId}/contact/email/send`);
      setOtpSent(true);
      showToast(`Verification code sent to ${trimmedEmail}`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to send OTP code.', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      showToast('Enter the 6-digit verification code.', 'warning');
      return;
    }
    setConfirmingOtp(true);
    await triggerLightHaptic();
    try {
      const res = await api.post(`/org-applications/${appId}/contact/email/confirm`, {
        code: otpCode.trim(),
      });
      if (res.data?.verified) {
        setEmailVerified(true);
        await triggerSuccessHaptic();
        showToast('Official contact email verified!', 'success');
      }
    } catch (err: any) {
      await triggerErrorHaptic();
      showToast(err.response?.data?.error || 'Invalid or expired OTP code.', 'error');
    } finally {
      setConfirmingOtp(false);
    }
  };

  const handleSaveRepresentative = async () => {
    if (repFullName.trim().length < 2) {
      showToast('Representative full name is required (min 2 chars).', 'warning');
      return;
    }
    if (repPosition.trim().length < 2) {
      showToast('Official position / title is required (min 2 chars).', 'warning');
      return;
    }
    const cleanId = repIdLast4.trim();
    if (!cleanId || cleanId.length < 4 || cleanId.length > 40 || !/^[A-Za-z0-9]+$/.test(cleanId)) {
      showToast('Enter a valid ID number (4-40 alphanumeric characters).', 'warning');
      return;
    }
    if (repPhone.trim() && !/^(\+?63|0)9\d{9}$/.test(repPhone.trim().replace(/[\s-]/g, ''))) {
      showToast('Phone must be a valid PH mobile number (e.g. 09171234567).', 'warning');
      return;
    }
    if (!emailVerified) {
      showToast('Please verify your official contact email via OTP before proceeding.', 'warning');
      return;
    }
    if (!authorizedConfirmed) {
      showToast('You must confirm your authorization to register this organization.', 'warning');
      return;
    }

    setSavingStep(true);
    await triggerLightHaptic();
    try {
      const res = await api.patch(`/org-applications/${appId}/steps/representative`, {
        fullName: repFullName.trim(),
        position: repPosition.trim(),
        idType: repIdType,
        idNumber: cleanId,
        email: contactEmail.trim().toLowerCase(),
        phone: repPhone.trim() ? repPhone.trim().replace(/[\s-]/g, '') : undefined,
        authorizedConfirmed: true,
      });
      populateFromApp(res.data.application);
      setStepIndex(3);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save representative details.', 'error');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 3: Document Upload / Delete
  const handlePickAndUploadDocument = async (kind: string) => {
    await triggerLightHaptic();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Media permissions are required to upload verification documents.', 'warning');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || `${kind}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpeg';
      const type = ext === 'png' ? 'image/png' : 'image/jpeg';

      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type,
      } as any);
      formData.append('kind', kind);

      const res = await api.post(`/org-applications/${appId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      populateFromApp(res.data.application);
      await triggerSuccessHaptic();
      showToast('Document encrypted and stored in private vault!', 'success');
    } catch (err: any) {
      await triggerErrorHaptic();
      showToast(err.response?.data?.error || 'Failed to upload document.', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    Alert.alert('Remove Document', 'Are you sure you want to remove this evidence file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.delete(`/org-applications/${appId}/documents/${docId}`);
            populateFromApp(res.data.application);
            showToast('Document removed.', 'info');
          } catch {
            showToast('Failed to remove document.', 'error');
          }
        },
      },
    ]);
  };

  const handleSaveDocumentsStep = async () => {
    const checklist = application?.documentChecklist || [];
    const unsatisfied = checklist.filter((g: any) => !g.satisfied);
    if (unsatisfied.length > 0) {
      showToast(`${unsatisfied.length} required document group(s) still pending.`, 'warning');
      return;
    }
    setSavingStep(true);
    await triggerLightHaptic();
    setStepIndex(4);
    setSavingStep(false);
  };

  // Step 4: Governance & Officers
  const handleAddOfficer = () => {
    if (!newOfficerName.trim() || newOfficerName.trim().length < 2) {
      showToast('Enter valid officer full name (min 2 chars).', 'warning');
      return;
    }
    const cleanEmail = newOfficerEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      showToast('Enter a valid officer email address.', 'warning');
      return;
    }
    if (cleanEmail === contactEmail.trim().toLowerCase() || cleanEmail === user?.email?.toLowerCase()) {
      showToast('Officer email cannot be the same as the applicant email.', 'warning');
      return;
    }
    if (officers.some((o: any) => o.email.toLowerCase() === cleanEmail)) {
      showToast('This officer email is already added.', 'warning');
      return;
    }

    const updated = [
      ...officers,
      {
        name: newOfficerName.trim(),
        email: cleanEmail,
        roleLevel: Number(newOfficerRole) || 2,
        roleLabel: newOfficerLabel.trim() || 'Officer',
      },
    ];
    setOfficers(updated);
    setNewOfficerName('');
    setNewOfficerEmail('');
    setShowOfficerModal(false);
  };

  const handleSaveGovernance = async () => {
    const reqApp = Number(requiredApprovals) || 2;
    const thresh = Number(highValueThreshold) || 10000;
    const minOfficers = Math.max(0, reqApp - 1);

    if (officers.length < minOfficers) {
      showToast(
        `Quorum of ${reqApp} requires at least ${minOfficers} co-officer(s). Please add ${minOfficers - officers.length} more.`,
        'warning'
      );
      return;
    }
    if (thresh <= 0) {
      showToast('High-value threshold must be greater than ₱0.', 'warning');
      return;
    }

    setSavingStep(true);
    await triggerLightHaptic();
    try {
      const res = await api.patch(`/org-applications/${appId}/steps/governance`, {
        requiredApprovals: reqApp,
        highValueThreshold: thresh,
        isPrivate,
        officers,
      });
      populateFromApp(res.data.application);
      setStepIndex(5);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save governance.', 'error');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 5: Final Submission
  const handleSubmitApplication = async () => {
    if (!consentTerms || !consentPrivacy || !consentAccuracy) {
      showToast('Please accept all three legal certifications to submit.', 'warning');
      return;
    }

    setSubmitting(true);
    await triggerLightHaptic();
    try {
      // 1. Save consents step
      await api.patch(`/org-applications/${appId}/steps/review`, {
        acceptTerms: true,
        acceptPrivacy: true,
        acceptAccuracy: true,
      });

      // 2. Submit for SuperAdmin review
      const res = await api.post(`/org-applications/${appId}/submit`);
      populateFromApp(res.data);
      setStepIndex(6); // Status screen
      await triggerSuccessHaptic();
      showToast('Application submitted for SuperAdmin verification review!', 'success');
    } catch (err: any) {
      await triggerErrorHaptic();
      showToast(err.response?.data?.error || 'Submission failed. Please check missing requirements.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 12 }}>Loading verification...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Wizard Header Progress Bar ── */}
      {stepIndex >= 1 && stepIndex <= 5 && (
        <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <TouchableOpacity onPress={() => setStepIndex((prev) => Math.max(1, prev - 1))} className="flex-row items-center gap-1">
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
              STEP {stepIndex} OF 5
            </Text>
          </View>
          <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${(stepIndex / 5) * 100}%`, backgroundColor: colors.primary }} />
          </View>
        </View>
      )}

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 0: CATEGORY SELECTION                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 0 && (
          <View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 6 }}>
                Register Your Organization
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                3-Pillar Philippine Verification: Institutional Existence, Signatory Authority, and KYC. Select your organization category below.
              </Text>
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['All', 'Institutional', 'Community', 'Commercial & Informal'].map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={async () => {
                        await triggerLightHaptic();
                        setActiveCategory(cat);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 20,
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ color: isActive ? '#FFFFFF' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ gap: 10, marginBottom: 24 }}>
              {ORG_TYPES.filter((t) => (activeCategory === 'All' ? true : t.category === activeCategory)).map((t) => {
                const isSelected = selectedType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={async () => {
                      await triggerLightHaptic();
                      setSelectedType(t.value);
                      await loadRequirements(t.value);
                    }}
                    style={{
                      backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 1.5 : 1,
                      borderRadius: 18,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: isSelected ? colors.primary : colors.backgroundSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={t.icon as any} size={22} color={isSelected ? '#FFFFFF' : colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>{t.label}</Text>
                        <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : colors.backgroundSecondary, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                          <Text style={{ color: isSelected ? '#FFFFFF' : colors.textSecondary, fontSize: 9.5, fontWeight: '700' }}>{t.governing}</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginTop: 2 }}>{t.desc}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category Requirements Preview Card */}
            {requirements && (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                    3-Pillar Verification Preview ({requirements.label})
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 16 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Pillar 1 (Existence): </Text>
                      {requirements.governingBody || 'Accreditation'} · {requirements.details?.registrationRequired ? 'Registration ID Required' : 'Self-Governed'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 16 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Pillar 2 (Authority): </Text>
                      Official resolution, appointment, or adviser endorsement
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 16 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Pillar 3 (KYC): </Text>
                      Signatory IDs + Email OTP verification
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Ionicons name="sparkles-outline" size={15} color="#818CF8" style={{ marginTop: 1 }} />
                    <Text style={{ color: '#818CF8', fontSize: 11, flex: 1, lineHeight: 15 }}>
                      Evidence pinned to Pinata IPFS. Soulbound Token (SBT) & trust badge issued upon SuperAdmin approval.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartApplication}
              disabled={savingStep}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ paddingVertical: 16, alignItems: 'center' }}>
                {savingStep ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                    Begin Application →
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: ORGANIZATION DETAILS                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 1 && (
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
              Organization Details
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginBottom: 20 }}>
              Official identifying details for your institution on the transparent ledger.
            </Text>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Display Name *
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="e.g., Supreme Student Council"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Official Legal Name
                </Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="e.g., Cor Jesu College Student Executive Board, Inc."
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Registration / Accreditation Number {requirements?.details?.registrationRequired && '*'}
                </Text>
                <TextInput
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  placeholder="e.g., SEC-2024-0012948 or OSAS-2024-CJC-01"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Year Established
                </Text>
                <TextInput
                  value={yearEstablished}
                  onChangeText={setYearEstablished}
                  keyboardType="numeric"
                  placeholder="e.g., 2018"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Mission / Purpose
                </Text>
                <TextInput
                  value={mission}
                  onChangeText={setMission}
                  multiline
                  numberOfLines={3}
                  placeholder="Describe your organization's core objective..."
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13, textAlignVertical: 'top' }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Principal Address (City & Province)
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="City / Municipality"
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                  />
                  <TextInput
                    value={province}
                    onChangeText={setProvince}
                    placeholder="Province"
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                  />
                </View>
              </View>

              {/* Dynamic Institutional Affiliation Fields */}
              {requirements?.details?.extraFields && requirements.details.extraFields.length > 0 && (
                <View style={{ gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Institutional Affiliation Metadata
                  </Text>
                  {requirements.details.extraFields.map((f: any) => (
                    <View key={f.key}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                        {f.label} {f.required ? '*' : ''}
                      </Text>
                      <TextInput
                        value={extras[f.key] || ''}
                        onChangeText={(val) => setExtras((prev) => ({ ...prev, [f.key]: val }))}
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                        placeholderTextColor={colors.textMuted}
                        keyboardType={f.type === 'email' ? 'email-address' : 'default'}
                        autoCapitalize={f.type === 'email' ? 'none' : 'sentences'}
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          color: colors.textPrimary,
                          fontSize: 13,
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSaveDetails}
              disabled={savingStep}
              style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                {savingStep ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Save & Next Step →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: REPRESENTATIVE & EMAIL OTP                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 2 && (
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
              Representative Identity
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginBottom: 20 }}>
              The representative is granted Founder Level-1 status. Official email must be verified.
            </Text>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Full Legal Name *
                </Text>
                <TextInput
                  value={repFullName}
                  onChangeText={setRepFullName}
                  placeholder="e.g., Juan Dela Cruz"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Position / Title in Organization *
                </Text>
                <TextInput
                  value={repPosition}
                  onChangeText={setRepPosition}
                  placeholder="e.g., President, Chairperson, Lead Organizer"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Government / Institutional ID Type *
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ID_TYPES.map((idT) => (
                    <TouchableOpacity
                      key={idT.value}
                      onPress={() => setRepIdType(idT.value)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: repIdType === idT.value ? colors.primary : colors.surface,
                        borderColor: repIdType === idT.value ? colors.primary : colors.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ color: repIdType === idT.value ? '#FFFFFF' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                        {idT.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Government / Institutional ID Number *
                </Text>
                <TextInput
                  value={repIdLast4}
                  onChangeText={setRepIdLast4}
                  maxLength={40}
                  placeholder="e.g. 1234-5678-9012 or last 4 digits"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Official Philippine Mobile Number (Optional)
                </Text>
                <TextInput
                  value={repPhone}
                  onChangeText={setRepPhone}
                  keyboardType="phone-pad"
                  placeholder="e.g., 09171234567 or +639171234567"
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13 }}
                />
              </View>

              {/* Official Email + Inline OTP Verification */}
              <View style={{ backgroundColor: colors.surface, borderColor: emailVerified ? colors.success : colors.border, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    Official Contact Email *
                  </Text>
                  {emailVerified && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800' }}>VERIFIED</Text>
                    </View>
                  )}
                </View>

                {requirements?.representative?.emailDomainSuffixes?.length > 0 && (
                  <Text style={{ color: '#818CF8', fontSize: 11, marginBottom: 8 }}>
                    Must use official institutional email ending in: {requirements.representative.emailDomainSuffixes.join(', ')}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={contactEmail}
                    onChangeText={(val) => {
                      setContactEmail(val);
                      if (emailVerified) setEmailVerified(false);
                    }}
                    editable={!emailVerified}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="official@institution.edu.ph"
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary, fontSize: 12.5 }}
                  />
                  {!emailVerified && (
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={sendingOtp}
                      style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, justifyContent: 'center' }}
                    >
                      {sendingOtp ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' }}>{otpSent ? 'Resend' : 'Send Code'}</Text>}
                    </TouchableOpacity>
                  )}
                </View>

                {otpSent && !emailVerified && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopColor: colors.border, borderTopWidth: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 8 }}>
                      Enter 6-digit verification code sent to {contactEmail}:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="123456"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, color: colors.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 4 }}
                      />
                      <TouchableOpacity
                        onPress={handleConfirmOtp}
                        disabled={confirmingOtp}
                        style={{ backgroundColor: colors.success, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, justifyContent: 'center' }}
                      >
                        {confirmingOtp ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Confirm</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Authorization Confirmation Checkbox */}
              <TouchableOpacity
                onPress={() => setAuthorizedConfirmed(!authorizedConfirmed)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, backgroundColor: colors.surface, padding: 12, borderRadius: 14, borderColor: colors.border, borderWidth: 1 }}
              >
                <Ionicons
                  name={authorizedConfirmed ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={authorizedConfirmed ? colors.primary : colors.textMuted}
                  style={{ marginTop: 1 }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 }}>
                  I confirm under penalty of perjury and institutional sanctions that I am authorized to register this organization and manage its digital treasury.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSaveRepresentative}
              disabled={savingStep}
              style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                {savingStep ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Save & Upload Evidence →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3: ENCRYPTED EVIDENCE DOCUMENTS                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 3 && (
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
              Private Evidence Vault
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginBottom: 16 }}>
              Upload verification documents. Files are encrypted with AES-256-GCM and stored privately.
            </Text>

            {/* Checklist of required groups */}
            <View style={{ gap: 12, marginBottom: 24 }}>
              {(application?.documentChecklist || requirements?.documents?.groups || []).map((grp: any) => {
                const isSatisfied = Boolean(grp.satisfied);
                return (
                  <View
                    key={grp.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: isSatisfied ? colors.success : colors.border,
                      borderWidth: 1,
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    {(() => {
                      const pillar = getPillarBadge(grp);
                      return (
                        <View style={{ backgroundColor: pillar.bg, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}>
                          <Text style={{ color: pillar.color, fontSize: 10, fontWeight: '800' }}>{pillar.name}</Text>
                        </View>
                      );
                    })()}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800', flex: 1 }}>
                        {grp.label}
                      </Text>
                      {isSatisfied ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                          <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800' }}>SATISFIED</Text>
                        </View>
                      ) : (
                        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>REQUIRED</Text>
                      )}
                    </View>

                    <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 10 }}>
                      Accepted kinds: {grp.kinds?.join(', ')}
                    </Text>

                    <TouchableOpacity
                      onPress={() => handlePickAndUploadDocument(grp.kinds?.[0] || 'supporting_other')}
                      disabled={uploadingDoc}
                      style={{
                        backgroundColor: colors.primaryMuted,
                        borderColor: colors.primary + '50',
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                        {uploadingDoc ? 'Encrypting & Uploading...' : `Upload ${grp.label}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Uploaded Documents List */}
            {application?.documents && application.documents.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 10 }}>
                  Uploaded Documents ({application.documents.length})
                </Text>
                <View style={{ gap: 8 }}>
                  {application.documents.map((doc: any) => (
                    <View
                      key={doc.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>
                          {doc.originalName || doc.kind}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          <Text style={{ color: colors.textMuted, fontSize: 10.5, fontFamily: 'monospace' }}>
                            SHA-256: {doc.sha256?.substring(0, 10)}...
                          </Text>
                          {doc.ipfsCid && (
                            <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ color: '#818CF8', fontSize: 9.5, fontFamily: 'monospace' }}>
                                IPFS: {doc.ipfsCid.substring(0, 8)}...
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteDocument(doc.id)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSaveDocumentsStep}
              disabled={savingStep}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                {savingStep ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Confirm Documents & Next →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 4: MULTI-SIG GOVERNANCE                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 4 && (
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
              Multi-Sig Governance
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginBottom: 20 }}>
              Establish required approver quorum and high-value expenditure thresholds.
            </Text>

            <View style={{ gap: 16 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>
                  Required Approval Quorum
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 10 }}>
                  Number of Level-1 executive sign-offs required for expenditures.
                </Text>
                <TextInput
                  value={requiredApprovals}
                  onChangeText={setRequiredApprovals}
                  keyboardType="number-pad"
                  style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}
                />
                {officers.length < Math.max(0, (Number(requiredApprovals) || 2) - 1) && (
                  <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 }}>
                    <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>
                      ⚠️ Quorum of {requiredApprovals} requires at least {Math.max(0, (Number(requiredApprovals) || 2) - 1)} co-officers. Please add {Math.max(0, (Number(requiredApprovals) || 2) - 1) - officers.length} more below.
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>
                  High-Value Threshold (₱ PHP)
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 10 }}>
                  Transactions equal to or exceeding this amount strictly require multi-signature execution.
                </Text>
                <TextInput
                  value={highValueThreshold}
                  onChangeText={setHighValueThreshold}
                  keyboardType="numeric"
                  style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}
                />
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>Private Organization</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11.5 }}>
                    Hide organization transactions from the public blockchain ledger explorer.
                  </Text>
                </View>
                <AnimatedToggleSwitch value={isPrivate} onValueChange={setIsPrivate} />
              </View>

              {/* Co-Officers List */}
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>Initial Co-Officers ({officers.length})</Text>
                  <TouchableOpacity onPress={() => setShowOfficerModal(true)}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>+ Add Officer</Text>
                  </TouchableOpacity>
                </View>

                {officers.length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>No additional co-officers added yet.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {officers.map((off, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: colors.border, borderBottomWidth: 1 }}>
                        <View>
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{off.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{off.roleLabel} · {off.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setOfficers(officers.filter((_, i) => i !== idx))}>
                          <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveGovernance}
              disabled={savingStep}
              style={{ marginTop: 24, borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                {savingStep ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Review & Consents →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 5: REVIEW & CONSENTS SUBMISSION                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 5 && (
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
              Review & Submit
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginBottom: 20 }}>
              Confirm your application details before submitting for Super-Admin review.
            </Text>

            {/* Summary Card */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Organization:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{displayName}</Text>
              </View>
              {legalName ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Legal Name:</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{legalName}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Category:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{selectedType}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Representative:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{repFullName} ({repPosition})</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Contact Email:</Text>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>✓ {contactEmail}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Encrypted Documents:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{application?.documents?.length || 0} file(s) [Pinata IPFS]</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Quorum Threshold:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{requiredApprovals} approvers (₱{Number(highValueThreshold).toLocaleString()})</Text>
              </View>

              {/* Affiliation Metadata */}
              {extras && Object.keys(extras).length > 0 && (
                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 8, gap: 5 }}>
                  <Text style={{ color: colors.primary, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' }}>
                    Institutional Affiliation Metadata
                  </Text>
                  {Object.entries(extras).map(([k, val]) => (
                    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: 'capitalize' }}>
                        {k.replace(/([A-Z])/g, ' $1')}:
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>
                        {String(val)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Dual On-Chain Attestation Guarantee Notice */}
            <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.25)', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: 'row', gap: 10 }}>
              <Ionicons name="shield-checkmark" size={20} color="#818CF8" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 2 }}>
                  Dual Blockchain Attestation Guarantee
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
                  Upon SuperAdmin review approval, your organization will be anchored on Polygon Amoy (OrgRegistry.sol) and non-transferable Soulbound Tokens (CB-SBT) will be minted to authorized officers.
                </Text>
              </View>
            </View>

            {/* Consents Checkboxes */}
            <View style={{ gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setConsentTerms(!consentTerms)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <Ionicons
                  name={consentTerms ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={consentTerms ? colors.primary : colors.textMuted}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 }}>
                  I agree to the ChainBudget Terms of Service and Multi-Signature DAO governance protocols.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setConsentPrivacy(!consentPrivacy)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <Ionicons
                  name={consentPrivacy ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={consentPrivacy ? colors.primary : colors.textMuted}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 }}>
                  I consent to private encrypted storage of evidence documents in the AES-256 vault for legitimacy verification.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setConsentAccuracy(!consentAccuracy)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <Ionicons
                  name={consentAccuracy ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={consentAccuracy ? colors.primary : colors.textMuted}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 }}>
                  I certify that all information and uploaded documents provided are authentic, true, and legally authorized.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSubmitApplication}
              disabled={submitting}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={{ paddingVertical: 16, alignItems: 'center' }}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Submit Application for Review</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STATUS & TIMELINE SCREEN                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {stepIndex === 6 && (
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            {/* Status Icon */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor:
                  application?.status === 'approved'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : application?.status === 'needs_info'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : application?.status === 'rejected'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(99, 102, 241, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons
                name={
                  application?.status === 'approved'
                    ? 'checkmark-done-circle'
                    : application?.status === 'needs_info'
                    ? 'alert-circle'
                    : application?.status === 'rejected'
                    ? 'close-circle'
                    : 'time-outline'
                }
                size={38}
                color={
                  application?.status === 'approved'
                    ? '#10B981'
                    : application?.status === 'needs_info'
                    ? '#F59E0B'
                    : application?.status === 'rejected'
                    ? '#EF4444'
                    : colors.primary
                }
              />
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>
              {application?.status === 'approved'
                ? 'Organization Verified!'
                : application?.status === 'needs_info'
                ? 'Action Required'
                : application?.status === 'rejected'
                ? 'Application Rejected'
                : 'Under Review'}
            </Text>

            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24, paddingHorizontal: 10 }}>
              {application?.status === 'approved'
                ? 'Your organization has been officially verified and provisioned on ChainBudget!'
                : application?.status === 'needs_info'
                ? 'The Super-Admin has requested changes or additional verification documents.'
                : application?.status === 'rejected'
                ? 'Your application was not approved. Review the feedback provided below.'
                : 'Your verification dossier has been submitted to the Super-Admin review queue. You will receive real-time notifications on updates.'}
            </Text>

            {/* Reviewer Message Callout (when needs_info or rejected) */}
            {application?.review?.applicantMessage && (
              <View
                style={{
                  width: '100%',
                  backgroundColor: colors.surface,
                  borderColor: application?.status === 'needs_info' ? colors.warning : colors.border,
                  borderWidth: 1,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 4 }}>
                  Feedback from Reviewer:
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                  {application.review.applicantMessage}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            {application?.status === 'needs_info' && (
              <TouchableOpacity
                onPress={() => setStepIndex(3)} // Return to documents
                style={{ width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}
              >
                <LinearGradient colors={['#F59E0B', '#D97706']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                    Replace Documents & Resubmit
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {application?.status === 'approved' && (
              <View style={{ width: '100%', gap: 10, marginBottom: 16 }}>
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="ribbon-outline" size={24} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '800' }}>
                      ✓ Verified Philippine Entity
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                      Soulbound Token (CB-SBT) minted to officer wallet. On-chain legitimacy guaranteed.
                    </Text>
                  </View>
                </View>

                {application?.anchor?.txHash && (
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(`https://amoy.polygonscan.com/tx/${application.anchor.txHash}`);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                      borderWidth: 1,
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="link-outline" size={16} color="#818CF8" />
                    <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700' }}>
                      View on PolygonScan Amoy ↗
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={async () => {
                    if (refreshUser) await refreshUser();
                    if (refreshOrgs) await refreshOrgs();
                    navigation.navigate('MainTabs');
                  }}
                  style={{ width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 4 }}
                >
                  <LinearGradient colors={['#10B981', '#059669']} style={{ paddingVertical: 15, alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                      Go to Organization Dashboard →
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs')}
              style={{
                width: '100%',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Add Officer Modal */}
      <Modal visible={showOfficerModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Add Initial Co-Officer</Text>
              <TouchableOpacity onPress={() => setShowOfficerModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={newOfficerName}
              onChangeText={setNewOfficerName}
              placeholder="Officer Full Name"
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13, marginBottom: 10 }}
            />
            <TextInput
              value={newOfficerEmail}
              onChangeText={setNewOfficerEmail}
              placeholder="Officer Email Address"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13, marginBottom: 10 }}
            />
            <TextInput
              value={newOfficerLabel}
              onChangeText={setNewOfficerLabel}
              placeholder="Title (e.g., Vice President, Treasurer)"
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 13, marginBottom: 16 }}
            />

            <TouchableOpacity onPress={handleAddOfficer} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Confirm Officer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Celebration Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              padding: 24,
              alignItems: 'center',
              width: '100%',
              maxWidth: 340,
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-done" size={36} color="#10B981" />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>
              Legitimacy Verified!
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Your organization has been officially verified by the Super-Admin and provisioned on Polygon Amoy.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                setShowSuccessModal(false);
                if (refreshUser) await refreshUser();
                if (refreshOrgs) await refreshOrgs();
                navigation.navigate('MainTabs');
              }}
              style={{ backgroundColor: colors.primary, width: '100%', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Enter Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
