import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { getCurrentUserOrThrow } from './authSession';

const parseNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseOptionalNumber = value => {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDiseaseTags = tags =>
  Array.isArray(tags) ? tags.filter(tag => tag === 'diabetes' || tag === 'celiac') : [];

const sanitizeSubmissionEditableData = source => {
  const glycemicIndex = parseOptionalNumber(source.glycemicIndex);
  return {
    name: String(source.name || '').trim(),
    brandName: String(source.brandName || '').trim(),
    serving: String(source.serving || '').trim(),
    calories: parseNumber(source.calories),
    protein: parseNumber(source.protein),
    carbs: parseNumber(source.carbs),
    fat: parseNumber(source.fat),
    saturatedFat: parseNumber(source.saturatedFat),
    fiber: parseNumber(source.fiber),
    sugar: parseNumber(source.sugar),
    sodium: parseNumber(source.sodium),
    potassium: parseNumber(source.potassium),
    calcium: parseNumber(source.calcium),
    iron: parseNumber(source.iron),
    magnesium: parseNumber(source.magnesium),
    phosphorus: parseNumber(source.phosphorus),
    zinc: parseNumber(source.zinc),
    vitaminC: parseNumber(source.vitaminC),
    vitaminB12: parseNumber(source.vitaminB12),
    ...(glycemicIndex !== null ? { glycemicIndex } : {}),
    diseaseTags: normalizeDiseaseTags(source.diseaseTags),
    unsuitableDiseaseTags: normalizeDiseaseTags(source.unsuitableDiseaseTags),
    notes: String(source.notes || '').trim(),
  };
};

const mapSubmission = snapshot => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAtMs: data.createdAt?.toMillis?.() || 0,
    updatedAtMs: data.updatedAt?.toMillis?.() || 0,
  };
};

const mapIssueReport = snapshot => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAtMs: data.createdAt?.toMillis?.() || 0,
    updatedAtMs: data.updatedAt?.toMillis?.() || 0,
  };
};

