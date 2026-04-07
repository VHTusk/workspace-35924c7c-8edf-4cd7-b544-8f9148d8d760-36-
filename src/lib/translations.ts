/**
 * VALORHIVE Translations
 * 
 * Hindi + Regional Language Support for India
 * Languages: Hindi (hi), Tamil (ta), Telugu (te), Marathi (mr), Kannada (kn)
 */

// ============================================
// Type Definitions
// ============================================

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'mr' | 'kn';

export interface TranslationStrings {
  [key: string]: string | TranslationStrings;
}

// ============================================
// English Translations (Base)
// ============================================

export const en: TranslationStrings = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    tournaments: 'Tournaments',
    leaderboard: 'Leaderboard',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    messages: 'Messages',
    notifications: 'Notifications',
    store: 'Store',
  },
  
  // Landing Page
  landing: {
    heroTitle: 'India\'s Premier Tournament Platform',
    heroSubtitle: 'Compete. Track. Win.',
    ctaGetStarted: 'Get Started',
    ctaLearnMore: 'Learn More',
    sportSelectTitle: 'Choose Your Sport',
    featuredTournaments: 'Featured Tournaments',
    topPlayers: 'Top Players',
  },
  
  // Authentication
  auth: {
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Sign in to continue',
    registerTitle: 'Create Account',
    registerSubtitle: 'Join thousands of players',
    emailPlaceholder: 'Email Address',
    phonePlaceholder: 'Phone Number',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    noAccount: 'Don\'t have an account?',
    hasAccount: 'Already have an account?',
    signInWithGoogle: 'Sign in with Google',
    signInWithWhatsApp: 'Sign in with WhatsApp',
    orContinueWith: 'Or continue with',
    otpSent: 'OTP sent to your phone',
    verifyOTP: 'Verify OTP',
    resendOTP: 'Resend OTP',
  },
  
  // Dashboard
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome back',
    upcomingMatches: 'Upcoming Matches',
    recentResults: 'Recent Results',
    myTournaments: 'My Tournaments',
    stats: 'My Stats',
    quickActions: 'Quick Actions',
    registerTournament: 'Register for Tournament',
    viewLeaderboard: 'View Leaderboard',
    findPlayers: 'Find Players',
  },
  
  // Tournaments
  tournaments: {
    title: 'Tournaments',
    upcoming: 'Upcoming',
    live: 'Live',
    completed: 'Completed',
    myTournaments: 'My Tournaments',
    register: 'Register',
    withdraw: 'Withdraw',
    viewBracket: 'View Bracket',
    viewDetails: 'View Details',
    registrationOpen: 'Registration Open',
    registrationClosed: 'Registration Closed',
    spotsRemaining: 'spots remaining',
    prizePool: 'Prize Pool',
    entryFee: 'Entry Fee',
    startDate: 'Start Date',
    endDate: 'End Date',
    location: 'Location',
    format: 'Format',
    maxPlayers: 'Max Players',
    registered: 'Registered',
    waitlist: 'Waitlist',
  },
  
  // Leaderboard
  leaderboard: {
    title: 'Leaderboard',
    rank: 'Rank',
    player: 'Player',
    points: 'Points',
    matches: 'Matches',
    winRate: 'Win Rate',
    tier: 'Tier',
    national: 'National',
    state: 'State',
    district: 'District',
    city: 'City',
  },
  
  // Tiers
  tiers: {
    unranked: 'Unranked',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
  },
  
  // Profile
  profile: {
    title: 'Profile',
    editProfile: 'Edit Profile',
    viewProfile: 'View Profile',
    basicInfo: 'Basic Information',
    contactInfo: 'Contact Information',
    playingHistory: 'Playing History',
    achievements: 'Achievements',
    shareProfile: 'Share Profile',
    completeness: 'Profile Completeness',
    completeProfile: 'Complete your profile',
  },
  
  // Payments
  payments: {
    title: 'Payments',
    subscribe: 'Subscribe',
    subscription: 'Subscription',
    yearlyPlan: 'Yearly Plan',
    monthlyPlan: 'Monthly Plan',
    saveWithYearly: 'Save with yearly plan',
    popular: 'Popular',
    perYear: '/year',
    perMonth: '/month',
    payWithUPI: 'Pay with UPI',
    payWithCard: 'Pay with Card',
    payWithWallet: 'Pay with Wallet',
    upiId: 'UPI ID',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'Secure Payment',
    paymentSuccessful: 'Payment Successful',
    paymentFailed: 'Payment Failed',
  },
  
  // Notifications
  notifications: {
    title: 'Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',
    tournamentReminder: 'Tournament Reminder',
    matchStarting: 'Match Starting',
    resultPosted: 'Result Posted',
    newMessage: 'New Message',
    rosterInvite: 'Roster Invitation',
  },
  
  // Common
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    noResults: 'No results found',
    viewAll: 'View All',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    confirm: 'Confirm',
    close: 'Close',
    continue: 'Continue',
    skip: 'Skip',
    retry: 'Retry',
    refresh: 'Refresh',
    clear: 'Clear',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    copy: 'Copy',
    share: 'Share',
    download: 'Download',
    upload: 'Upload',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    required: 'Required',
    optional: 'Optional',
  },
  
  // Auth Extended
  authExtended: {
    playerTab: 'Player',
    organizationTab: 'Organization',
    signInWithEmail: 'Sign in with Email',
    signInWithPhone: 'Sign in with Phone',
    createPlayerAccount: 'Create Player Account',
    createOrgAccount: 'Create Organization Account',
    firstName: 'First Name',
    lastName: 'Last Name',
    fullName: 'Full Name',
    organizationName: 'Organization Name',
    city: 'City',
    state: 'State',
    dateOfBirth: 'Date of Birth',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    termsAgree: 'I agree to the Terms and Conditions',
    privacyAgree: 'I agree to the Privacy Policy',
    rememberMe: 'Remember me',
    accountLocked: 'Account locked. Please try again later.',
    invalidCredentials: 'Invalid email or password',
    emailSent: 'Verification email sent',
    passwordReset: 'Password reset link sent',
    otpVerified: 'OTP verified successfully',
    registering: 'Creating your account...',
    signingIn: 'Signing in...',
  },
  
  // Dashboard Extended
  dashboardExtended: {
    overview: 'Overview',
    activity: 'Activity',
    performance: 'Performance',
    recentActivity: 'Recent Activity',
    noUpcomingMatches: 'No upcoming matches',
    noRecentResults: 'No recent results',
    noTournaments: 'No tournaments yet',
    wins: 'Wins',
    losses: 'Losses',
    draws: 'Draws',
    totalMatches: 'Total Matches',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    rating: 'Rating',
    ranking: 'Ranking',
    pointsEarned: 'Points Earned',
    tournamentsPlayed: 'Tournaments Played',
    tournamentsWon: 'Tournaments Won',
    winPercentage: 'Win Percentage',
    averageScore: 'Average Score',
    lastMatch: 'Last Match',
    nextMatch: 'Next Match',
    viewFullStats: 'View Full Stats',
    editProfile: 'Edit Profile',
  },
  
  // Tournament Status
  tournamentStatus: {
    draft: 'Draft',
    registrationOpen: 'Registration Open',
    registrationClosed: 'Registration Closed',
    inProgress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    postponed: 'Postponed',
    pendingApproval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    published: 'Published',
    live: 'Live',
    full: 'Full',
    waitlistOpen: 'Waitlist Open',
  },
  
  // Tournament Types
  tournamentTypes: {
    singles: 'Singles',
    doubles: 'Doubles',
    team: 'Team',
    open: 'Open',
    rated: 'Rated',
    casual: 'Casual',
    interOrg: 'Inter-Organization',
    intraOrg: 'Intra-Organization',
    championship: 'Championship',
    league: 'League',
    knockout: 'Knockout',
    roundRobin: 'Round Robin',
  },
  
  // Sports
  sports: {
    cornhole: 'Cornhole',
    darts: 'Darts',
    all: 'All Sports',
  },
  
  // Errors
  errors: {
    generic: 'Something went wrong',
    notFound: 'Not found',
    unauthorized: 'Unauthorized access',
    networkError: 'Network error. Please check your connection.',
    validationError: 'Please check your input.',
  },
};

