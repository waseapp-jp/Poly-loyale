import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, linkWithPopup, EmailAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: Must supply firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error handling conforming strictly to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection validation helper
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified');
  } catch (error) {
    // Gracefully handle offline or initial connection state without throwing
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline mode active');
    }
  }
}

export interface UserProfileData {
  userId: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  totalWins: number;
  totalKills: number;
  totalDeaths?: number;
  totalMatches: number;
  favoriteClass?: string;
  rating?: number;
  rankPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntryData {
  userId: string;
  displayName: string;
  totalWins: number;
  totalKills: number;
  rating?: number;
  updatedAt: string;
}

export interface MatchHistoryData {
  id: string;
  userId: string;
  mode: string;
  placement: number;
  score?: number;
  kills: number;
  ratingChange: number;
  newRating: number;
  createdAt: string;
}

// User Profile Operations
export async function loadOrCreateUserProfile(user: User): Promise<UserProfileData> {
  const userPath = `users/${user.uid}`;
  try {
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);

    let profile: UserProfileData;

    if (snap.exists()) {
      profile = snap.data() as UserProfileData;
      // Fix legacy bug where default rating was erroneously initialized as 2000 for new users
      if (profile.rating === 2000 && (!profile.rankPoints || profile.rankPoints < 2000)) {
        profile.rating = undefined;
        profile.rankPoints = profile.rankPoints || 0;
        await setDoc(docRef, { rating: null, rankPoints: profile.rankPoints }, { merge: true });
      }
    } else {
      profile = {
        userId: user.uid,
        displayName: user.displayName || `Player_${user.uid.slice(0, 5)}`,
        email: user.email || '',
        photoURL: user.photoURL || '',
        totalWins: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalMatches: 0,
        rating: undefined,
        rankPoints: 0,
        favoriteClass: 'assault',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, profile);
    }

    // Always ensure user is indexed in public leaderboard collection
    try {
      const lbRef = doc(db, 'leaderboard', user.uid);
      await setDoc(lbRef, {
        userId: user.uid,
        displayName: profile.displayName,
        totalWins: profile.totalWins || 0,
        totalKills: profile.totalKills || 0,
        rating: profile.rating ?? profile.rankPoints ?? 0,
        updatedAt: profile.updatedAt,
      }, { merge: true });
    } catch (e) {
      console.warn('Leaderboard sync note:', e);
    }

    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function updateUserStats(
  userId: string,
  won: boolean,
  kills: number,
  deaths: number,
  favClass: string,
  ratingChange: number = 0,
  finalRatingOrPoints: number = 0,
  mode: string = 'casual',
  score: number = 0,
  placement?: number
): Promise<void> {
  const userPath = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const current = snap.data() as UserProfileData;
    const isRanked = mode === 'ranked';

    let updatedRankPoints = current.rankPoints || 0;
    let updatedRating = current.rating && current.rating >= 2000 ? current.rating : undefined;

    if (isRanked) {
      if (finalRatingOrPoints >= 2000) {
        updatedRating = finalRatingOrPoints;
        updatedRankPoints = Math.max(updatedRankPoints, 2000);
      } else {
        updatedRankPoints = Math.max(0, finalRatingOrPoints);
        updatedRating = undefined;
      }
    }

    const updated: UserProfileData = {
      ...current,
      totalWins: current.totalWins + (won ? 1 : 0),
      totalKills: current.totalKills + kills,
      totalDeaths: (current.totalDeaths || 0) + deaths,
      totalMatches: current.totalMatches + 1,
      rankPoints: updatedRankPoints,
      rating: updatedRating,
      favoriteClass: favClass,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, updated);

    // Also update public leaderboard
    const lbRef = doc(db, 'leaderboard', userId);
    const lbData: LeaderboardEntryData = {
      userId,
      displayName: updated.displayName,
      totalWins: updated.totalWins,
      totalKills: updated.totalKills,
      rating: updatedRating ?? updatedRankPoints,
      updatedAt: updated.updatedAt,
    };
    await setDoc(lbRef, lbData);
    
    // Add match history with placement, score, mode, and rating
    const historyId = Math.random().toString(36).substring(2, 15);
    const historyRef = doc(db, 'users', userId, 'history', historyId);
    const actualPlacement = placement !== undefined ? placement : (won ? 1 : 2);
    const actualScore = typeof score === 'number' && score >= 0 ? score : (kills * 100 + (won ? 500 : 50));
    const historyData: MatchHistoryData = {
      id: historyId,
      userId,
      mode,
      placement: actualPlacement,
      score: actualScore,
      kills,
      ratingChange,
      newRating: updatedRating ?? updatedRankPoints,
      createdAt: updated.updatedAt,
    };
    await setDoc(historyRef, historyData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

export async function fetchTopLeaderboard(): Promise<LeaderboardEntryData[]> {
  const lbPath = 'leaderboard';
  try {
    let snap;
    try {
      const q = query(collection(db, 'leaderboard'), orderBy('rating', 'desc'), limit(30));
      snap = await getDocs(q);
    } catch {
      const q = query(collection(db, 'leaderboard'), limit(50));
      snap = await getDocs(q);
    }
    const entries = snap.docs.map(d => d.data() as LeaderboardEntryData);
    entries.sort((a, b) => {
      const rA = typeof a.rating === 'number' && Number.isFinite(a.rating) ? a.rating : 0;
      const rB = typeof b.rating === 'number' && Number.isFinite(b.rating) ? b.rating : 0;
      if (rB !== rA) return rB - rA;
      if ((b.totalWins || 0) !== (a.totalWins || 0)) return (b.totalWins || 0) - (a.totalWins || 0);
      return (b.totalKills || 0) - (a.totalKills || 0);
    });
    return entries.slice(0, 25);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, lbPath);
    return [];
  }
}

// Review and Feedback Helpers
export interface GameReviewData {
  id: string;
  authorName: string;
  rating: number; // 1 to 5
  controlsRating?: number;
  balanceRating?: number;
  comment: string;
  createdAt: string;
  replyText?: string;
  repliedAt?: string;
}

export async function submitGameReview(data: {
  authorName: string;
  rating: number;
  controlsRating?: number;
  balanceRating?: number;
  comment: string;
}): Promise<boolean> {
  const reviewsPath = 'reviews';
  try {
    const reviewId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const docRef = doc(db, 'reviews', reviewId);
    const reviewPayload: GameReviewData = {
      id: reviewId,
      authorName: data.authorName.trim() || '名無しのプレイヤー',
      rating: Math.max(1, Math.min(5, data.rating)),
      controlsRating: data.controlsRating ? Math.max(1, Math.min(5, data.controlsRating)) : data.rating,
      balanceRating: data.balanceRating ? Math.max(1, Math.min(5, data.balanceRating)) : data.rating,
      comment: data.comment.trim().substring(0, 500),
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, reviewPayload);
    return true;
  } catch (err) {
    console.error('Submit review error:', err);
    return false;
  }
}

export async function replyToReview(reviewId: string, replyText: string): Promise<boolean> {
  const reviewsPath = 'reviews';
  try {
    const userEmail = auth.currentUser?.email?.toLowerCase();
    if (userEmail !== '1919114514yasenpai@gmail.com') {
      console.error('Unauthorized: Developer reply restricted to 1919114514yasenpai@gmail.com');
      return false;
    }
    const docRef = doc(db, 'reviews', reviewId);
    await updateDoc(docRef, {
      replyText: replyText.trim().substring(0, 500),
      repliedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Reply to review error:', err);
    return false;
  }
}

export async function fetchRecentReviews(): Promise<GameReviewData[]> {
  const reviewsPath = 'reviews';
  try {
    const q = query(collection(db, 'reviews'), limit(25));
    const snap = await getDocs(q);
    const reviews = snap.docs.map(d => d.data() as GameReviewData);
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reviews;
  } catch (err) {
    console.error('Fetch reviews error:', err);
    return [];
  }
}

// Authentication Helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Auth Error:', error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
  }
}

export async function fetchUserHistory(userId: string): Promise<MatchHistoryData[]> {
  const historyPath = `users/${userId}/history`;
  try {
    try {
      const q = query(collection(db, 'users', userId, 'history'), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as MatchHistoryData);
    } catch (queryErr) {
      // Fallback in case of index delay or offline cache
      const snap = await getDocs(collection(db, 'users', userId, 'history'));
      const items = snap.docs.map(d => d.data() as MatchHistoryData);
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, historyPath);
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<User | null> {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    return res.user;
  } catch (error) {
    console.error('Email Auth Error:', error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string): Promise<User | null> {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    return res.user;
  } catch (error) {
    console.error('Email Auth Error:', error);
    throw error;
  }
}

export async function linkGoogleAccount(): Promise<User | null> {
  try {
    if (!auth.currentUser) return null;
    const res = await linkWithPopup(auth.currentUser, googleProvider);
    return res.user;
  } catch (error) {
    console.error('Link Google Error:', error);
    throw error;
  }
}

// ==========================================
// FRIEND SYSTEM INTERFACES & FIRESTORE OPS
// ==========================================

export interface FriendData {
  friendUid: string;
  displayName: string;
  photoURL?: string;
  addedAt: string;
}

export interface FriendRequestData {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto?: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// Search user profile by User ID or Display Name
export async function searchUserByIdOrName(searchQueryStr: string): Promise<UserProfileData | null> {
  if (!searchQueryStr) return null;
  
  // Clean prefix like "ID: ", "id: ", "UID: " and whitespace
  let cleanQuery = searchQueryStr.trim().replace(/^(id|uid)\s*:\s*/i, '').trim();
  if (!cleanQuery) return null;

  try {
    // 1. Direct match by Auth UID in users collection
    try {
      const directDoc = await getDoc(doc(db, 'users', cleanQuery));
      if (directDoc.exists()) {
        return directDoc.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Direct UID lookup note:', e);
    }

    // 2. Query users collection by exact displayName
    try {
      const usersQ = query(collection(db, 'users'), where('displayName', '==', cleanQuery), limit(1));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        return usersSnap.docs[0].data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Users collection query note:', e);
    }

    // 3. Query leaderboard collection by exact displayName
    try {
      const lbQ = query(collection(db, 'leaderboard'), where('displayName', '==', cleanQuery), limit(1));
      const lbSnap = await getDocs(lbQ);
      if (!lbSnap.empty) {
        const match = lbSnap.docs[0].data();
        if (match.userId) {
          const userDoc = await getDoc(doc(db, 'users', match.userId));
          if (userDoc.exists()) {
            return userDoc.data() as UserProfileData;
          }
        }
      }
    } catch (e) {
      console.warn('Leaderboard query note:', e);
    }

    // 4. Scan users collection for case-insensitive or partial match
    try {
      const allUsersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
      const lower = cleanQuery.toLowerCase();
      const matched = allUsersSnap.docs.find(d => {
        const data = d.data() as UserProfileData;
        const name = (data.displayName || '').toLowerCase();
        const uid = (data.userId || '').toLowerCase();
        return name === lower || uid === lower || name.includes(lower);
      });
      if (matched) {
        return matched.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Users scan note:', e);
    }

    return null;
  } catch (err) {
    console.warn('User search error:', err);
    return null;
  }
}

// Fetch friend list for a user
export async function fetchFriends(userId: string): Promise<FriendData[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'friends'));
    return snap.docs.map(d => d.data() as FriendData);
  } catch (err) {
    console.error('Fetch friends error:', err);
    return [];
  }
}

// Fetch pending friend requests received by user
export async function fetchFriendRequests(userId: string): Promise<FriendRequestData[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'friendRequests'));
    return snap.docs
      .map(d => d.data() as FriendRequestData)
      .filter(req => req.status === 'pending');
  } catch (err) {
    console.error('Fetch friend requests error:', err);
    return [];
  }
}

// Send friend request by User ID or Display Name
export async function sendFriendRequest(fromUser: UserProfileData, targetInput: string): Promise<{ success: boolean; message: string }> {
  let cleanInput = targetInput.trim().replace(/^(id|uid)\s*:\s*/i, '').trim();
  if (!cleanInput) {
    return { success: false, message: 'ユーザーIDまたは名前を入力してください' };
  }

  if (fromUser.userId === cleanInput) {
    return { success: false, message: '自分自身にフレンド申請は送れません' };
  }

  try {
    // Resolve target profile / UID
    let targetUid = cleanInput;
    let targetProfile: UserProfileData | null = null;

    // Check if cleanInput is directly an existing user ID
    try {
      const targetDoc = await getDoc(doc(db, 'users', cleanInput));
      if (targetDoc.exists()) {
        targetProfile = targetDoc.data() as UserProfileData;
        targetUid = targetProfile.userId;
      }
    } catch (e) {
      console.warn('Direct target doc fetch note:', e);
    }

    // If not found by direct ID, search by name/leaderboard
    if (!targetProfile) {
      targetProfile = await searchUserByIdOrName(cleanInput);
      if (targetProfile) {
        targetUid = targetProfile.userId;
      }
    }

    if (fromUser.userId === targetUid) {
      return { success: false, message: '自分自身にフレンド申請は送れません' };
    }

    // Check if target user exists in Firestore or input is a valid UID format
    if (!targetProfile) {
      if (cleanInput.length >= 10 && /^[a-zA-Z0-9_\-]+$/.test(cleanInput)) {
        targetUid = cleanInput;
        targetProfile = {
          userId: cleanInput,
          displayName: `ID: ${cleanInput.slice(0, 8)}...`,
          email: '',
          photoURL: '',
          totalWins: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalMatches: 0,
          rating: 2000,
          rankPoints: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        return { success: false, message: `ユーザー 「${cleanInput}」 が見つかりませんでした。正しいIDまたは名前をご確認ください。` };
      }
    }

    // Check if already friends
    const friendDoc = await getDoc(doc(db, 'users', fromUser.userId, 'friends', targetUid));
    if (friendDoc.exists()) {
      return { success: false, message: `「${targetProfile.displayName}」さんとは既にフレンドです` };
    }

    const requestId = `${fromUser.userId}_${targetUid}`;
    const reqRef = doc(db, 'users', targetUid, 'friendRequests', requestId);

    const newReq: FriendRequestData = {
      id: requestId,
      fromUid: fromUser.userId,
      fromName: fromUser.displayName,
      fromPhoto: fromUser.photoURL || '',
      toUid: targetUid,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await setDoc(reqRef, newReq);
    return { success: true, message: `「${targetProfile.displayName}」さんへフレンド申請を送信しました！` };
  } catch (err) {
    console.error('Send friend request error:', err);
    return { success: false, message: 'フレンド申請の送信に失敗しました（権限または接続を確認してください）' };
  }
}

// Accept friend request
export async function acceptFriendRequest(request: FriendRequestData, currentProfile: UserProfileData): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    // 1. Add friend to current user's friends subcollection
    await setDoc(doc(db, 'users', currentProfile.userId, 'friends', request.fromUid), {
      friendUid: request.fromUid,
      displayName: request.fromName,
      photoURL: request.fromPhoto || '',
      addedAt: now,
    });

    // 2. Add current user to requester's friends subcollection
    await setDoc(doc(db, 'users', request.fromUid, 'friends', currentProfile.userId), {
      friendUid: currentProfile.userId,
      displayName: currentProfile.displayName,
      photoURL: currentProfile.photoURL || '',
      addedAt: now,
    });

    // 3. Remove friend request doc
    await deleteDoc(doc(db, 'users', currentProfile.userId, 'friendRequests', request.id));
    return true;
  } catch (err) {
    console.error('Accept friend request error:', err);
    return false;
  }
}

// Reject friend request
export async function rejectFriendRequest(userId: string, requestId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'friendRequests', requestId));
    return true;
  } catch (err) {
    console.error('Reject friend request error:', err);
    return false;
  }
}

// Remove friend
export async function removeFriend(userId: string, friendUid: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'friends', friendUid));
    await deleteDoc(doc(db, 'users', friendUid, 'friends', userId));
    return true;
  } catch (err) {
    console.error('Remove friend error:', err);
    return false;
  }
}

