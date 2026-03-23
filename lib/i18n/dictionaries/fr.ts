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
    confirmPassword: "Confirmer le mot de passe",
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
    passwordsDoNotMatch: "Les mots de passe ne correspondent pas.",
  },
  cepages: {
    title: "Cépages",
    redGrapes: "Cépages rouges",
    whiteGrapes: "Cépages blancs",
    searchPlaceholder: "Rechercher un cépage",
    allRegions: "Toutes les régions",
    allTypes: "Tous les types",
    origin: "Origine",
    history: "Histoire",
    characteristics: "Caractéristiques",
    tasting: "Dégustation",
    productionRegions: "Régions de production",
    crossings: "Croisements",
    emblematicWines: "Vins emblématiques",
    grapeMap: "Carte du cépage",
    mapPlaceholder: "Carte à venir",
    red: "Rouge",
    white: "Blanc",
    rose: "Rosé",
    backToGrapes: "Retour aux cépages",
  },
  vignoble: {
    title: "Vignoble de France",
    regions: "Régions viticoles",
    subregions: "Sous-régions",
    appellations: "Appellations",
    hectares: "hectares",
    departmentCount: "départements",
    totalProduction: "production totale",
    explore: "Explorer",
    discover: "Découvrir",
    backToRegions: "Retour aux régions",
    backToRegion: "Retour à la région",
    backToMap: "Retour à la carte",
    viewAllAops: "Voir toutes les AOP",
    allAops: "Toutes les AOP",
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
    na: "...",
    back: "Retour",
    close: "Fermer",
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