// ============================================
// Hindi Translations (हिन्दी)
// ============================================

export const hi: TranslationStrings = {
  // Navigation
  nav: {
    dashboard: 'डैशबोर्ड',
    tournaments: 'टूर्नामेंट',
    leaderboard: 'लीडरबोर्ड',
    profile: 'प्रोफ़ाइल',
    settings: 'सेटिंग्स',
    logout: 'लॉग आउट',
    login: 'लॉग इन',
    register: 'रजिस्टर',
    messages: 'संदेश',
    notifications: 'सूचनाएं',
    store: 'स्टोर',
  },
  
  // Landing Page
  landing: {
    heroTitle: 'भारत का प्रीमियम टूर्नामेंट प्लेटफ़ॉर्म',
    heroSubtitle: 'प्रतिस्पर्धा करें। ट्रैक करें। जीतें।',
    ctaGetStarted: 'शुरू करें',
    ctaLearnMore: 'और जानें',
    sportSelectTitle: 'अपना खेल चुनें',
    featuredTournaments: 'विशेष टूर्नामेंट',
    topPlayers: 'शीर्ष खिलाड़ी',
  },
  
  // Authentication
  auth: {
    loginTitle: 'वापसी पर स्वागत है',
    loginSubtitle: 'जारी रखने के लिए साइन इन करें',
    registerTitle: 'खाता बनाएं',
    registerSubtitle: 'हजारों खिलाड़ियों से जुड़ें',
    emailPlaceholder: 'ईमेल पता',
    phonePlaceholder: 'फ़ोन नंबर',
    passwordPlaceholder: 'पासवर्ड',
    confirmPasswordPlaceholder: 'पासवर्ड की पुष्टि करें',
    forgotPassword: 'पासवर्ड भूल गए?',
    noAccount: 'खाता नहीं है?',
    hasAccount: 'पहले से खाता है?',
    signInWithGoogle: 'Google से साइन इन करें',
    signInWithWhatsApp: 'WhatsApp से साइन इन करें',
    orContinueWith: 'या इससे जारी रखें',
    otpSent: 'आपके फ़ोन पर OTP भेजा गया',
    verifyOTP: 'OTP सत्यापित करें',
    resendOTP: 'OTP पुनः भेजें',
  },
  
  // Dashboard
  dashboard: {
    title: 'डैशबोर्ड',
    welcome: 'वापसी पर स्वागत है',
    upcomingMatches: 'आगामी मैच',
    recentResults: 'हाल के परिणाम',
    myTournaments: 'मेरे टूर्नामेंट',
    stats: 'मेरे आंकड़े',
    quickActions: 'त्वरित कार्य',
    registerTournament: 'टूर्नामेंट के लिए रजिस्टर करें',
    viewLeaderboard: 'लीडरबोर्ड देखें',
    findPlayers: 'खिलाड़ी खोजें',
  },
  
  // Tournaments
  tournaments: {
    title: 'टूर्नामेंट',
    upcoming: 'आगामी',
    live: 'लाइव',
    completed: 'समाप्त',
    myTournaments: 'मेरे टूर्नामेंट',
    register: 'रजिस्टर',
    withdraw: 'वापस लें',
    viewBracket: 'ब्रैकेट देखें',
    viewDetails: 'विवरण देखें',
    registrationOpen: 'पंजीकरण खुला है',
    registrationClosed: 'पंजीकरण बंद',
    spotsRemaining: 'स्थान शेष',
    prizePool: 'पुरस्कार राशि',
    entryFee: 'प्रवेश शुल्क',
    startDate: 'प्रारंभ तिथि',
    endDate: 'समाप्ति तिथि',
    location: 'स्थान',
    format: 'प्रारूप',
    maxPlayers: 'अधिकतम खिलाड़ी',
    registered: 'पंजीकृत',
    waitlist: 'प्रतीक्षा सूची',
  },
  
  // Leaderboard
  leaderboard: {
    title: 'लीडरबोर्ड',
    rank: 'रैंक',
    player: 'खिलाड़ी',
    points: 'अंक',
    matches: 'मैच',
    winRate: 'जीत दर',
    tier: 'स्तर',
    national: 'राष्ट्रीय',
    state: 'राज्य',
    district: 'जिला',
    city: 'शहर',
  },
  
  // Tiers
  tiers: {
    unranked: 'अरैंकड',
    bronze: 'कांस्य',
    silver: 'रजत',
    gold: 'स्वर्ण',
    platinum: 'प्लैटिनम',
    diamond: 'हीरा',
  },
  
  // Profile
  profile: {
    title: 'प्रोफ़ाइल',
    editProfile: 'प्रोफ़ाइल संपादित करें',
    viewProfile: 'प्रोफ़ाइल देखें',
    basicInfo: 'मूल जानकारी',
    contactInfo: 'संपर्क जानकारी',
    playingHistory: 'खेल इतिहास',
    achievements: 'उपलब्धियां',
    shareProfile: 'प्रोफ़ाइल साझा करें',
    completeness: 'प्रोफ़ाइल पूर्णता',
    completeProfile: 'अपनी प्रोफ़ाइल पूर्ण करें',
  },
  
  // Payments
  payments: {
    title: 'भुगतान',
    subscribe: 'सदस्यता लें',
    subscription: 'सदस्यता',
    yearlyPlan: 'वार्षिक योजना',
    monthlyPlan: 'मासिक योजना',
    saveWithYearly: 'वार्षिक योजना से बचत करें',
    popular: 'लोकप्रिय',
    perYear: '/वर्ष',
    perMonth: '/माह',
    payWithUPI: 'UPI से भुगतान करें',
    payWithCard: 'कार्ड से भुगतान करें',
    payWithWallet: 'वॉलेट से भुगतान करें',
    upiId: 'UPI आईडी',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'सुरक्षित भुगतान',
    paymentSuccessful: 'भुगतान सफल',
    paymentFailed: 'भुगतान विफल',
  },
  
  // Notifications
  notifications: {
    title: 'सूचनाएं',
    markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
    noNotifications: 'कोई सूचना नहीं',
    tournamentReminder: 'टूर्नामेंट अनुस्मारक',
    matchStarting: 'मैच शुरू हो रहा है',
    resultPosted: 'परिणाम पोस्ट किया गया',
    newMessage: 'नया संदेश',
    rosterInvite: 'रोस्टर निमंत्रण',
  },
  
  // Common
  common: {
    loading: 'लोड हो रहा है...',
    error: 'त्रुटि',
    success: 'सफल',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    add: 'जोड़ें',
    remove: 'हटाएं',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    sort: 'क्रमबद्ध',
    noResults: 'कोई परिणाम नहीं मिला',
    viewAll: 'सभी देखें',
    back: 'वापस',
    next: 'आगे',
    previous: 'पिछला',
    submit: 'जमा करें',
    confirm: 'पुष्टि करें',
    close: 'बंद करें',
    continue: 'जारी रखें',
    skip: 'छोड़ें',
    retry: 'पुनः प्रयास करें',
    refresh: 'रिफ्रेश करें',
    clear: 'साफ़ करें',
    selectAll: 'सभी का चयन करें',
    deselectAll: 'सभी को अचयनित करें',
    copy: 'कॉपी करें',
    share: 'साझा करें',
    download: 'डाउनलोड करें',
    upload: 'अपलोड करें',
    yes: 'हाँ',
    no: 'नहीं',
    ok: 'ठीक है',
    required: 'आवश्यक',
    optional: 'वैकल्पिक',
  },
  
  // Auth Extended
  authExtended: {
    playerTab: 'खिलाड़ी',
    organizationTab: 'संगठन',
    signInWithEmail: 'ईमेल से साइन इन करें',
    signInWithPhone: 'फ़ोन से साइन इन करें',
    createPlayerAccount: 'खिलाड़ी खाता बनाएं',
    createOrgAccount: 'संगठन खाता बनाएं',
    firstName: 'पहला नाम',
    lastName: 'अंतिम नाम',
    fullName: 'पूरा नाम',
    organizationName: 'संगठन का नाम',
    city: 'शहर',
    state: 'राज्य',
    dateOfBirth: 'जन्म तिथि',
    gender: 'लिंग',
    male: 'पुरुष',
    female: 'महिला',
    other: 'अन्य',
    termsAgree: 'मुझे नियम और शर्तें स्वीकार हैं',
    privacyAgree: 'मुझे गोपनीयता नीति स्वीकार है',
    rememberMe: 'मुझे याद रखें',
    accountLocked: 'खाता लॉक है। कृपया बाद में पुनः प्रयास करें।',
    invalidCredentials: 'अमान्य ईमेल या पासवर्ड',
    emailSent: 'सत्यापन ईमेल भेजा गया',
    passwordReset: 'पासवर्ड रीसेट लिंक भेजा गया',
    otpVerified: 'OTP सफलतापूर्वक सत्यापित',
    registering: 'आपका खाता बनाया जा रहा है...',
    signingIn: 'साइन इन हो रहा है...',
  },
  
  // Dashboard Extended
  dashboardExtended: {
    overview: 'अवलोकन',
    activity: 'गतिविधि',
    performance: 'प्रदर्शन',
    recentActivity: 'हाल की गतिविधि',
    noUpcomingMatches: 'कोई आगामी मैच नहीं',
    noRecentResults: 'कोई हाल के परिणाम नहीं',
    noTournaments: 'अभी तक कोई टूर्नामेंट नहीं',
    wins: 'जीत',
    losses: 'हार',
    draws: 'ड्रॉ',
    totalMatches: 'कुल मैच',
    currentStreak: 'वर्तमान श्रृंखला',
    bestStreak: 'सर्वश्रेष्ठ श्रृंखला',
    rating: 'रेटिंग',
    ranking: 'रैंकिंग',
    pointsEarned: 'अर्जित अंक',
    tournamentsPlayed: 'खेले गए टूर्नामेंट',
    tournamentsWon: 'जीते गए टूर्नामेंट',
    winPercentage: 'जीत प्रतिशत',
    averageScore: 'औसत स्कोर',
    lastMatch: 'अंतिम मैच',
    nextMatch: 'अगला मैच',
    viewFullStats: 'पूरे आंकड़े देखें',
    editProfile: 'प्रोफ़ाइल संपादित करें',
  },
  
  // Tournament Status
  tournamentStatus: {
    draft: 'प्रारूप',
    registrationOpen: 'पंजीकरण खुला है',
    registrationClosed: 'पंजीकरण बंद',
    inProgress: 'चल रहा है',
    completed: 'पूर्ण',
    cancelled: 'रद्द',
    postponed: 'स्थगित',
    pendingApproval: 'अनुमोदन लंबित',
    approved: 'अनुमोदित',
    rejected: 'अस्वीकृत',
    published: 'प्रकाशित',
    live: 'लाइव',
    full: 'पूर्ण',
    waitlistOpen: 'प्रतीक्षा सूची खुली',
  },
  
  // Tournament Types
  tournamentTypes: {
    singles: 'एकल',
    doubles: 'युगल',
    team: 'टीम',
    open: 'खुला',
    rated: 'रेटेड',
    casual: 'आकस्मिक',
    interOrg: 'अंतर-संगठन',
    intraOrg: 'अंतः-संगठन',
    championship: 'चैंपियनशिप',
    league: 'लीग',
    knockout: 'नॉकआउट',
    roundRobin: 'राउंड रॉबिन',
  },
  
  // Sports
  sports: {
    cornhole: 'कॉर्नहोल',
    darts: 'डार्ट्स',
    all: 'सभी खेल',
  },
  
  // Errors
  errors: {
    generic: 'कुछ गलत हो गया',
    notFound: 'नहीं मिला',
    unauthorized: 'अनधिकृत पहुंच',
    networkError: 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
    validationError: 'कृपया अपना इनपुट जांचें।',
  },
};

