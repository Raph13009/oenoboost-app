import type { Dictionary } from "./fr";

const en: Dictionary = {
  nav: {
    vignoble: "Vineyard",
    cepages: "Grapes",
    sols: "Soils",
    vinification: "Winemaking",
    degustation: "Tasting",
    dictionnaire: "Dictionary",
    profil: "Profile",
  },
  auth: {
    login: "Login",
    register: "Register",
    createAccountTitle: "Create your account",
    email: "Email",
    password: "Password",
    firstName: "First name",
    lastName: "Last name",
    loginButton: "Sign in",
    registerButton: "Sign up",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    invalidCredentials: "Invalid email or password.",
    emailInUse: "An account already exists with this email.",
    passwordTooShort: "Password must be at least 6 characters.",
    requiredFields: "Please fill in all fields.",
    genericAuthError: "Unable to complete the operation. Please try again.",
  },
  vignoble: {
    title: "French Vineyards",
    regions: "Wine regions",
    subregions: "Subregions",
    appellations: "Appellations",
    hectares: "hectares",
    departmentCount: "departments",
    totalProduction: "Total production",
    explore: "Explore",
    discover: "Discover",
    backToRegions: "Back to regions",
    backToRegion: "Back to region",
    backToSubregions: "Back to subregions",
    backToAppellations: "Back to appellations",
  },
  home: {
    subtitle:
      "Explore French vineyards, discover grapes, soils, and the art of winemaking.",
    cta: "Explore the Vignoble",
  },
  common: {
    loading: "Loading...",
    error: "An error occurred.",
    empty: "No content available.",
    na: "...",
    back: "Back",
    close: "Close",
  },
  profile: {
    plan: "Plan",
    level: "Level",
    logout: "Log out",
  },
};

export default en;