const createAuthedSubscription = ({ unauthMessage, queryFactory, onData, onError, sortFn, mapFn }) => {
  let firestoreUnsubscribe = null;
  let authUnsubscribe = null;
  let closed = false;

  const closeAll = () => {
    if (typeof firestoreUnsubscribe === 'function') {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    if (typeof authUnsubscribe === 'function') {
      authUnsubscribe();
      authUnsubscribe = null;
    }
  };

  const attachFirestore = user => {
    firestoreUnsubscribe = onSnapshot(
      queryFactory(user),
      snapshot => {
        const rows = snapshot.docs.map(mapFn).sort(sortFn);
        onData(rows);
      },
      error => {
        if (typeof onError === 'function') {
          onError(error);
        }
      }
    );
  };

  if (auth.currentUser) {
    attachFirestore(auth.currentUser);
  } else {
    authUnsubscribe = onAuthStateChanged(auth, user => {
      if (closed) return;
      if (!user) {
        if (typeof onError === 'function') {
          onError(new Error(unauthMessage));
        }
        return;
      }
      if (typeof authUnsubscribe === 'function') {
        authUnsubscribe();
        authUnsubscribe = null;
      }
      attachFirestore(user);
    });
  }

  return () => {
    closed = true;
    closeAll();
  };
};

export const foodSubmissionService = {
  submitSuggestion: async form => {
    const currentUser = await getCurrentUserOrThrow(
      'Besin onerisi gondermek icin once giris yapmalisin.'
    );

    const payload = {
      name: String(form.name || '').trim(),
      brandName: String(form.brandName || '').trim(),
      serving: String(form.serving || '').trim(),
      calories: parseNumber(form.calories),
      protein: parseNumber(form.protein),
      carbs: parseNumber(form.carbs),
      fat: parseNumber(form.fat),
      saturatedFat: parseNumber(form.saturatedFat),
      fiber: parseNumber(form.fiber),
      sugar: parseNumber(form.sugar),
      sodium: parseNumber(form.sodium),
      potassium: parseNumber(form.potassium),
      calcium: parseNumber(form.calcium),
      iron: parseNumber(form.iron),
      magnesium: parseNumber(form.magnesium),
      phosphorus: parseNumber(form.phosphorus),
      zinc: parseNumber(form.zinc),
      vitaminC: parseNumber(form.vitaminC),
      vitaminB12: parseNumber(form.vitaminB12),
      ...(parseOptionalNumber(form.glycemicIndex) !== null
        ? { glycemicIndex: parseOptionalNumber(form.glycemicIndex) }
        : {}),
      diseaseTags: normalizeDiseaseTags(form.diseaseTags),
      unsuitableDiseaseTags: normalizeDiseaseTags(form.unsuitableDiseaseTags),
      notes: String(form.notes || '').trim(),
      source: 'user',
      status: 'pending',
      reviewedBy: '',
      reviewNote: '',
      pointsAwarded: 0,
      submittedBy: currentUser.uid,
      submittedByEmail: currentUser.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!payload.name || !payload.serving) {
      throw new Error('Besin adi ve porsiyon zorunludur.');
    }
    if (payload.diseaseTags.some(tag => payload.unsuitableDiseaseTags.includes(tag))) {
      throw new Error('Ayni hastalik hem uygun hem uygun degil olarak secilemez.');
    }

    await addDoc(collection(db, 'foodSubmissions'), payload);
    return { success: true };
  },

  getMySubmissions: async () => {
    const currentUser = await getCurrentUserOrThrow('Gonderileri gormek icin once giris yapmalisin.');

    const snapshot = await getDocs(
      query(collection(db, 'foodSubmissions'), where('submittedBy', '==', currentUser.uid))
    );

    return snapshot.docs.map(mapSubmission).sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  subscribeMySubmissions: (onData, onError) => {
    return createAuthedSubscription({
      unauthMessage: 'Gonderileri gormek icin once giris yapmalisin.',
      queryFactory: user => query(collection(db, 'foodSubmissions'), where('submittedBy', '==', user.uid)),
      onData,
      onError,
      sortFn: (a, b) => b.createdAtMs - a.createdAtMs,
      mapFn: mapSubmission,
    });
  },

  getPendingSubmissions: async () => {
    await getCurrentUserOrThrow('Admin islemleri icin once giris yapmalisin.');

    const snapshot = await getDocs(
      query(collection(db, 'foodSubmissions'), where('status', '==', 'pending'))
    );

    return snapshot.docs.map(mapSubmission).sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  subscribePendingSubmissions: (onData, onError) => {
    return createAuthedSubscription({
      unauthMessage: 'Admin islemleri icin once giris yapmalisin.',
      queryFactory: () => query(collection(db, 'foodSubmissions'), where('status', '==', 'pending')),
      onData,
      onError,
      sortFn: (a, b) => b.createdAtMs - a.createdAtMs,
      mapFn: mapSubmission,
    });
  },

  getApprovedSubmissions: async () => {
    await getCurrentUserOrThrow('Admin islemleri icin once giris yapmalisin.');

    const snapshot = await getDocs(
      query(collection(db, 'foodSubmissions'), where('status', '==', 'approved'))
    );

    return snapshot.docs.map(mapSubmission).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  },

  subscribeApprovedSubmissions: (onData, onError) => {
    return createAuthedSubscription({
      unauthMessage: 'Admin islemleri icin once giris yapmalisin.',
      queryFactory: () => query(collection(db, 'foodSubmissions'), where('status', '==', 'approved')),
      onData,
      onError,
      sortFn: (a, b) => b.updatedAtMs - a.updatedAtMs,
      mapFn: mapSubmission,
    });
  },

  reviewSubmission: async ({ submissionId, status, reviewNote, pointsAwarded = 0 }) => {
    const currentUser = await getCurrentUserOrThrow('Admin islemleri icin once giris yapmalisin.');
    if (!submissionId) {
      throw new Error('Gecersiz gonderi.');
    }
    if (status !== 'approved' && status !== 'rejected') {
      throw new Error('Gecersiz durum.');
    }

    const submissionRef = doc(db, 'foodSubmissions', submissionId);
    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) {
      throw new Error('Gecersiz gonderi.');
    }

    const submissionData = submissionSnap.data();
    let nextPointsAwarded = Number(pointsAwarded) || 0;
    if (status === 'approved' && Number(submissionData.pointsAwarded || 0) <= 0) {
      nextPointsAwarded = 100;
      const submittedBy = String(submissionData.submittedBy || '').trim();
      if (submittedBy) {
        const userRef = doc(db, 'users', submittedBy);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentPoints = Number(userSnap.data()?.points || 0);
          await updateDoc(userRef, {
            points: currentPoints + 100,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await updateDoc(submissionRef, {
      status,
      reviewNote: String(reviewNote || '').trim(),
      reviewedBy: currentUser.uid,
      pointsAwarded: nextPointsAwarded,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  },

  updateSubmissionDetails: async ({ submissionId, updates }) => {
    await getCurrentUserOrThrow('Duzenleme icin once giris yapmalisin.');
    if (!submissionId) {
      throw new Error('Gecersiz gonderi.');
    }

    const sanitized = sanitizeSubmissionEditableData(updates || {});
    if (!sanitized.name || !sanitized.serving) {
      throw new Error('Besin adi ve porsiyon zorunludur.');
    }
    if (sanitized.diseaseTags.some(tag => sanitized.unsuitableDiseaseTags.includes(tag))) {
      throw new Error('Ayni hastalik hem uygun hem uygun degil secilemez.');
    }

    await updateDoc(doc(db, 'foodSubmissions', submissionId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  },

  deleteSubmission: async submissionId => {
    await getCurrentUserOrThrow('Silme islemi icin once giris yapmalisin.');
    if (!submissionId) {
      throw new Error('Gecersiz gonderi.');
    }

    await deleteDoc(doc(db, 'foodSubmissions', submissionId));
    return { success: true };
  },

  submitFoodIssueReport: async ({ foodSubmissionId, foodName, reportReason }) => {
    const currentUser = await getCurrentUserOrThrow(
      'Bildirim gonderebilmek icin once giris yapmalisin.'
    );

    const safeFoodSubmissionId = String(foodSubmissionId || '').trim();
    const safeFoodName = String(foodName || '').trim();
    const safeReason = String(reportReason || '').trim();
    if (!safeFoodSubmissionId || !safeFoodName) {
      throw new Error('Gecersiz besin kaydi.');
    }
    if (!safeReason) {
      throw new Error('Lutfen neden sorunlu oldugunu kisaca yaz.');
    }

    const existingSnapshot = await getDocs(
      query(collection(db, 'foodIssueReports'), where('foodSubmissionId', '==', safeFoodSubmissionId))
    );
    const existingReports = existingSnapshot.docs.map(mapIssueReport);
    const duplicatePending = existingReports.some(
      report => report.reportedBy === currentUser.uid && report.status === 'pending'
    );
    if (duplicatePending) {
      throw new Error('Bu besin icin zaten bekleyen bir bildirimin var.');
    }

    const firstReport = [...existingReports].sort((a, b) => a.createdAtMs - b.createdAtMs)[0];
    const firstReporterUid = firstReport?.firstReporterUid || firstReport?.reportedBy || currentUser.uid;

    await addDoc(collection(db, 'foodIssueReports'), {
      foodSubmissionId: safeFoodSubmissionId,
      foodName: safeFoodName,
      reportReason: safeReason,
      status: 'pending',
      adminNote: '',
      reportedBy: currentUser.uid,
      reportedByEmail: currentUser.email || '',
      firstReporterUid,
      pointsGranted: false,
      resolvedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  },

  getPendingFoodIssueReports: async () => {
    await getCurrentUserOrThrow('Admin islemleri icin once giris yapmalisin.');
    const snapshot = await getDocs(
      query(collection(db, 'foodIssueReports'), where('status', '==', 'pending'))
    );
    return snapshot.docs.map(mapIssueReport).sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  subscribePendingFoodIssueReports: (onData, onError) => {
    return createAuthedSubscription({
      unauthMessage: 'Admin islemleri icin once giris yapmalisin.',
      queryFactory: () => query(collection(db, 'foodIssueReports'), where('status', '==', 'pending')),
      onData,
      onError,
      sortFn: (a, b) => b.createdAtMs - a.createdAtMs,
      mapFn: mapIssueReport,
    });
  },

  updateFoodIssueReportAndFood: async ({
    reportId,
    foodSubmissionId,
    foodUpdates,
    resolutionStatus = 'resolved',
    adminNote = '',
  }) => {
    const currentUser = await getCurrentUserOrThrow('Admin islemleri icin once giris yapmalisin.');
    const safeReportId = String(reportId || '').trim();
    const safeFoodSubmissionId = String(foodSubmissionId || '').trim();
    if (!safeReportId || !safeFoodSubmissionId) {
      throw new Error('Gecersiz rapor veya besin kaydi.');
    }
    if (!['resolved', 'rejected'].includes(resolutionStatus)) {
      throw new Error('Gecersiz cozum durumu.');
    }

    const sanitizedFood = sanitizeSubmissionEditableData(foodUpdates || {});
    if (!sanitizedFood.name || !sanitizedFood.serving) {
      throw new Error('Besin adi ve porsiyon zorunludur.');
    }
    if (sanitizedFood.diseaseTags.some(tag => sanitizedFood.unsuitableDiseaseTags.includes(tag))) {
      throw new Error('Ayni hastalik hem uygun hem uygun degil secilemez.');
    }

    const reportRef = doc(db, 'foodIssueReports', safeReportId);
    const foodRef = doc(db, 'foodSubmissions', safeFoodSubmissionId);

    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) {
      throw new Error('Rapor bulunamadi.');
    }
    const reportData = reportSnap.data();
    if (reportData.status !== 'pending') {
      throw new Error('Bu rapor zaten sonuclandirildi.');
    }

    const foodSnap = await getDoc(foodRef);
    if (!foodSnap.exists()) {
      throw new Error('Duzenlenecek besin kaydi bulunamadi.');
    }

    await updateDoc(foodRef, {
      ...sanitizedFood,
      updatedAt: serverTimestamp(),
    });

    let pointsGranted = Boolean(reportData.pointsGranted);
    if (resolutionStatus === 'resolved' && !pointsGranted && reportData.firstReporterUid) {
      const userRef = doc(db, 'users', reportData.firstReporterUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentPoints = Number(userSnap.data()?.points || 0);
        await updateDoc(userRef, {
          points: currentPoints + 50,
          updatedAt: serverTimestamp(),
        });
        pointsGranted = true;
      }
    }

    await updateDoc(reportRef, {
      status: resolutionStatus,
      adminNote: String(adminNote || '').trim(),
      resolvedBy: currentUser.uid,
      pointsGranted,
      updatedAt: serverTimestamp(),
    });

    return { success: true, pointsGranted };
  },

  deleteFoodIssueReport: async reportId => {
    await getCurrentUserOrThrow('Silme islemi icin once giris yapmalisin.');
    const safeReportId = String(reportId || '').trim();
    if (!safeReportId) {
      throw new Error('Gecersiz rapor.');
    }

    await deleteDoc(doc(db, 'foodIssueReports', safeReportId));
    return { success: true };
  },

  getSubmissionById: async submissionId => {
    await getCurrentUserOrThrow('Detay icin once giris yapmalisin.');
    const safeSubmissionId = String(submissionId || '').trim();
    if (!safeSubmissionId) {
      throw new Error('Gecersiz besin kaydi.');
    }
    const snapshot = await getDoc(doc(db, 'foodSubmissions', safeSubmissionId));
    if (!snapshot.exists()) {
      throw new Error('Besin kaydi bulunamadi.');
    }
    return mapSubmission(snapshot);
  },
};