// ============================================
// Tamil Translations (தமிழ்)
// ============================================

export const ta: TranslationStrings = {
  nav: {
    dashboard: 'டாஷ்போர்டு',
    tournaments: 'போட்டிகள்',
    leaderboard: 'தலைவர் பலகை',
    profile: 'சுயவிவரம்',
    settings: 'அமைப்புகள்',
    logout: 'வெளியேறு',
    login: 'உள் நுழை',
    register: 'பதிவு',
    messages: 'செய்திகள்',
    notifications: 'அறிவிப்புகள்',
    store: 'கடை',
  },
  
  landing: {
    heroTitle: 'இந்தியாவின் முன்னணி போட்டி தளம்',
    heroSubtitle: 'போட்டியிடு. கண்காணி. வெல்ல.',
    ctaGetStarted: 'தொடங்கு',
    ctaLearnMore: 'மேலும் அறிக',
    sportSelectTitle: 'உங்கள் விளையாட்டைத் தேர்வுசெய்க',
    featuredTournaments: 'சிறப்பு போட்டிகள்',
    topPlayers: 'சிறந்த வீரர்கள்',
  },
  
  auth: {
    loginTitle: 'மீண்டும் வருக',
    loginSubtitle: 'தொடர உள்நுழைக',
    registerTitle: 'கணக்கை உருவாக்கு',
    registerSubtitle: 'ஆயிரக்கணக்கான வீரர்களுடன் இணைக',
    emailPlaceholder: 'மின்னஞ்சல் முகவரி',
    phonePlaceholder: 'தொலைபேசி எண்',
    passwordPlaceholder: 'கடவுச்சொல்',
    confirmPasswordPlaceholder: 'கடவுச்சொல்லை உறுதிப்படுத்து',
    forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?',
    noAccount: 'கணக்கு இல்லையா?',
    hasAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    signInWithGoogle: 'Google மூலம் உள்நுழை',
    signInWithWhatsApp: 'WhatsApp மூலம் உள்நுழை',
    orContinueWith: 'அல்லது இதன் மூலம் தொடரவும்',
    otpSent: 'உங்கள் தொலைபேசிக்கு OTP அனுப்பப்பட்டது',
    verifyOTP: 'OTP சரிபார்க்க',
    resendOTP: 'OTP மீண்டும் அனுப்பு',
  },
  
  tournaments: {
    title: 'போட்டிகள்',
    upcoming: 'வரவிருக்கும்',
    live: 'நேரடி',
    completed: 'முடிந்தது',
    myTournaments: 'எனது போட்டிகள்',
    register: 'பதிவு',
    withdraw: 'விலகு',
    viewBracket: 'பிராக்கெட் காண்க',
    viewDetails: 'விவரங்கள் காண்க',
    registrationOpen: 'பதிவு திறந்துள்ளது',
    registrationClosed: 'பதிவு மூடப்பட்டது',
    spotsRemaining: 'இடங்கள் மீதம்',
    prizePool: 'பரிசு நிதி',
    entryFee: 'நுழைவு கட்டணம்',
    startDate: 'தொடக்க தேதி',
    endDate: 'முடிவு தேதி',
    location: 'இடம்',
    format: 'வடிவம்',
    maxPlayers: 'அதிகபட்ச வீரர்கள்',
    registered: 'பதிவு செய்யப்பட்டது',
    waitlist: 'காத்திருப்பு பட்டியல்',
  },
  
  payments: {
    title: 'கட்டணங்கள்',
    subscribe: 'குழுசேர்',
    subscription: 'சந்தா',
    yearlyPlan: 'ஆண்டு திட்டம்',
    monthlyPlan: 'மாதாந்திர திட்டம்',
    saveWithYearly: 'ஆண்டு திட்டத்துடன் சேமிக்க',
    popular: 'பிரபலம்',
    perYear: '/ஆண்டு',
    perMonth: '/மாதம்',
    payWithUPI: 'UPI மூலம் செலுத்து',
    payWithCard: 'அட்டை மூலம் செலுத்து',
    payWithWallet: 'வாலட் மூலம் செலுத்து',
    upiId: 'UPI ஐடி',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'பாதுகாப்பான கட்டணம்',
    paymentSuccessful: 'கட்டணம் வெற்றி',
    paymentFailed: 'கட்டணம் தோல்வி',
  },
  
  common: {
    loading: 'ஏற்றுகிறது...',
    error: 'பிழை',
    success: 'வெற்றி',
    save: 'சேமி',
    cancel: 'ரத்துசெய்',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    add: 'சேர்',
    remove: 'அகற்று',
    search: 'தேடு',
    filter: 'வடிகட்டு',
    sort: 'வரிசைப்படுத்து',
    noResults: 'முடிவுகள் இல்லை',
    viewAll: 'அனைத்தும் காண்க',
    back: 'பின்னால்',
    next: 'அடுத்து',
    previous: 'முந்தைய',
    submit: 'சமர்ப்பி',
    confirm: 'உறுதிப்படுத்து',
    close: 'மூடு',
  },
  
  tiers: {
    unranked: 'தரவரிசையின்றி',
    bronze: 'வெண்கலம்',
    silver: 'வெள்ளி',
    gold: 'தங்கம்',
    platinum: 'பிளாட்டினம்',
    diamond: 'வைரம்',
  },
  
  errors: {
    generic: 'ஏதோ தவறு ஏற்பட்டது',
    notFound: 'கிடைக்கவில்லை',
    unauthorized: 'அங்கீகரிக்கப்படாத அணுகல்',
    networkError: 'நெட்வொர்க் பிழை. உங்கள் இணைப்பை சரிபார்க்கவும்.',
    validationError: 'உங்கள் உள்ளீட்டை சரிபார்க்கவும்.',
  },
};

