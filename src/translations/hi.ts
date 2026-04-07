/**
 * Hindi (hi-IN) Translations for VALORHIVE
 * 
 * This file contains all UI text translations in Hindi.
 * Keys are organized by feature/module.
 */

export const hiTranslations = {
  // Common
  common: {
    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    create: 'बनाएं',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    clear: 'साफ़ करें',
    loading: 'लोड हो रहा है...',
    noData: 'कोई डेटा नहीं',
    error: 'त्रुटि',
    success: 'सफल',
    confirm: 'पुष्टि करें',
    back: 'वापस',
    next: 'आगे',
    submit: 'जमा करें',
    close: 'बंद करें',
    yes: 'हाँ',
    no: 'नहीं',
    all: 'सभी',
    none: 'कोई नहीं',
    other: 'अन्य',
    viewAll: 'सभी देखें',
    showMore: 'और दिखाएं',
    showLess: 'कम दिखाएं',
    required: 'आवश्यक',
    optional: 'वैकल्पिक',
  },

  // Navigation
  nav: {
    dashboard: 'डैशबोर्ड',
    tournaments: 'टूर्नामेंट',
    leaderboard: 'लीडरबोर्ड',
    profile: 'प्रोफ़ाइल',
    settings: 'सेटिंग्स',
    logout: 'लॉगआउट',
    login: 'लॉग इन',
    register: 'पंजीकरण',
    teams: 'टीमें',
    analytics: 'विश्लेषण',
    players: 'खिलाड़ी',
    organizations: 'संगठन',
    messages: 'संदेश',
    notifications: 'सूचनाएं',
    help: 'सहायता',
  },

  // Authentication
  auth: {
    loginTitle: 'अपने खाते में लॉग इन करें',
    registerTitle: 'नया खाता बनाएं',
    email: 'ईमेल',
    phone: 'फ़ोन नंबर',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि करें',
    forgotPassword: 'पासवर्ड भूल गए?',
    resetPassword: 'पासवर्ड रीसेट करें',
    otpSent: 'OTP भेजा गया',
    enterOtp: 'OTP दर्ज करें',
    loginWithGoogle: 'Google से लॉग इन करें',
    loginWithPhone: 'फ़ोन से लॉग इन करें',
    noAccount: 'खाता नहीं है? पंजीकरण करें',
    hasAccount: 'पहले से खाता है? लॉग इन करें',
    invalidCredentials: 'अमान्य ईमेल या पासवर्ड',
    accountLocked: 'खाता लॉक कर दिया गया है। 30 मिनट बाद प्रयास करें।',
    passwordTooShort: 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए',
    passwordsDoNotMatch: 'पासवर्ड मेल नहीं खाते',
  },

  // Dashboard
  dashboard: {
    welcome: 'स्वागत है',
    upcomingMatches: 'आगामी मैच',
    recentResults: 'हाल के परिणाम',
    achievements: 'उपलब्धियां',
    currentStreak: 'वर्तमान सीरीज़',
    bestStreak: 'सर्वश्रेष्ठ सीरीज़',
    tournamentsWon: 'टूर्नामेंट जीते',
    totalMatches: 'कुल मैच',
    winRate: 'जीत दर',
    noUpcomingMatches: 'कोई आगामी मैच नहीं',
    noRecentResults: 'कोई हाल के परिणाम नहीं',
    viewAllMatches: 'सभी मैच देखें',
    completeProfile: 'प्रोफ़ाइल पूर्ण करें',
    profileCompletion: 'प्रोफ़ाइल पूर्णता',
  },

  // Tournaments
  tournaments: {
    title: 'टूर्नामेंट',
    create: 'टूर्नामेंट बनाएं',
    join: 'टूर्नामेंट में शामिल हों',
    leave: 'टूर्नामेंट छोड़ें',
    myTournaments: 'मेरे टूर्नामेंट',
    upcoming: 'आगामी',
    live: 'लाइव',
    completed: 'पूर्ण',
    registration: 'पंजीकरण',
    registrationOpen: 'पंजीकरण खुला है',
    registrationClosed: 'पंजीकरण बंद',
    bracketGenerated: 'ब्रैकेट बन गया है',
    inProgress: 'प्रगति में है',
    cancelled: 'रद्द किया गया',
    
    // Tournament Details
    details: 'विवरण',
    schedule: 'समय-सारणी',
    bracket: 'ब्रैकेट',
    standings: 'स्थान',
    rules: 'नियम',
    prizes: 'पुरस्कार',
    
    // Tournament Fields
    name: 'टूर्नामेंट का नाम',
    description: 'विवरण',
    date: 'दिनांक',
    time: 'समय',
    location: 'स्थान',
    entryFee: 'प्रवेश शुल्क',
    maxPlayers: 'अधिकतम खिलाड़ी',
    registeredPlayers: 'पंजीकृत खिलाड़ी',
    prizePool: 'पुरस्कार राशि',
    
    // Formats
    singleElimination: 'सिंगल एलिमिनेशन',
    doubleElimination: 'डबल एलिमिनेशन',
    roundRobin: 'राउंड रॉबिन',
    swiss: 'स्विस',
    
    // Scopes
    city: 'शहर',
    district: 'जिला',
    state: 'राज्य',
    national: 'राष्ट्रीय',
    
    // Status Messages
    successfullyRegistered: 'पंजीकरण सफल!',
    registrationFailed: 'पंजीकरण विफल',
    tournamentFull: 'टूर्नामेंट भर गया है',
    alreadyRegistered: 'आप पहले से पंजीकृत हैं',
    deadlinePassed: 'पंजीकरण समय समाप्त',
  },

  // Matches
  matches: {
    title: 'मैच',
    live: 'लाइव',
    upcoming: 'आगामी',
    completed: 'पूर्ण',
    postponed: 'स्थगित',
    cancelled: 'रद्द',
    
    vs: 'बनाम',
    score: 'स्कोर',
    winner: 'विजेता',
    loser: 'हारने वाला',
    draw: 'ड्रॉ',
    
    round: 'राउंड',
    roundNumber: 'राउंड {number}',
    matchNumber: 'मैच {number}',
    
    // Score Entry
    enterScore: 'स्कोर दर्ज करें',
    submitScore: 'स्कोर जमा करें',
    scoreSubmitted: 'स्कोर जमा किया गया',
    scoreUpdated: 'स्कोर अपडेट किया गया',
    
    // Outcomes
    win: 'जीत',
    loss: 'हार',
    bye: 'बाई',
    walkover: 'वॉकओवर',
    forfeit: 'फॉरफेट',
    disputed: 'विवादित',
  },

  // Leaderboard
  leaderboard: {
    title: 'लीडरबोर्ड',
    rank: 'रैंक',
    player: 'खिलाड़ी',
    points: 'अंक',
    elo: 'ELO',
    wins: 'जीत',
    losses: 'हार',
    matches: 'मैच',
    winRate: 'जीत दर',
    
    topPlayers: 'शीर्ष खिलाड़ी',
    yourRank: 'आपकी रैंक',
    notRanked: 'रैंक नहीं',
  },

  // Profile
  profile: {
    title: 'प्रोफ़ाइल',
    edit: 'प्रोफ़ाइल संपादित करें',
    view: 'प्रोफ़ाइल देखें',
    
    // Fields
    firstName: 'पहला नाम',
    lastName: 'अंतिम नाम',
    email: 'ईमेल',
    phone: 'फ़ोन',
    city: 'शहर',
    state: 'राज्य',
    bio: 'परिचय',
    avatar: 'प्रोफ़ाइल चित्र',
    
    // Stats
    stats: 'आंकड़े',
    careerStats: 'करियर आंकड़े',
    matchHistory: 'मैच इतिहास',
    
    // Tiers
    tier: 'स्तर',
    bronze: 'कांस्य',
    silver: 'रजत',
    gold: 'स्वर्ण',
    platinum: 'प्लेटिनम',
    diamond: 'हीरा',
    unranked: 'अरैंक्ड',
  },

  // Teams
  teams: {
    title: 'टीमें',
    create: 'टीम बनाएं',
    join: 'टीम में शामिल हों',
    leave: 'टीम छोड़ें',
    myTeams: 'मेरी टीमें',
    
    // Team Details
    teamName: 'टीम का नाम',
    captain: 'कप्तान',
    members: 'सदस्य',
    addMember: 'सदस्य जोड़ें',
    removeMember: 'सदस्य हटाएं',
    
    // Formats
    doubles: 'डबल्स',
    team: 'टीम',
    
    // Invitations
    invitations: 'आमंत्रण',
    invitePlayer: 'खिलाड़ी को आमंत्रित करें',
    acceptInvite: 'आमंत्रण स्वीकार करें',
    declineInvite: 'आमंत्रण अस्वीकार करें',
    inviteExpired: 'आमंत्रण समाप्त',
    inviteAccepted: 'आमंत्रण स्वीकृत',
    
    // Stats
    teamElo: 'टीम ELO',
    teamWins: 'टीम जीत',
    teamLosses: 'टीम हार',
  },

  // Settings
  settings: {
    title: 'सेटिंग्स',
    account: 'खाता',
    privacy: 'गोपनीयता',
    notifications: 'सूचनाएं',
    language: 'भाषा',
    theme: 'थीम',
    
    // Language
    selectLanguage: 'भाषा चुनें',
    languageChanged: 'भाषा बदल दी गई',
    
    // Privacy
    profileVisibility: 'प्रोफ़ाइल दृश्यता',
    showOnLeaderboard: 'लीडरबोर्ड पर दिखाएं',
    allowMessages: 'संदेशों की अनुमति दें',
    
    // Notifications
    emailNotifications: 'ईमेल सूचनाएं',
    pushNotifications: 'पुश सूचनाएं',
    matchReminders: 'मैच रिमाइंडर',
    tournamentUpdates: 'टूर्नामेंट अपडेट',
  },

  // Analytics
  analytics: {
    title: 'विश्लेषण',
    overview: 'अवलोकन',
    performance: 'प्रदर्शन',
    trends: 'रुझान',
    
    // Charts
    winRateTrend: 'जीत दर का रुझान',
    eloHistory: 'ELO इतिहास',
    performanceByScope: 'दायरे के अनुसार प्रदर्शन',
    
    // Metrics
    avgMatchDuration: 'औसत मैच अवधि',
    avgScore: 'औसत स्कोर',
    highestElo: 'उच्चतम ELO',
    lowestElo: 'न्यूनतम ELO',
    
    // Form
    recentForm: 'हाल का फॉर्म',
    formIndicator: 'फॉर्म संकेतक',
    currentStreak: 'वर्तमान सीरीज़',
  },

  // Prize Pool
  prizes: {
    title: 'पुरस्कार',
    prizePool: 'पुरस्कार राशि',
    distribution: 'वितरण',
    payouts: 'भुगतान',
    
    // Distribution
    firstPlace: 'प्रथम स्थान',
    secondPlace: 'द्वितीय स्थान',
    thirdPlace: 'तृतीय स्थान',
    
    // Status
    pending: 'लंबित',
    paid: 'भुगतान किया गया',
    unpaid: 'अवैतनिक',
    
    // Actions
    markAsPaid: 'भुगतान किया गया चिह्नित करें',
    generateInvoice: 'चालान बनाएं',
    exportCsv: 'CSV निर्यात करें',
  },

  // Errors
  errors: {
    genericError: 'कुछ गलत हो गया। पुनः प्रयास करें।',
    networkError: 'नेटवर्क त्रुटि। अपना कनेक्शन जांचें।',
    notFound: 'नहीं मिला',
    unauthorized: 'अनधिकृत',
    forbidden: 'निषिद्ध',
    validationError: 'सत्यापन त्रुटि',
    serverError: 'सर्वर त्रुटि',
    
    // Validation
    required: 'यह फ़ील्ड आवश्यक है',
    invalidEmail: 'अमान्य ईमेल प्रारूप',
    invalidPhone: 'अमान्य फ़ोन नंबर प्रारूप',
    tooShort: 'बहुत छोटा',
    tooLong: 'बहुत लंबा',
  },

  // Success Messages
  success: {
    saved: 'सफलतापूर्वक सहेजा गया',
    updated: 'सफलतापूर्वक अपडेट किया गया',
    deleted: 'सफलतापूर्वक हटाया गया',
    created: 'सफलतापूर्वक बनाया गया',
    sent: 'सफलतापूर्वक भेजा गया',
  },

  // Validation Messages
  validation: {
    required: 'यह फ़ील्ड आवश्यक है',
    minLength: 'कम से कम {min} अक्षर होने चाहिए',
    maxLength: 'अधिकतम {max} अक्षर हो सकते हैं',
    pattern: 'अमान्य प्रारूप',
    email: 'अमान्य ईमेल पता',
    phone: 'अमान्य फ़ोन नंबर',
    url: 'अमान्य URL',
    number: 'केवल संख्या की अनुमति है',
    positive: 'सकारात्मक संख्या आवश्यक है',
  },
} as const;

export type TranslationKey = keyof typeof hiTranslations;
export default hiTranslations;
