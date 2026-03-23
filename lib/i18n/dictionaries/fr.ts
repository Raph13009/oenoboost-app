const fr = {
  nav: {
    vignoble: "Vignoble",
    cepages: "Cépages",
    sols: "Sols",
    vinification: "Vinification",
    degustation: "Dégustation",
    dictionnaire: "Dictionnaire",
    profil: "Profil",
  },
  auth: {
    login: "Connexion",
    register: "Inscription",
    createAccountTitle: "Créer votre compte",
    email: "Email",
    password: "Mot de passe",
    firstName: "Prénom",
    lastName: "Nom",
    loginButton: "Se connecter",
    registerButton: "S'inscrire",
    noAccount: "Pas encore de compte ?",
    hasAccount: "Déjà un compte ?",
    invalidCredentials: "Email ou mot de passe incorrect.",
    emailInUse: "Un compte existe déjà avec cet email.",
    passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères.",
    requiredFields: "Veuillez remplir tous les champs.",
    genericAuthError: "Impossible de terminer l'opération. Réessayez.",
  },
  vignoble: {
    title: "Vignoble de France",
    regions: "Régions viticoles",
    subregions: "Sous-régions",
    appellations: "Appellations",
    hectares: "hectares",
    departmentCount: "départements",
    explore: "Explorer",
    backToRegions: "Retour aux régions",
    backToSubregions: "Retour aux sous-régions",
    backToAppellations: "Retour aux appellations",
  },
  home: {
    subtitle:
      "Explorez les vignobles de France, découvrez les cépages, les sols et l&apos;art de la vinification.",
    cta: "Explorer le Vignoble",
  },
  common: {
    loading: "Chargement...",
    error: "Une erreur est survenue.",
    empty: "Aucun contenu disponible.",
    back: "Retour",
  },
  profile: {
    plan: "Offre",
    level: "Niveau",
    logout: "Se déconnecter",
  },
};

export default fr;

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? DeepStringRecord<T[K]>
    : string;
};

export type Dictionary = DeepStringRecord<typeof fr>;