// ============================================
// Telugu Translations (తెలుగు)
// ============================================

export const te: TranslationStrings = {
  nav: {
    dashboard: 'డాష్‌బోర్డ్',
    tournaments: 'టోర్నమెంట్‌లు',
    leaderboard: 'లీడర్‌బోర్డ్',
    profile: 'ప్రొఫైల్',
    settings: 'సెట్టింగ్‌లు',
    logout: 'లాగ్ అవుట్',
    login: 'లాగిన్',
    register: 'నమోదు',
    messages: 'సందేశాలు',
    notifications: 'నోటిఫికేషన్‌లు',
    store: 'స్టోర్',
  },
  
  landing: {
    heroTitle: 'భారతదేశపు ప్రీమియం టోర్నమెంట్ ప్లాట్‌ఫారమ్',
    heroSubtitle: 'పోటీపడండి. ట్రాక్ చేయండి. గెలవండి.',
    ctaGetStarted: 'ప్రారంభించండి',
    ctaLearnMore: 'మరింత తెలుసుకోండి',
    sportSelectTitle: 'మీ క్రీడను ఎంచుకోండి',
    featuredTournaments: 'ప్రత్యేక టోర్నమెంట్‌లు',
    topPlayers: 'టాప్ ప్లేయర్లు',
  },
  
  tournaments: {
    title: 'టోర్నమెంట్‌లు',
    upcoming: 'రాబోయే',
    live: 'లైవ్',
    completed: 'పూర్తయింది',
    myTournaments: 'నా టోర్నమెంట్‌లు',
    register: 'నమోదు',
    withdraw: 'వైదొలగండి',
    viewBracket: 'బ్రాకెట్ చూడండి',
    viewDetails: 'వివరాలు చూడండి',
    registrationOpen: 'నమోదు తెరిచి ఉంది',
    registrationClosed: 'నమోదు మూసివేయబడింది',
    spotsRemaining: 'స్థానాలు మిగిలి ఉన్నాయి',
    prizePool: 'బహుమతి నిధి',
    entryFee: 'ప్రవేశ రుసుము',
    startDate: 'ప్రారంభ తేదీ',
    endDate: 'ముగింపు తేదీ',
    location: 'స్థానం',
    format: 'ఫార్మాట్',
    maxPlayers: 'గరిష్ట ఆటగాళ్లు',
    registered: 'నమోదు చేయబడింది',
    waitlist: 'వెయిట్‌లిస్ట్',
  },
  
  payments: {
    title: 'చెల్లింపులు',
    subscribe: 'సబ్‌స్క్రయిబ్',
    subscription: 'సబ్‌స్క్రిప్షన్',
    yearlyPlan: 'వార్షిక ప్లాన్',
    monthlyPlan: 'నెలవారీ ప్లాన్',
    saveWithYearly: 'వార్షిక ప్లాన్‌తో ఆదా చేయండి',
    popular: 'ప్రముఖమైనది',
    perYear: '/సంవత్సరం',
    perMonth: '/నెల',
    payWithUPI: 'UPI తో చెల్లించండి',
    payWithCard: 'కార్డ్ తో చెల్లించండి',
    payWithWallet: 'వాలెట్ తో చెల్లించండి',
    upiId: 'UPI ఐడి',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'సురక్షిత చెల్లింపు',
    paymentSuccessful: 'చెల్లింపు విజయవంతం',
    paymentFailed: 'చెల్లింపు విఫలమైంది',
  },
  
  common: {
    loading: 'లోడ్ అవుతోంది...',
    error: 'లోపం',
    success: 'విజయం',
    save: 'సేవ్',
    cancel: 'రద్దు',
    delete: 'తొలగించు',
    edit: 'ఎడిట్',
    add: 'యాడ్',
    remove: 'తొలగించు',
    search: 'సెర్చ్',
    filter: 'ఫిల్టర్',
    sort: 'సార్ట్',
    noResults: 'ఫలితాలు లేవు',
    viewAll: 'అన్నీ చూడండి',
    back: 'వెనుకకు',
    next: 'తదుపరి',
    previous: 'మునుపటి',
    submit: 'సబ్మిట్',
    confirm: 'నిర్ధారించు',
    close: 'క్లోజ్',
  },
  
  tiers: {
    unranked: 'ర్యాంక్ లేదు',
    bronze: 'కాంస్య',
    silver: 'రజత',
    gold: 'బంగారు',
    platinum: 'ప్లాటినమ్',
    diamond: 'వజ్రం',
  },
  
  errors: {
    generic: 'ఏదో తప్పు జరిగింది',
    notFound: 'కనుగొనబడలేదు',
    unauthorized: 'అనధికార యాక్సెస్',
    networkError: 'నెట్‌వర్క్ లోపం. దయచేసి మీ కనెక్షన్‌ను తనిఖీ చేయండి.',
    validationError: 'దయచేసి మీ ఇన్‌పుట్‌ను తనిఖీ చేయండి.',
  },
};

