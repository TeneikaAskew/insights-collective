/**
 * Centralized selector constants derived from actual DOM structure.
 * Update here if element IDs / ARIA roles change in the app.
 */
export const Sel = {
  // ── Login ─────────────────────────────────────────────────────────────────
  login: {
    email: '#email',
    password: '#password',
    submit: 'button[type="submit"]:has-text("Sign In")',
    googleBtn: 'button:has-text("Google")',
    githubBtn: 'button:has-text("GitHub")',
    twitterBtn: 'button:has-text("Twitter")',
    forgotLink: 'a:has-text("Forgot")',
    registerLink: 'a:has-text("Create account"), a:has-text("Sign up"), a:has-text("Register")',
    passwordToggle: 'button[aria-label*="password"], button:near(#password)',
    errorAlert: '[role="alert"]',
  },

  // ── Register ──────────────────────────────────────────────────────────────
  register: {
    name: '#name',
    email: '#email',
    password: '#password',
    confirmPassword: '#confirmPassword',
    submit: 'button[type="submit"]:has-text("Sign Up")',
    googleBtn: 'button:has-text("Google")',
    loginLink: 'a:has-text("Log in"), a:has-text("Sign in"), a:has-text("Already have")',
  },

  // ── Reset password ────────────────────────────────────────────────────────
  resetPassword: {
    email: 'input[type="email"]',
    submit: 'button[type="submit"]',
    // Target the heading/title element specifically to avoid strict-mode violations
    // (`:has-text` matches all ancestors; narrow to leaf-level heading elements)
    successMsg: 'h1:has-text("Check your email"), h2:has-text("Check your email"), h3:has-text("Check your email")',
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  nav: {
    sidebar: '[data-sidebar="sidebar"]',
    dashboardLink: 'a[href="/dashboard"]',
    coursesLink: 'a[href="/courses"]',
    logoutBtn: 'button:has-text("Log out"), button:has-text("Sign out"), button:has-text("Logout")',
    userRoleBadge: ':has-text("Administrator"), :has-text("Instructor"), :has-text("Member")',
  },

  // ── Course builder ────────────────────────────────────────────────────────
  builder: {
    publishToggle: '#publish-toggle',
    previewBtn: 'button:has-text("Preview")',
    titleField: '[contenteditable="true"]',
    addModuleBtn: 'button:has-text("Add Module"), button:has-text("+ Module"), button:has-text("Module")',
    saveIndicator: ':has-text("Saved"), :has-text("saving")',
  },

  // ── Assignment submission ─────────────────────────────────────────────────
  assignment: {
    textEntryTab: '[role="tab"]:has-text("Text Entry")',
    websiteUrlTab: '[role="tab"]:has-text("Website URL"), [role="tab"]:has-text("URL")',
    fileUploadTab: '[role="tab"]:has-text("File Upload"), [role="tab"]:has-text("File")',
    urlInput: '#url',
    submitBtn: 'button:has-text("Submit Assignment")',
    saveDraftBtn: 'button:has-text("Save Draft")',
    // Anchor first, and not `button`, because it is not one: the page renders
    // <Button asChild><Link>Cancel</Link></Button>, and Radix's asChild drops
    // the <button> in favour of the child <a>. The old button-only selector
    // could never match, which the count-guard around its only assertion hid.
    cancelBtn: 'a:has-text("Cancel"), button:has-text("Cancel")',
    fileDropzone: 'input[type="file"]',
    contentEditable: '[contenteditable]',
  },

  // ── Generic ───────────────────────────────────────────────────────────────
  spinner: '.animate-spin',
  toast: '[data-sonner-toast], li[data-sonner-toast]',
  errorAlert: '[role="alert"]',
  tab: (label: string) => `[role="tab"]:has-text("${label}")`,
  tabPanel: '[role="tabpanel"]',
  searchInput: 'input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]',
  table: 'table',
  heading: (text: string) => `h1:has-text("${text}"), h2:has-text("${text}")`,
  dialog: '[role="dialog"]',
  confirmBtn: 'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
  cancelDialogBtn: 'button:has-text("Cancel")',
  backBtn: 'button:has-text("Back"), a:has-text("Back")',
};
