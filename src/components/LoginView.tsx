/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  updateProfile, 
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  signOut
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  addDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { User as UserIcon, Mail, Lock, School, BookOpen, Eye, EyeOff, LogIn, Globe, Loader2 } from "lucide-react";
import type { User as AppUser } from "../types";
import type { EstablishmentSettings } from "../types";

interface LoginViewProps {
  onLogin: (user: AppUser) => void;
  establishment: EstablishmentSettings;
}

type ViewMode = "login" | "register" | "complete_profile" | "reset_password";

type ReferenceResult = {
  id: string;
  name: string;
};

const LoadingScreen = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black px-4 sm:px-6 lg:px-8">
    <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl flex flex-col items-center justify-center gap-6 rounded-2xl bg-white/15 backdrop-blur-md p-8 shadow-2xl border border-white/10">
      <Loader2 className="h-12 w-12 text-green-500 animate-spin" />

      <h2 className="text-xl md:text-2xl font-bold text-white text-center">
        Chargement...
      </h2>

      <p className="text-sm md:text-base text-slate-300 text-center">
        Préparation de la plateforme Conseil d'Enseignement.
      </p>
    </div>
  </div>
);

export default function LoginView({ onLogin, establishment }: LoginViewProps) {
  const [mode, setMode] = useState<ViewMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [checkingSession, setCheckingSession] = useState(true);

  // Éléments pour le formulaire
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ENSEIGNANT" | "ANIMATEUR_PEDAGOGIQUE">("ENSEIGNANT");
  const [pendingGoogleUser, setPendingGoogleUser] = useState<FirebaseUser | null>(null);

  const [matricule, setMatricule] = useState("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState("");
  const [classesTaught, setClassesTaught] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");

  // Listes de référence chargées depuis Firestore
  const [schoolsList, setSchoolsList] = useState<string[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  
  // États de filtrage pour le comportement Autocomplete/Combobox
  const [schoolQuery, setSchoolQuery] = useState("");
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  
  const [subjectQuery, setSubjectQuery] = useState("");
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);

  // Auto-effacement des messages de succès après 30 secondes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [success]);

  // Utilisation d'une ref pour onLogin afin d'éviter les boucles de dépendances infinies
  const onLoginRef = useRef(onLogin);
  useEffect(() => {
    onLoginRef.current = onLogin;
  }, [onLogin]);

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: "select_account"
  });

  // Chargement initial des données de référence
  useEffect(() => {
    const initSessionAndReferences = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err: unknown) {
        console.error("Erreur d'initialisation de la persistance :", err);
      }

      try {
        const schoolsSnap = await getDocs(collection(db, "schools"));
        const schoolsData: string[] = [];
        schoolsSnap.forEach(doc => {
          const data = doc.data();
          if (data.name) schoolsData.push(data.name);
        });
        // Tri naturel prenant en compte les accents et la casse en français
        schoolsData.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        setSchoolsList(schoolsData);

        const subjectsSnap = await getDocs(collection(db, "subjects"));
        const subjectsData: string[] = [];
        subjectsSnap.forEach(doc => {
          const data = doc.data();
          if (data.name) subjectsData.push(data.name);
        });
        // Tri naturel prenant en compte les accents et la casse en français
        subjectsData.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        setSubjectsList(subjectsData);
      } catch (err: unknown) {
        console.error("Erreur lors du chargement des données de référence :", err);
        setSchoolsList(["Impossible de charger les établissements. Saisissez votre établissement manuellement."]);
        setSubjectsList(["Impossible de charger les disciplines. Saisissez votre discipline manuellement."]);
      }
    };

    initSessionAndReferences();
  }, []);

  const formatAuthError = (err: unknown) => {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case "auth/user-not-found":
          return "Aucun utilisateur trouvé.";
        case "auth/wrong-password":
          return "Mot de passe incorrect.";
        case "auth/invalid-credential":
          return "Identifiants incorrects. Veuillez réessayer.";
        case "auth/email-already-in-use":
          return "Cette adresse e-mail est déjà utilisée.";
        case "auth/weak-password":
          return "Le mot de passe est trop faible.";
        default:
          return "Une erreur est survenue lors de l'authentification.";
      }
    }
    return "Une erreur inattendue est survenue.";
  };

  const validatePassword = (pwd: string): boolean => {
    const hasMinLength = pwd.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    return hasMinLength && hasUpperCase && hasNumber;
  };

  const logActivity = async (uid: string, provider: string) => {
    try {
      const browser = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const platform = typeof navigator !== "undefined" ? navigator.platform : "";
      const language = typeof navigator !== "undefined" ? navigator.language : "";

      await addDoc(collection(db, "login_history"), {
        uid,
        date: serverTimestamp(),
        provider,
        browser,
        platform,
        language,
        appVersion: "1.0.0"
      });
    } catch (e: unknown) {
      console.error("Erreur d'historisation de la connexion :", e);
    }
  };

  const getProviderId = (user: FirebaseUser): string => {
    return user.providerData.length > 0 ? user.providerData[0].providerId : "password";
  };

  // Vérification, insertion dans Firestore et mise à jour de l'état local immédiat sans doublons
  const checkAndCreateReference = async (
    collectionName: string,
    value: string
  ): Promise<ReferenceResult> => {
    const rawVal = value.trim();
    if (!rawVal) return { id: "", name: "" };

    const normalized = rawVal.toLowerCase();

    try {
      // 1. Recherche basée sur le champ normalisé
      const q = query(collection(db, collectionName), where("normalizedName", "==", normalized));
      let querySnap = await getDocs(q);
      
      // 2. Recherche de secours si non trouvé (pour gérer les données créées avant la migration)
      if (querySnap.empty) {
        const fallbackQ = query(collection(db, collectionName), where("name", "==", rawVal));
        querySnap = await getDocs(fallbackQ);
        
        // Si trouvé via l'ancien système, on met à jour le document à la volée pour y ajouter normalizedName
        if (!querySnap.empty) {
          const existingDocId = querySnap.docs[0].id;
          await updateDoc(doc(db, collectionName, existingDocId), {
            normalizedName: normalized
          });
          console.log(`Document migré avec succès dans ${collectionName} : ID ${existingDocId} -> normalizedName: ${normalized}`);
        }
      }

      if (!querySnap.empty) {
        const existingDoc = querySnap.docs[0].data();
        return {
          id: querySnap.docs[0].id,
          name: existingDoc.name || rawVal
        };
      } else {
        // Nouveau document : on l'enregistre avec les deux propriétés
        const newDoc = await addDoc(collection(db, collectionName), {
          name: rawVal,
          normalizedName: normalized,
          createdAt: serverTimestamp()
        });
        
        // Mise à jour locale immédiate en prévenant les doublons
        if (collectionName === "schools") {
          setSchoolsList(prev => {
            const updated = [...new Set([...prev, rawVal])];
            return updated.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
          });
        } else if (collectionName === "subjects") {
          setSubjectsList(prev => {
            const updated = [...new Set([...prev, rawVal])];
            return updated.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
          });
        }
        console.log(`Nouvelle entrée ajoutée dans ${collectionName} : ${rawVal} (${normalized})`);
        return {
          id: newDoc.id,
          name: rawVal
        };
      }
    } catch (e) {
      console.error(`Erreur d'ajout de la référence dans ${collectionName} :`, e);
      return { id: "", name: rawVal };
    }
  };

  // Récupération ou création dynamique du vrai département Firestore lié à l'établissement et à la discipline
  const checkAndCreateDepartment = async (
    establishmentId: string,
    subjectName: string
  ): Promise<string> => {
    const trimmedSubject = subjectName.trim();
    if (!establishmentId || !trimmedSubject) return "";

    const normalizedSubject = trimmedSubject.toLowerCase();

    try {
      const q = query(
        collection(db, "departments"),
        where("establishmentId", "==", establishmentId),
        where("normalizedName", "==", normalizedSubject)
      );
      let querySnap = await getDocs(q);

      if (querySnap.empty) {
        const fallbackQ = query(
          collection(db, "departments"),
          where("establishmentId", "==", establishmentId),
          where("name", "==", trimmedSubject)
        );
        querySnap = await getDocs(fallbackQ);

        if (!querySnap.empty) {
          const existingId = querySnap.docs[0].id;
          await updateDoc(doc(db, "departments", existingId), {
            normalizedName: normalizedSubject
          });
        }
      }

      if (!querySnap.empty) {
        return querySnap.docs[0].id;
      } else {
        const newDeptDoc = await addDoc(collection(db, "departments"), {
          name: trimmedSubject,
          normalizedName: normalizedSubject,
          establishmentId: establishmentId,
          createdAt: serverTimestamp()
        });
        return newDeptDoc.id;
      }
    } catch (e) {
      console.error("Erreur lors de la récupération/création du département Firestore :", e);
      return "";
    }
  };

  const createUserProfile = async (
    user: FirebaseUser,
    profileData: {
      fullName: string;
      matricule: string;
      phone: string;
      school: string;
      subject: string;
      grade: string;
      classes: string[];
      weeklyHours: number;
      establishmentId: string;
      departmentId: string;
      role: typeof role;
    }
  ) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const userData = {
        id: user.uid,
        uid: user.uid,

        name: profileData.fullName,

        matricule: profileData.matricule,
        email: user.email ?? "",
       phone: profileData.phone,
        role: profileData.role,
        status: "ACTIF",
        isActive: true,
        active: true,

        discipline: profileData.subject,
        department: profileData.subject,
        departmentId: profileData.departmentId,

        establishment: profileData.school,
        establishmentId: profileData.establishmentId,

        grade: profileData.grade,

        classes: profileData.classes,

        weeklyHours: profileData.weeklyHours,

        academicYear: establishment?.academicYear || "2025/2026",

        subject: profileData.subject,
        school: profileData.school,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),

        photoURL: user.photoURL ?? "",

        emailVerified: user.emailVerified,
        provider: getProviderId(user)
      };
      await setDoc(userRef, userData, { merge: true });
      return userData;
    }
    return { id: user.uid, ...snap.data() };
  };

  const updateLastLoginAndEmailVerification = async (user: FirebaseUser) => {
    try {
      await updateDoc(doc(db, "users", user.uid), { 
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: user.emailVerified
      });
    } catch (e: unknown) {
      console.error("Erreur lors de la mise à jour du profil utilisateur :", e);
    }
  };

  // Écouteur de session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (getProviderId(firebaseUser) === "password" && !firebaseUser.emailVerified) {
          setCheckingSession(false);
          return;
        }
        try {
          await updateLastLoginAndEmailVerification(firebaseUser);
          
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            const appUser = { id: firebaseUser.uid, ...snap.data() } as AppUser;
            onLoginRef.current(appUser);
          } else {
            await signOut(auth);
          }
        } catch (err) { 
          console.error("Échec de chargement ou utilisateur inexistant :", err);
          await signOut(auth);
        }
      }
      setCheckingSession(false);
    });

    return () => unsubscribe();
  }, []);

  if (checkingSession) {
    return <LoadingScreen />;
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    
    const targetSchool = schoolQuery.trim();
    const targetSubject = subjectQuery.trim();

    if (
      !fullName.trim() ||
      !matricule.trim() ||
      !email.trim() ||
      !password ||
      !phone.trim() ||
      !targetSchool ||
      !targetSubject ||
      !grade.trim() ||
      !classesTaught.trim() ||
      !weeklyHours.trim()
    ) {
      return setError(
        "Veuillez renseigner toutes les informations obligatoires."
      );
    }

    const parsedWeeklyHours = Number(weeklyHours);
    if (
      !Number.isFinite(parsedWeeklyHours) ||
      parsedWeeklyHours <= 0
    ) {
      return setError(
        "Le volume horaire hebdomadaire doit être un nombre supérieur à 0."
      );
    }

    const parsedClasses = classesTaught
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);

    if (parsedClasses.length === 0) {
      return setError(
        "Veuillez renseigner au moins une classe enseignée."
      );
    }
    
    if (!validatePassword(password)) {
      return setError("Le mot de passe doit contenir au moins 8 caractères, une lettre majuscule et un chiffre.");
    }

    try {
      setLoading(true);
      
      const finalSchool = await checkAndCreateReference("schools", targetSchool);
      const finalSubject = await checkAndCreateReference("subjects", targetSubject);
      
      const realDepartmentId = await checkAndCreateDepartment(finalSchool.id, finalSubject.name);
      if (!realDepartmentId) {
        throw new Error("Impossible de déterminer le département. Inscription annulée.");
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(credential.user, { displayName: fullName });
      await sendEmailVerification(credential.user);

      await createUserProfile(
        credential.user,
        {
          fullName: fullName.trim(),
          matricule: matricule.trim(),
          phone: phone.trim(),
          school: finalSchool.name,
          subject: finalSubject.name,
          grade: grade.trim(),
          classes: parsedClasses,
          weeklyHours: parsedWeeklyHours,
          establishmentId: finalSchool.id,
          departmentId: realDepartmentId,
          role
        }
      );
      
      const targetMessage = "Compte créé avec succès. Un e-mail de vérification vous a été envoyé. Veuillez le confirmer avant de vous connecter.";
      
      clearForm({ keepSuccessMessage: true });
      setSuccess(targetMessage);
      
      await signOut(auth);
      setMode("login");
    } catch (err: unknown) { 
      console.error(err); 
      setError(formatAuthError(err)); 
    } finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateLastLoginAndEmailVerification(credential.user);
      await logActivity(credential.user.uid, "password");
      
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        throw new Error("Utilisateur introuvable dans Firestore.");
      }
      
      const loggedInUser = { id: credential.user.uid, ...snap.data() } as AppUser;
      onLoginRef.current(loggedInUser);
      
      setMode("login");
      clearForm();
     } catch (err: unknown) {
      console.error("Erreur de connexion :", err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      setLoading(true);
      const credential = await signInWithPopup(auth, googleProvider);
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      if (!snap.exists()) {
        setPendingGoogleUser(credential.user);
        setFullName(credential.user.displayName || "");
        setMode("complete_profile");
      } else {
        await updateLastLoginAndEmailVerification(credential.user);
        await logActivity(credential.user.uid, "google.com");
        
        const loggedInUser = { id: credential.user.uid, ...snap.data() } as AppUser;
        
        onLoginRef.current(loggedInUser);
        setMode("login");
        clearForm();
      }
    } catch (err: unknown) { 
      console.error(err); 
      setError(formatAuthError(err)); 
    } finally { setLoading(false); }
  };

  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!pendingGoogleUser) return;

    const targetSchool = schoolQuery.trim();
    const targetSubject = subjectQuery.trim();

    if (
      !fullName.trim() ||
      !matricule.trim() ||
      !phone.trim() ||
      !targetSchool ||
      !targetSubject ||
      !grade.trim() ||
      !classesTaught.trim() ||
      !weeklyHours.trim()
    ) {
      return setError("Veuillez renseigner toutes les informations obligatoires.");
    }

    const parsedWeeklyHours = Number(weeklyHours);
    if (!Number.isFinite(parsedWeeklyHours) || parsedWeeklyHours <= 0) {
      return setError("Le volume horaire hebdomadaire doit être un nombre supérieur à 0.");
    }

    const parsedClasses = classesTaught
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);

    if (parsedClasses.length === 0) {
      return setError("Veuillez renseigner au moins une classe enseignée.");
    }

    try {
      setLoading(true);

      const finalSchool = await checkAndCreateReference("schools", targetSchool);
      const finalSubject = await checkAndCreateReference("subjects", targetSubject);

      const realDepartmentId = await checkAndCreateDepartment(finalSchool.id, finalSubject.name);
      if (!realDepartmentId) {
        throw new Error("Impossible de déterminer le département. Inscription annulée.");
      }

      const createdUser = await createUserProfile(pendingGoogleUser, { 
        fullName: fullName.trim(), 
        matricule: matricule.trim(),
        phone: phone.trim(),
        school: finalSchool.name, 
        subject: finalSubject.name, 
        grade: grade.trim(),
        classes: parsedClasses,
        weeklyHours: parsedWeeklyHours,
        establishmentId: finalSchool.id,
        departmentId: realDepartmentId,
        role 
      });
      
      await updateLastLoginAndEmailVerification(pendingGoogleUser);
      await logActivity(pendingGoogleUser.uid, "google.com");
      
      const loggedInUser = createdUser as AppUser;
      
      onLoginRef.current(loggedInUser);
      setMode("login");
      clearForm();
    } catch (err: unknown) { 
      console.error(err); 
      setError(formatAuthError(err)); 
    } finally { setLoading(false); }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!email) return setError("Veuillez saisir votre adresse e-mail.");
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setSuccess("Un lien de réinitialisation de mot de passe a été envoyé à votre adresse e-mail.");
    } catch (err: unknown) {
      console.error(err);
      setError(formatAuthError(err));
    } finally { setLoading(false); }
  };

  const clearForm = (options?: { keepSuccessMessage?: boolean }) => { 
    setEmail(""); 
    setPassword(""); 
    setFullName(""); 

    setMatricule("");
    setPhone("");
    setGrade("");
    setClassesTaught("");
    setWeeklyHours("");

    setSchoolQuery("");
    setSubjectQuery("");
    setRole("ENSEIGNANT"); 
    setError(""); 
    if (!options?.keepSuccessMessage) {
      setSuccess("");
    }
    setPendingGoogleUser(null); 
  };

  const filteredSchools = schoolsList.filter(s => 
    s.toLowerCase().includes(schoolQuery.toLowerCase()) && !s.includes("Impossible")
  );

  const filteredSubjects = subjectsList.filter(sub => 
    sub.toLowerCase().includes(subjectQuery.toLowerCase()) && !sub.includes("Impossible")
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-700 via-red-600 to-yellow-500 p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg"><School size={42} className="text-green-700" /></div>
          </div>
          <h1 className="text-2xl font-black text-white">CONSEIL D'ENSEIGNEMENT</h1>
          <p className="text-white/90 text-sm mt-2">Plateforme Numérique MINESEC</p>
        </div>

        <div className="p-8">
          {error && <div className="mb-4 rounded-xl bg-red-100 border border-red-300 p-3 text-red-700 text-sm">{error}</div>}
          {success && <div className="mb-4 rounded-xl bg-green-100 border border-green-300 p-3 text-green-700 text-sm">{success}</div>}

          {mode !== "complete_profile" && mode !== "reset_password" && (
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button type="button" onClick={() => { clearForm(); setMode("login"); }} className={`rounded-xl py-3 font-bold transition ${mode === "login" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"}`}>Connexion</button>
              <button type="button" onClick={() => { clearForm(); setMode("register"); }} className={`rounded-xl py-3 font-bold transition ${mode === "register" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"}`}>Inscription</button>
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-sm font-semibold block mb-2">Adresse e-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enseignant@email.com" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold block mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => { clearForm(); setMode("reset_password"); }} className="text-xs font-semibold text-green-700 hover:underline">Mot de passe oublié ?</button>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold transition flex justify-center items-center gap-2"><LogIn size={18} /> {loading ? "Connexion..." : "Se connecter"}</button>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide">
                  ① Identité et contact
                </h3>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Nom complet *</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom et prénom" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Matricule *
                </label>
                <input
                  type="text"
                  required
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="Ex. MAT-123456"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Adresse e-mail *</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enseignant@email.com" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex. 6XX XX XX XX"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Mot de passe *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Exigé : 8 caractères minimum, une majuscule et un chiffre.</span>
              </div>

              <div className="mt-6 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">
                  ② Affectation administrative
                </h3>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Établissement *</label>
                <div className="relative">
                  <School size={18} className="absolute left-3 top-3.5 text-slate-400 z-10" />
                  <input 
                    type="text" 
                    required 
                    value={schoolQuery} 
                    onChange={(e) => { setSchoolQuery(e.target.value); setShowSchoolSuggestions(true); }} 
                    onFocus={() => setShowSchoolSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSchoolSuggestions(false), 200);
                    }}
                    placeholder="Saisir ou sélectionner un établissement" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" 
                  />
                  {showSchoolSuggestions && schoolQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                      {filteredSchools.length > 0 ? (
                        filteredSchools.map((sch) => (
                          <div 
                            key={sch} 
                            onMouseDown={(e) => { 
                              e.preventDefault(); 
                              setSchoolQuery(sch); 
                              setShowSchoolSuggestions(false); 
                            }} 
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                          >
                            {sch}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-green-600 italic font-semibold">
                          « {schoolQuery} » sera créé comme nouvel établissement
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {schoolsList.some(s => s.includes("Impossible")) && (
                  <span className="text-[10px] text-amber-600 mt-1 block">Impossible de joindre le serveur. Saisie libre activée.</span>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Discipline *</label>
                <div className="relative">
                  <BookOpen size={18} className="absolute left-3 top-3.5 text-slate-400 z-10" />
                  <input 
                    type="text" 
                    required 
                    value={subjectQuery} 
                    onChange={(e) => { setSubjectQuery(e.target.value); setShowSubjectSuggestions(true); }} 
                    onFocus={() => setShowSubjectSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSubjectSuggestions(false), 200);
                    }}
                    placeholder="Saisir ou sélectionner une discipline" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" 
                  />
                  {showSubjectSuggestions && subjectQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                      {filteredSubjects.length > 0 ? (
                        filteredSubjects.map((sub) => (
                          <div 
                            key={sub} 
                            onMouseDown={(e) => { 
                              e.preventDefault(); 
                              setSubjectQuery(sub); 
                              setShowSubjectSuggestions(false); 
                            }} 
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                          >
                            {sub}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-green-600 italic font-semibold">
                          « {subjectQuery} » sera créée comme nouvelle discipline
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {subjectsList.some(sub => sub.includes("Impossible")) && (
                  <span className="text-[10px] text-amber-600 mt-1 block">Impossible de joindre le serveur. Saisie libre activée.</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Grade *
                </label>
                <select
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none bg-white"
                >
                  <option value="">Sélectionner votre grade</option>
                  <option value="PLEG">PLEG</option>
                  <option value="PCEG">PCEG</option>
                  <option value="PEN">PEN</option>
                  <option value="VACATAIRE">Vacataire</option>
                  <option value="CONTRACTUEL">Contractuel</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>

              <div className="mt-6 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide">
                  ③ Affectation pédagogique
                </h3>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Classes enseignées *
                </label>
                <input
                  type="text"
                  required
                  value={classesTaught}
                  onChange={(e) => setClassesTaught(e.target.value)}
                  placeholder="Ex. 4ème, 3ème, 2nde, 1ère"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Séparez les classes par des virgules.
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Volume horaire hebdomadaire *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.5"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  placeholder="Ex. 18"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Nombre d'heures enseignées par semaine.
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Rôle *</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value as "ENSEIGNANT" | "ANIMATEUR_PEDAGOGIQUE")} 
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none bg-white"
                >
                  <option value="ENSEIGNANT">Enseignant</option>
                  <option value="ANIMATEUR_PEDAGOGIQUE">Animateur pédagogique</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold transition">{loading ? "Création du compte..." : "Créer mon compte"}</button>
            </form>
          )}

          {mode === "complete_profile" && (
            <form onSubmit={handleCompleteProfileSubmit} className="space-y-5">
              <h3 className="text-md font-bold text-center text-slate-700 mb-2">Compléter vos informations</h3>
              
              <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide">
                  ① Identité et contact
                </h3>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Nom complet *</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Matricule *</label>
                <input
                  type="text"
                  required
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="Ex. MAT-123456"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex. 6XX XX XX XX"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
              </div>

              <div className="mt-6 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">
                  ② Affectation administrative
                </h3>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Établissement *</label>
                <div className="relative">
                  <School size={18} className="absolute left-3 top-3.5 text-slate-400 z-10" />
                  <input 
                    type="text" 
                    required 
                    value={schoolQuery} 
                    onChange={(e) => { setSchoolQuery(e.target.value); setShowSchoolSuggestions(true); }} 
                    onFocus={() => setShowSchoolSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSchoolSuggestions(false), 200);
                    }}
                    placeholder="Saisir ou sélectionner un établissement" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" 
                  />
                  {showSchoolSuggestions && schoolQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                      {filteredSchools.length > 0 ? (
                        filteredSchools.map((sch) => (
                          <div 
                            key={sch} 
                            onMouseDown={(e) => { 
                              e.preventDefault(); 
                              setSchoolQuery(sch); 
                              setShowSchoolSuggestions(false); 
                            }} 
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                          >
                            {sch}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-green-600 italic font-semibold">
                          « {schoolQuery} » sera créé comme nouvel établissement
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {schoolsList.some(s => s.includes("Impossible")) && (
                  <span className="text-[10px] text-amber-600 mt-1 block">Impossible de joindre le serveur. Saisie libre activée.</span>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Discipline *</label>
                <div className="relative">
                  <BookOpen size={18} className="absolute left-3 top-3.5 text-slate-400 z-10" />
                  <input 
                    type="text" 
                    required 
                    value={subjectQuery} 
                    onChange={(e) => { setSubjectQuery(e.target.value); setShowSubjectSuggestions(true); }} 
                    onFocus={() => setShowSubjectSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSubjectSuggestions(false), 200);
                    }}
                    placeholder="Saisir ou sélectionner une discipline" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none" 
                  />
                  {showSubjectSuggestions && subjectQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                      {filteredSubjects.length > 0 ? (
                        filteredSubjects.map((sub) => (
                          <div 
                            key={sub} 
                            onMouseDown={(e) => { 
                              e.preventDefault(); 
                              setSubjectQuery(sub); 
                              setShowSubjectSuggestions(false); 
                            }} 
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700"
                          >
                            {sub}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-green-600 italic font-semibold">
                          « {subjectQuery} » sera créée comme nouvelle discipline
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {subjectsList.some(sub => sub.includes("Impossible")) && (
                  <span className="text-[10px] text-amber-600 mt-1 block">Impossible de joindre le serveur. Saisie libre activée.</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Grade *</label>
                <select
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none bg-white"
                >
                  <option value="">Sélectionner votre grade</option>
                  <option value="PLEG">PLEG</option>
                  <option value="PCEG">PCEG</option>
                  <option value="PEN">PEN</option>
                  <option value="VACATAIRE">Vacataire</option>
                  <option value="CONTRACTUEL">Contractuel</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>

              <div className="mt-6 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide">
                  ③ Affectation pédagogique
                </h3>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Classes enseignées *</label>
                <input
                  type="text"
                  required
                  value={classesTaught}
                  onChange={(e) => setClassesTaught(e.target.value)}
                  placeholder="Ex. 4ème, 3ème, 2nde, 1ère"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Séparez les classes par des virgules.
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Volume horaire hebdomadaire *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.5"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  placeholder="Ex. 18"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Nombre d'heures enseignées par semaine.
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Rôle *</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value as "ENSEIGNANT" | "ANIMATEUR_PEDAGOGIQUE")} 
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-600 focus:outline-none bg-white"
                >
                  <option value="ENSEIGNANT">Enseignant</option>
                  <option value="ANIMATEUR_PEDAGOGIQUE">Animateur pédagogique</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold transition">{loading ? "Enregistrement..." : "Finaliser mon inscription"}</button>
            </form>
          )}

          {mode === "reset_password" && (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <h3 className="text-md font-bold text-center text-slate-700 mb-2">Réinitialiser le mot de passe</h3>
              <div>
                <label className="text-sm font-semibold block mb-2">Adresse e-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enseignant@email.com" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <button type="button" onClick={() => { clearForm(); setMode("login"); }} className="text-sm font-semibold text-slate-500 hover:underline">Retour</button>
                <button type="submit" disabled={loading} className="py-2 px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold transition text-sm">{loading ? "Envoi en cours..." : "Envoyer le lien"}</button>
              </div>
            </form>
          )}

          {mode !== "complete_profile" && mode !== "reset_password" && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-slate-300"></div>
                <span className="px-4 text-sm text-slate-500">OU</span>
                <div className="flex-1 border-t border-slate-300"></div>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full py-3 rounded-xl border border-slate-300 hover:bg-slate-100 transition flex items-center justify-center gap-3 font-semibold">
                <Globe size={20} className="text-red-500" />
                {loading ? "Connexion..." : "Continuer avec Google"}
              </button>
            </>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">Plateforme Numérique des Conseils d'Enseignement</p>
            <p className="text-xs text-slate-400 mt-2">Ministère des Enseignements Secondaires</p>
            <p className="text-xs text-slate-400">République du Cameroun</p>
          </div>
        </div>
      </div>
    </div>
  );
}