// ============================================
// Marathi Translations (मराठी)
// ============================================

export const mr: TranslationStrings = {
  nav: {
    dashboard: 'डॅशबोर्ड',
    tournaments: 'स्पर्धा',
    leaderboard: 'लीडरबोर्ड',
    profile: 'प्रोफाइल',
    settings: 'सेटिंग्ज',
    logout: 'लॉगआउट',
    login: 'लॉगिन',
    register: 'नोंदणी',
    messages: 'संदेश',
    notifications: 'सूचना',
    store: 'स्टोअर',
  },
  
  landing: {
    heroTitle: 'भारताचा प्रीमियम स्पर्धा प्लॅटफॉर्म',
    heroSubtitle: 'स्पर्धा करा. ट्रॅक करा. जिंका.',
    ctaGetStarted: 'सुरू करा',
    ctaLearnMore: 'अधिक जाणून घ्या',
    sportSelectTitle: 'तुमचा खेळ निवडा',
    featuredTournaments: 'वैशिष्ट्यीकृत स्पर्धा',
    topPlayers: 'सर्वोत्कृष्ट खेळाडू',
  },
  
  tournaments: {
    title: 'स्पर्धा',
    upcoming: 'आगामी',
    live: 'थेट',
    completed: 'पूर्ण झालेल्या',
    myTournaments: 'माझ्या स्पर्धा',
    register: 'नोंदणी',
    withdraw: 'मागे घ्या',
    viewBracket: 'ब्रॅकेट पहा',
    viewDetails: 'तपशील पहा',
    registrationOpen: 'नोंदणी उघडी आहे',
    registrationClosed: 'नोंदणी बंद',
    spotsRemaining: 'जागा शिल्लक',
    prizePool: 'बक्षीस रक्कम',
    entryFee: 'प्रवेश शुल्क',
    startDate: 'सुरुवातीची तारीख',
    endDate: 'समाप्तीची तारीख',
    location: 'स्थान',
    format: 'स्वरूप',
    maxPlayers: 'कमाल खेळाडू',
    registered: 'नोंदणीकृत',
    waitlist: 'वेटिंग लिस्ट',
  },
  
  payments: {
    title: 'देयके',
    subscribe: 'सबस्क्राइब',
    subscription: 'सदस्यता',
    yearlyPlan: 'वार्षिक योजना',
    monthlyPlan: 'मासिक योजना',
    saveWithYearly: 'वार्षिक योजनेत बचत करा',
    popular: 'लोकप्रिय',
    perYear: '/वर्ष',
    perMonth: '/महिना',
    payWithUPI: 'UPI द्वारे देय करा',
    payWithCard: 'कार्ड द्वारे देय करा',
    payWithWallet: 'वॉलेट द्वारे देय करा',
    upiId: 'UPI आयडी',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'सुरक्षित देय',
    paymentSuccessful: 'देय यशस्वी',
    paymentFailed: 'देय अयशस्वी',
  },
  
  common: {
    loading: 'लोड होत आहे...',
    error: 'त्रुटी',
    success: 'यशस्वी',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    delete: 'हटवा',
    edit: 'संपादन',
    add: 'जोडा',
    remove: 'काढा',
    search: 'शोधा',
    filter: 'फिल्टर',
    sort: 'क्रमवारी',
    noResults: 'परिणाम सापडले नाहीत',
    viewAll: 'सर्व पहा',
    back: 'मागे',
    next: 'पुढे',
    previous: 'मागील',
    submit: 'सबमिट',
    confirm: 'पुष्टी करा',
    close: 'बंद करा',
  },
  
  tiers: {
    unranked: 'क्रमांकहीन',
    bronze: 'कांस्य',
    silver: 'रजत',
    gold: 'सोने',
    platinum: 'प्लॅटिनम',
    diamond: 'हिरा',
  },
  
  errors: {
    generic: 'काहीतरी चूक झाली',
    notFound: 'सापडले नाही',
    unauthorized: 'अनधिकृत प्रवेश',
    networkError: 'नेटवर्क त्रुटी. कृपया तुमचे कनेक्शन तपासा.',
    validationError: 'कृपया तुमचा इनपुट तपासा.',
  },
};

// ============================================
// Kannada Translations (ಕನ್ನಡ)
// ============================================

export const kn: TranslationStrings = {
  nav: {
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    tournaments: 'ಪಂದ್ಯಾವಳಿಗಳು',
    leaderboard: 'ಲೀಡರ್‌ಬೋರ್ಡ್',
    profile: 'ಪ್ರೊಫೈಲ್',
    settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    logout: 'ಲಾಗ್ ಔಟ್',
    login: 'ಲಾಗಿನ್',
    register: 'ನೋಂದಣಿ',
    messages: 'ಸಂದೇಶಗಳು',
    notifications: 'ಅಧಿಸೂಚನೆಗಳು',
    store: 'ಸ್ಟೋರ್',
  },
  
  landing: {
    heroTitle: 'ಭಾರತದ ಪ್ರೀಮಿಯಂ ಪಂದ್ಯಾವಳಿ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್',
    heroSubtitle: 'ಸ್ಪರ್ಧಿಸಿ. ಟ್ರ್ಯಾಕ್ ಮಾಡಿ. ಗೆಲ್ಲಿ.',
    ctaGetStarted: 'ಪ್ರಾರಂಭಿಸಿ',
    ctaLearnMore: 'ಇನ್ನಷ್ಟು ತಿಳಿಯಿರಿ',
    sportSelectTitle: 'ನಿಮ್ಮ ಕ್ರೀಡೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    featuredTournaments: 'ವಿಶೇಷ ಪಂದ್ಯಾವಳಿಗಳು',
    topPlayers: 'ಅಗ್ರ ಆಟಗಾರರು',
  },
  
  tournaments: {
    title: 'ಪಂದ್ಯಾವಳಿಗಳು',
    upcoming: 'ಮುಂಬರುವ',
    live: 'ಲೈವ್',
    completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    myTournaments: 'ನನ್ನ ಪಂದ್ಯಾವಳಿಗಳು',
    register: 'ನೋಂದಣಿ',
    withdraw: 'ಹಿಂದೆ ತೆಗೆದುಕೊಳ್ಳಿ',
    viewBracket: 'ಬ್ರಾಕೆಟ್ ವೀಕ್ಷಿಸಿ',
    viewDetails: 'ವಿವರಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
    registrationOpen: 'ನೋಂದಣಿ ತೆರೆದಿದೆ',
    registrationClosed: 'ನೋಂದಣಿ ಮುಚ್ಚಿದೆ',
    spotsRemaining: 'ಸ್ಥಾನಗಳು ಉಳಿದಿವೆ',
    prizePool: 'ಬಹುಮಾನ ಮೊತ್ತ',
    entryFee: 'ಪ್ರವೇಶ ಶುಲ್ಕ',
    startDate: 'ಪ್ರಾರಂಭ ದಿನಾಂಕ',
    endDate: 'ಅಂತಿಮ ದಿನಾಂಕ',
    location: 'ಸ್ಥಳ',
    format: 'ಸ್ವರೂಪ',
    maxPlayers: 'ಗರಿಷ್ಠ ಆಟಗಾರರು',
    registered: 'ನೋಂದಾಯಿತ',
    waitlist: 'ನಿರೀಕ್ಷೆ ಪಟ್ಟಿ',
  },
  
  payments: {
    title: 'ಪಾವತಿಗಳು',
    subscribe: 'ಚಂದಾದಾರರಾಗಿ',
    subscription: 'ಚಂದಾ',
    yearlyPlan: 'ವಾರ್ಷಿಕ ಯೋಜನೆ',
    monthlyPlan: 'ಮಾಸಿಕ ಯೋಜನೆ',
    saveWithYearly: 'ವಾರ್ಷಿಕ ಯೋಜನೆಯೊಂದಿಗೆ ಉಳಿಸಿ',
    popular: 'ಜನಪ್ರಿಯ',
    perYear: '/ವರ್ಷ',
    perMonth: '/ತಿಂಗಳು',
    payWithUPI: 'UPI ಮೂಲಕ ಪಾವತಿಸಿ',
    payWithCard: 'ಕಾರ್ಡ್ ಮೂಲಕ ಪಾವತಿಸಿ',
    payWithWallet: 'ವಾಲೆಟ್ ಮೂಲಕ ಪಾವತಿಸಿ',
    upiId: 'UPI ಐಡಿ',
    googlePay: 'Google Pay',
    phonePe: 'PhonePe',
    paytm: 'Paytm',
    securePayment: 'ಸುರಕ್ಷಿತ ಪಾವತಿ',
    paymentSuccessful: 'ಪಾವತಿ ಯಶಸ್ವಿ',
    paymentFailed: 'ಪಾವತಿ ವಿಫಲ',
  },
  
  common: {
    loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    error: 'ದೋಷ',
    success: 'ಯಶಸ್ಸು',
    save: 'ಉಳಿಸಿ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    delete: 'ಅಳಿಸಿ',
    edit: 'ಸಂಪಾದಿಸಿ',
    add: 'ಸೇರಿಸಿ',
    remove: 'ತೆಗೆದುಹಾಕಿ',
    search: 'ಹುಡುಕಿ',
    filter: 'ಫಿಲ್ಟರ್',
    sort: 'ವಿಂಗಡಿಸಿ',
    noResults: 'ಫಲಿತಾಂಶಗಳು ಇಲ್ಲ',
    viewAll: 'ಎಲ್ಲವನ್ನೂ ವೀಕ್ಷಿಸಿ',
    back: 'ಹಿಂದೆ',
    next: 'ಮುಂದೆ',
    previous: 'ಹಿಂದಿನ',
    submit: 'ಸಲ್ಲಿಸಿ',
    confirm: 'ದೃಢೀಕರಿಸಿ',
    close: 'ಮುಚ್ಚಿ',
  },
  
  tiers: {
    unranked: 'ಶ್ರೇಣಿ ಇಲ್ಲ',
    bronze: 'ಕಂಚು',
    silver: 'ಬೆಳ್ಳಿ',
    gold: 'ಚಿನ್ನ',
    platinum: 'ಪ್ಲಾಟಿನಮ್',
    diamond: 'ವಜ್ರ',
  },
  
  errors: {
    generic: 'ಏನೋ ತಪ್ಪಾಗಿದೆ',
    notFound: 'ಕಂಡುಬಂದಿಲ್ಲ',
    unauthorized: 'ಅನಧಿಕೃತ ಪ್ರವೇಶ',
    networkError: 'ನೆಟ್‌ವರ್ಕ್ ದೋಷ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ.',
    validationError: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇನ್‌ಪುಟ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.',
  },
};

// ============================================
// Translation Helper Function
// ============================================

const translations: Record<SupportedLanguage, TranslationStrings> = {
  en,
  hi,
  ta,
  te,
  mr,
  kn,
};

/**
 * Get translation for a key in specified language
 * Falls back to English if translation not found
 */
export function t(
  key: string,
  language: SupportedLanguage = 'en',
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  let result: TranslationStrings | string = translations[language] || translations.en;
  
  for (const k of keys) {
    if (typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      // Fallback to English
      result = translations.en;
      for (const fallbackKey of keys) {
        if (typeof result === 'object' && fallbackKey in result) {
          result = result[fallbackKey];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }
  
  if (typeof result !== 'string') {
    return key;
  }
  
  // Interpolate parameters
  if (params) {
    let interpolated = result;
    for (const [paramKey, value] of Object.entries(params)) {
      interpolated = interpolated.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
    }
    return interpolated;
  }
  
  return result;
}

/**
 * Get all translations for a language
 */
export function getTranslations(language: SupportedLanguage): TranslationStrings {
  return translations[language] || translations.en;
}

/**
 * Get available languages
 */
export function getAvailableLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  ];
}

export default translations;
