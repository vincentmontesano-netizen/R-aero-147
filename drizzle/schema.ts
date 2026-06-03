import {
  boolean,
  integer,
  serial,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── ENUMS ──────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "instructor", "company_manager"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const subscriptionTypeEnum = pgEnum("subscription_type", ["none", "standard", "all_inclusive"]);
export const trainingTypeEnum = pgEnum("training_type", ["elearning", "webinar", "qt", "seminar", "event"]);
export const trainingDomainEnum = pgEnum("training_domain", ["b1", "b2", "b1b2", "part66", "general", "management"]);
export const trainingLevelEnum = pgEnum("training_level", ["beginner", "intermediate", "advanced"]);
export const quizTypeEnum = pgEnum("quiz_type", ["qcm", "qcu", "true_false", "free_text", "matching"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "refunded", "cancelled"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["not_started", "in_progress", "completed", "expired", "failed"]);
export const recurrencyStatusEnum = pgEnum("recurrency_status", ["ok", "due_soon", "overdue", "not_started"]);
export const quoteStatusEnum = pgEnum("quote_status", ["received", "in_progress", "quote_sent", "accepted", "refused"]);
export const webinarStatusEnum = pgEnum("webinar_status", ["scheduled", "live", "completed", "cancelled"]);
export const sessionFormatEnum = pgEnum("session_format", ["in_person", "virtual", "webinar"]);
export const sessionStatusEnum = pgEnum("session_status", ["scheduled", "full", "completed", "cancelled"]);
export const sessionRegStatusEnum = pgEnum("session_reg_status", ["registered", "attended", "cancelled"]);
export const knowledgeLevelEnum = pgEnum("knowledge_level", ["1", "2", "3"]);
export const trainingVariantEnum = pgEnum("training_variant", ["initial", "recurrent"]);

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  firstName: varchar("firstName", { length: 128 }),  // passport "Général" — first name
  lastName: varchar("lastName", { length: 128 }),    // passport "Général" — last name
  bio: text("bio"),                                  // passport "Général" — free description
  passportShared: boolean("passportShared").default(false), // person consent: expose the whole ID module (documents) to affiliated orgs
  resetToken: varchar("resetToken", { length: 64 }),          // password reset token (random)
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),       // reset token expiry
  twoFactorEnabled: boolean("twoFactorEnabled").default(false), // email 2FA opt-in
  twoFactorCode: varchar("twoFactorCode", { length: 12 }),      // current login OTP
  twoFactorExpiresAt: timestamp("twoFactorExpiresAt"),          // OTP expiry
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // INV-1: the login email MUST be the person's personal email (durable, survives
  // employer changes). Flagged so the invariant can be audited/enforced.
  loginEmailIsPersonal: boolean("loginEmailIsPersonal").default(true),
  role: userRoleEnum("role").default("user").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  // Part-66 info
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  licenseCategories: varchar("licenseCategories", { length: 128 }),
  typeRatings: varchar("typeRatings", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 128 }),
  preferredLanguage: varchar("preferredLanguage", { length: 8 }).default("fr"),
  timezone: varchar("timezone", { length: 64 }).default("Europe/Paris"),
  marketingOptIn: boolean("marketingOptIn").default(false),
  dataProcessingConsentAt: timestamp("dataProcessingConsentAt"), // RGPD: explicit consent timestamp (null = not given)
  consentUpdatedAt: timestamp("consentUpdatedAt"), // last time any consent was changed
  companyId: integer("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── COMPANIES (B2B) ─────────────────────────────────────────────────────────
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  siret: varchar("siret", { length: 20 }),
  vatNumber: varchar("vatNumber", { length: 32 }),
  address: text("address"),
  country: varchar("country", { length: 64 }).default("FR"),
  type: varchar("type", { length: 16 }), // "MRO" | "AIRLINE" | "CAMO" | "OTHER"
  agreementNumber: varchar("agreementNumber", { length: 64 }), // EASA/national approval no. (e.g. FR.145.XXXX)
  status: varchar("status", { length: 16 }).default("ACTIVE"), // "ACTIVE" | "SUSPENDED"
  contactName: varchar("contactName", { length: 128 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 32 }),
  subscriptionType: subscriptionTypeEnum("subscriptionType").default("none"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  userId: integer("userId"),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 128 }),
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  licenseCategories: varchar("licenseCategories", { length: 128 }),
  typeRatings: varchar("typeRatings", { length: 255 }),
  department: varchar("department", { length: 128 }),
  base: varchar("base", { length: 128 }),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

// ─── TRAINING CATEGORIES ─────────────────────────────────────────────────────
export const trainingCategories = pgTable("training_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }),
  sortOrder: integer("sortOrder").default(0),
});

export type TrainingCategory = typeof trainingCategories.$inferSelect;

// ─── TRAININGS (CATALOGUE) ───────────────────────────────────────────────────
export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  objectives: text("objectives"),
  prerequisites: text("prerequisites"),
  targetAudience: varchar("targetAudience", { length: 255 }),
  categoryId: integer("categoryId"),
  type: trainingTypeEnum("type").default("elearning").notNull(),
  domain: trainingDomainEnum("domain").default("general"),
  language: varchar("language", { length: 8 }).default("fr"),
  durationHours: numeric("durationHours", { precision: 5, scale: 2 }),
  level: trainingLevelEnum("level").default("intermediate"),
  priceHt: numeric("priceHt", { precision: 10, scale: 2 }),
  priceTtc: numeric("priceTtc", { precision: 10, scale: 2 }),
  priceEnterprise: numeric("priceEnterprise", { precision: 10, scale: 2 }),
  part147Reference: varchar("part147Reference", { length: 128 }),
  isPublished: boolean("isPublished").default(false),
  isFeatured: boolean("isFeatured").default(false),
  thumbnailUrl: varchar("thumbnailUrl", { length: 512 }),
  recurrencyMonths: integer("recurrencyMonths"),
  // Links FR/EN versions of the same course; `variant` distinguishes initial vs recurrent.
  translationGroupId: varchar("translationGroupId", { length: 64 }),
  variant: trainingVariantEnum("variant"),
  passingScore: integer("passingScore").default(75),
  maxAttempts: integer("maxAttempts").default(3),
  examQuestionCount: integer("examQuestionCount"),
  randomizeQuestions: boolean("randomizeQuestions").default(false),
  examTimeLimitMin: integer("examTimeLimitMin"),
  reviewStatus: varchar("reviewStatus", { length: 24 }).default("approved"),
  version: integer("version").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Training = typeof trainings.$inferSelect;
export type InsertTraining = typeof trainings.$inferInsert;

// ─── TRAINING MODULES ────────────────────────────────────────────────────────
export const trainingModules = pgTable("training_modules", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content"),
  videoUrl: varchar("videoUrl", { length: 512 }),
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  durationMinutes: integer("durationMinutes"),
  sortOrder: integer("sortOrder").default(0),
  isRequired: boolean("isRequired").default(true),
  objectiveId: integer("objectiveId"),
});

export type TrainingModule = typeof trainingModules.$inferSelect;
export type InsertTrainingModule = typeof trainingModules.$inferInsert;

// ─── LEARNING OBJECTIVES (Part-66 sub-modules) ───────────────────────────────
export const learningObjectives = pgTable("learning_objectives", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId").notNull(),
  moduleId: integer("moduleId"),
  code: varchar("code", { length: 32 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  knowledgeLevel: knowledgeLevelEnum("knowledgeLevel").default("1"),
  isRequired: boolean("isRequired").default(true),
  sortOrder: integer("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type LearningObjective = typeof learningObjectives.$inferSelect;
export type InsertLearningObjective = typeof learningObjectives.$inferInsert;

// ─── SLIDES (AI-authored slide-based courses) ────────────────────────────────
export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId").notNull(),
  moduleId: integer("moduleId"),
  objectiveId: integer("objectiveId"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body"),
  imageUrl: varchar("imageUrl", { length: 1024 }),
  imagePrompt: text("imagePrompt"),
  videoUrl: varchar("videoUrl", { length: 1024 }),
  audioUrl: varchar("audioUrl", { length: 1024 }),
  // Interactive video: quiz cue points synced to the timeline (pause + question at atSeconds).
  videoCues: jsonb("videoCues").$type<{ atSeconds: number; kind?: "quiz" | "branch" | "hotspot" | "dragdrop"; question?: string; options?: string[]; correct?: number[]; explanation?: string; onCorrectSeek?: number; branches?: { label: string; seekTo: number }[]; hotspots?: { xPct: number; yPct: number; label?: string; correct?: boolean; seekTo?: number }[]; dragItems?: { id: string; label: string }[]; dropZones?: { id: string; label?: string; xPct: number; yPct: number; wPct: number; hPct: number; correctItemId: string }[] }[]>(),
  // Optional embedded mini-quiz shown before "Next".
  quizQuestion: text("quizQuestion"),
  quizOptions: jsonb("quizOptions").$type<string[]>(),
  quizCorrect: jsonb("quizCorrect").$type<number[]>(),
  quizExplanation: text("quizExplanation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Slide = typeof slides.$inferSelect;
export type InsertSlide = typeof slides.$inferInsert;

// ─── QUIZ QUESTIONS ──────────────────────────────────────────────────────────
export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId").notNull(),
  moduleId: integer("moduleId"),
  objectiveId: integer("objectiveId"),
  question: text("question").notNull(),
  type: quizTypeEnum("type").default("qcu").notNull(),
  options: jsonb("options").$type<string[]>(),
  correctAnswer: jsonb("correctAnswer").$type<number[]>(),
  optionsRight: jsonb("optionsRight").$type<string[]>(), // matching: right-column items
  answerKey: jsonb("answerKey").$type<{ keywords?: string[]; regex?: string; pairs?: number[][] }>(), // free_text / matching grading key
  explanation: text("explanation"),
  points: integer("points").default(1),
  difficulty: varchar("difficulty", { length: 16 }),
  sortOrder: integer("sortOrder").default(0),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

// ─── ORDERS ──────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyId: integer("companyId"),
  quoteRequestId: integer("quoteRequestId"), // set when the order originates from an accepted quote
  status: orderStatusEnum("status").default("pending").notNull(),
  totalHt: numeric("totalHt", { precision: 10, scale: 2 }).notNull(),
  totalTtc: numeric("totalTtc", { precision: 10, scale: 2 }).notNull(),
  vatAmount: numeric("vatAmount", { precision: 10, scale: 2 }),
  vatRate: numeric("vatRate", { precision: 5, scale: 2 }).default("20.00"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }),
  invoiceUrl: varchar("invoiceUrl", { length: 512 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── ORDER ITEMS ─────────────────────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  trainingId: integer("trainingId").notNull(),
  quantity: integer("quantity").default(1),
  unitPriceHt: numeric("unitPriceHt", { precision: 10, scale: 2 }).notNull(),
  unitPriceTtc: numeric("unitPriceTtc", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;

// ─── ENROLLMENTS ─────────────────────────────────────────────────────────────
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  trainingId: integer("trainingId").notNull(),
  orderId: integer("orderId"),
  employeeId: integer("employeeId"),
  status: enrollmentStatusEnum("status").default("not_started").notNull(),
  progressPercent: integer("progressPercent").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

// ─── MODULE PROGRESS ─────────────────────────────────────────────────────────
export const moduleProgress = pgTable("module_progress", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollmentId").notNull(),
  moduleId: integer("moduleId").notNull(),
  isCompleted: boolean("isCompleted").default(false),
  timeSpentMinutes: integer("timeSpentMinutes").default(0),
  completedAt: timestamp("completedAt"),
});

export type ModuleProgress = typeof moduleProgress.$inferSelect;

// ─── OBJECTIVE PROGRESS (per-enrollment objective completion) ────────────────
export const objectiveProgress = pgTable("objective_progress", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollmentId").notNull(),
  objectiveId: integer("objectiveId").notNull(),
  isCompleted: boolean("isCompleted").default(false),
  completedAt: timestamp("completedAt"),
});

export type ObjectiveProgress = typeof objectiveProgress.$inferSelect;

// ─── QUIZ ATTEMPTS ───────────────────────────────────────────────────────────
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollmentId").notNull(),
  userId: integer("userId").notNull(),
  trainingId: integer("trainingId").notNull(),
  score: integer("score"),
  maxScore: integer("maxScore"),
  isPassed: boolean("isPassed").default(false),
  answers: jsonb("answers").$type<Record<number, number[]>>(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  attemptNumber: integer("attemptNumber").default(1),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;

// ─── CERTIFICATES ────────────────────────────────────────────────────────────
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollmentId").notNull(),
  userId: integer("userId").notNull(),
  trainingId: integer("trainingId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 64 }).notNull().unique(),
  verificationCode: varchar("verificationCode", { length: 32 }).notNull().unique(),
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  isValid: boolean("isValid").default(true),
});

export type Certificate = typeof certificates.$inferSelect;

// ─── CERTIFICATE ↔ OBJECTIVE COVERAGE ────────────────────────────────────────
export const certificateObjectives = pgTable("certificate_objectives", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificateId").notNull(),
  objectiveId: integer("objectiveId").notNull(),
});

export type CertificateObjective = typeof certificateObjectives.$inferSelect;

// ─── RECURRENCIES ────────────────────────────────────────────────────────────
export const recurrencies = pgTable("recurrencies", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(),
  trainingId: integer("trainingId").notNull(),
  companyId: integer("companyId").notNull(),
  periodMonths: integer("periodMonths").notNull(),
  lastCompletedAt: timestamp("lastCompletedAt"),
  nextDueAt: timestamp("nextDueAt"),
  status: recurrencyStatusEnum("status").default("not_started"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Recurrency = typeof recurrencies.$inferSelect;

// ─── QUOTE REQUESTS ──────────────────────────────────────────────────────────
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  siret: varchar("siret", { length: 20 }),
  contactName: varchar("contactName", { length: 128 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }),
  employeeCount: integer("employeeCount"),
  trainingTypes: varchar("trainingTypes", { length: 512 }),
  message: text("message"),
  attachmentUrl: varchar("attachmentUrl", { length: 512 }),
  status: quoteStatusEnum("status").default("received").notNull(),
  userId: integer("userId"),
  companyId: integer("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type InsertQuoteRequest = typeof quoteRequests.$inferInsert;

// ─── MESSAGES ────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  quoteRequestId: integer("quoteRequestId"),
  ticketId: integer("ticketId"), // support ticket thread (alternative to quoteRequestId)
  fromUserId: integer("fromUserId").notNull(),
  toUserId: integer("toUserId"),
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;

// ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("OPEN"), // OPEN | PENDING | CLOSED
  priority: varchar("priority", { length: 16 }), // low | normal | high
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type SupportTicket = typeof supportTickets.$inferSelect;

// ─── WEBINARS ────────────────────────────────────────────────────────────────
export const webinars = pgTable("webinars", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  instructorName: varchar("instructorName", { length: 128 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: integer("durationMinutes"),
  maxParticipants: integer("maxParticipants"),
  meetingUrl: varchar("meetingUrl", { length: 512 }),
  replayUrl: varchar("replayUrl", { length: 512 }),
  liveRoom: varchar("liveRoom", { length: 128 }),
  status: webinarStatusEnum("status").default("scheduled"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Webinar = typeof webinars.$inferSelect;

// ─── WEBINAR REGISTRATIONS ───────────────────────────────────────────────────
export const webinarRegistrations = pgTable("webinar_registrations", {
  id: serial("id").primaryKey(),
  webinarId: integer("webinarId").notNull(),
  userId: integer("userId").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  attended: boolean("attended").default(false),
});

// ─── SESSIONS (scheduled inter-company / classroom / virtual) ────────────────
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  format: sessionFormatEnum("format").default("in_person").notNull(),
  location: varchar("location", { length: 255 }),
  instructorName: varchar("instructorName", { length: 128 }),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  durationDays: numeric("durationDays", { precision: 4, scale: 1 }),
  seats: integer("seats").default(12),
  seatsTaken: integer("seatsTaken").default(0),
  priceHt: numeric("priceHt", { precision: 10, scale: 2 }),
  language: varchar("language", { length: 8 }).default("fr"),
  cpfEligible: boolean("cpfEligible").default(false),
  meetingUrl: varchar("meetingUrl", { length: 512 }),
  replayUrl: varchar("replayUrl", { length: 512 }),
  liveRoom: varchar("liveRoom", { length: 128 }),
  status: sessionStatusEnum("status").default("scheduled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export const sessionRegistrations = pgTable("session_registrations", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  userId: integer("userId").notNull(),
  status: sessionRegStatusEnum("status").default("registered").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── ARTICLES (news / blog) ──────────────────────────────────────────────────
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content"),
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  category: varchar("category", { length: 64 }),
  author: varchar("author", { length: 128 }),
  isPublished: boolean("isPublished").default(false),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ─── CART ────────────────────────────────────────────────────────────────────
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  trainingId: integer("trainingId").notNull(),
  quantity: integer("quantity").default(1),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 48 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 512 }),
  isRead: boolean("isRead").default(false),
  // Stable key to avoid creating the same alert twice (idempotent generation).
  dedupeKey: varchar("dedupeKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── PROCESSED WEBHOOK EVENTS (Stripe idempotency) ───────────────────────────
export const processedWebhookEvents = pgTable("processed_webhook_events", {
  eventId: varchar("eventId", { length: 128 }).primaryKey(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

// ─── EXAM SESSIONS & PROCTORING (V2.1) ───────────────────────────────────────
export const examSessions = pgTable("exam_sessions", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollmentId").notNull(),
  userId: integer("userId").notNull(),
  trainingId: integer("trainingId").notNull(),
  attemptNumber: integer("attemptNumber").default(1),
  questionIds: jsonb("questionIds").$type<number[]>(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  submittedAt: timestamp("submittedAt"),
  status: varchar("status", { length: 16 }).default("active"),
});

export type ExamSession = typeof examSessions.$inferSelect;

export const proctoringEvents = pgTable("proctoring_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  detail: text("detail"),
  at: timestamp("at").defaultNow().notNull(),
});

export type ProctoringEvent = typeof proctoringEvents.$inferSelect;

// ─── EXTERNAL TRAININGS (technician file — qualifications gained off-platform) ─
export const externalTrainings = pgTable("external_trainings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId"),
  userId: integer("userId"),
  companyId: integer("companyId"),
  title: varchar("title", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }),
  category: varchar("category", { length: 128 }),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"),
  certNumber: varchar("certNumber", { length: 128 }),
  docUrl: varchar("docUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExternalTraining = typeof externalTrainings.$inferSelect;
export type InsertExternalTraining = typeof externalTrainings.$inferInsert;

// ─── ROLE REQUIREMENTS (automated Training Needs Analysis — V2.3) ────────────
// A rule maps a job profile (job title and/or licence category) to a mandatory
// training + its recyclage period. companyId null = global rule.
export const roleRequirements = pgTable("role_requirements", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId"),
  label: varchar("label", { length: 255 }),
  jobTitleContains: varchar("jobTitleContains", { length: 128 }),
  licenseCategoryContains: varchar("licenseCategoryContains", { length: 64 }),
  trainingId: integer("trainingId").notNull(),
  periodMonths: integer("periodMonths").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RoleRequirement = typeof roleRequirements.$inferSelect;

// ─── COURSE TEMPLATES (Part-66 pre-mapped) + content lifecycle (V2.6) ────────
export const courseTemplates = pgTable("course_templates", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  language: varchar("language", { length: 8 }).default("fr"),
  domain: varchar("domain", { length: 32 }),
  structure: jsonb("structure").$type<{ modules: { title: string; content?: string; objectives?: { code?: string; title: string; knowledgeLevel?: string }[] }[] }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CourseTemplate = typeof courseTemplates.$inferSelect;

export const contentRevisions = pgTable("content_revisions", {
  id: serial("id").primaryKey(),
  trainingId: integer("trainingId").notNull(),
  version: integer("version"),
  changelog: text("changelog"),
  status: varchar("status", { length: 24 }),
  byUserId: integer("byUserId"),
  at: timestamp("at").defaultNow().notNull(),
});
export type ContentRevision = typeof contentRevisions.$inferSelect;

export const regulatoryChanges = pgTable("regulatory_changes", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 128 }),
  summary: text("summary"),
  effectiveAt: timestamp("effectiveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RegulatoryChange = typeof regulatoryChanges.$inferSelect;

// ─── LIVE CLASSROOM: participants, chat/Q&A, polls/quizzes (TIER 2) ───────────
export const liveParticipants = pgTable("live_participants", {
  id: serial("id").primaryKey(),
  roomType: varchar("roomType", { length: 16 }).notNull(),
  roomId: integer("roomId").notNull(),
  userId: integer("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
});
export type LiveParticipant = typeof liveParticipants.$inferSelect;

export const liveMessages = pgTable("live_messages", {
  id: serial("id").primaryKey(),
  roomType: varchar("roomType", { length: 16 }).notNull(),
  roomId: integer("roomId").notNull(),
  userId: integer("userId").notNull(),
  kind: varchar("kind", { length: 8 }).notNull().default("chat"), // "chat" | "qa"
  content: text("content").notNull(),
  isAnswered: boolean("isAnswered").default(false),
  answeredByUserId: integer("answeredByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiveMessage = typeof liveMessages.$inferSelect;

export const livePolls = pgTable("live_polls", {
  id: serial("id").primaryKey(),
  roomType: varchar("roomType", { length: 16 }).notNull(),
  roomId: integer("roomId").notNull(),
  kind: varchar("kind", { length: 8 }).notNull().default("poll"), // "poll" | "quiz"
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>(),
  correct: jsonb("correct").$type<number[]>(),
  isOpen: boolean("isOpen").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LivePoll = typeof livePolls.$inferSelect;

export const livePollVotes = pgTable("live_poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("pollId").notNull(),
  userId: integer("userId").notNull(),
  choices: jsonb("choices").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LivePollVote = typeof livePollVotes.$inferSelect;

// ─── PERSON-CENTRIC COMPLIANCE CORE (affiliations, credentials, access logs, sign-offs) ──
// Additive layer over users(=Person) / companies(=Organization). State fields are
// plain varchars validated in Zod, NOT pgEnum — avoids the postgres-js enum-OID
// caching gotcha across a multi-phase rollout. No SQL FKs (detached applicatively).

// Affiliation — the governance edge Person↔Organization. An org's view of a person's
// compliance file is bounded by an ACTIVE affiliation (INV-2). proEmail proves the
// link / routes assignments but is NEVER a login (INV-1).
export const affiliations = pgTable("affiliations", {
  id: serial("id").primaryKey(),
  personId: integer("personId").notNull(),          // → users.id
  orgId: integer("orgId").notNull(),                // → companies.id
  employeeId: integer("employeeId"),                // → employees.id (operational roster link)
  proEmail: varchar("proEmail", { length: 320 }),
  role: varchar("role", { length: 16 }).notNull().default("MEMBER"),     // "MANAGER" | "MEMBER"
  status: varchar("status", { length: 16 }).notNull().default("ACTIVE"), // "ACTIVE" | "INACTIVE"
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Affiliation = typeof affiliations.$inferSelect;
export type InsertAffiliation = typeof affiliations.$inferInsert;

// Credential — dual-state proof of competency. LIVING = carried by the person
// (editable/portable/erasable). FROZEN = snapshot of proof-during-employment held by
// the org under its legal basis (INV-7). controller = PERSON | ORG (INV-6).
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  personId: integer("personId").notNull(),          // → users.id
  moduleId: integer("moduleId"),                    // → trainings.id (regulatory module)
  trainingId: integer("trainingId"),
  certificateId: integer("certificateId"),          // → certificates.id
  part66Coverage: jsonb("part66Coverage").$type<number[]>(), // learningObjectives ids
  label: varchar("label", { length: 255 }), // descriptive name for surfaced/external credentials
  provider: varchar("provider", { length: 255 }), // issuer of a surfaced external credential
  obtainedAt: timestamp("obtainedAt"),
  expiresAt: timestamp("expiresAt"),
  state: varchar("state", { length: 16 }).notNull().default("LIVING"),           // "LIVING" | "FROZEN"
  controller: varchar("controller", { length: 16 }).notNull().default("PERSON"), // "PERSON" | "ORG"
  origin: varchar("origin", { length: 16 }).notNull().default("INDEPENDENT"),    // "ORG_ASSIGNED" | "INDEPENDENT"
  affiliationId: integer("affiliationId"),          // → affiliations.id (when ORG_ASSIGNED)
  surfacedByPersonAt: timestamp("surfacedByPersonAt"),    // INV-5: person-initiated surfacing
  lockedInOrgViewUntil: timestamp("lockedInOrgViewUntil"),// INV-5: locked once used as proof
  frozenSnapshot: jsonb("frozenSnapshot").$type<Record<string, unknown>>(), // INV-7 immutable copy
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

// AccessLog — every read of personal data is logged with justification (INV-8);
// god-mode operator (admin) and public certificate verification included.
export const accessLogs = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actorId"),                      // → users.id ; null = public/anonymous
  actorRole: varchar("actorRole", { length: 32 }),  // "admin" | "AFFILIATION:MANAGER" | "PUBLIC" ...
  subjectPersonId: integer("subjectPersonId"),      // → users.id (whose data was read)
  action: varchar("action", { length: 64 }).notNull(),
  dataAccessed: jsonb("dataAccessed").$type<Record<string, unknown>>(),
  justification: text("justification"),
  targetOrgId: integer("targetOrgId"),              // → companies.id (context)
  ip: varchar("ip", { length: 64 }),
  at: timestamp("at").defaultNow().notNull(),
});
export type AccessLog = typeof accessLogs.$inferSelect;
export type InsertAccessLog = typeof accessLogs.$inferInsert;

// Sign-off — the HUMAN determination of compliance by a Manager (INV-4). The platform
// surfaces data; the Manager decides and signs. Audit export wording = "data
// supporting the Manager's determination", never "R-AERO certifies".
export const signoffs = pgTable("signoffs", {
  id: serial("id").primaryKey(),
  managerPersonId: integer("managerPersonId").notNull(), // → users.id (the signer)
  subjectPersonId: integer("subjectPersonId").notNull(), // → users.id (the technician)
  orgId: integer("orgId").notNull(),                     // → companies.id
  affiliationId: integer("affiliationId"),               // subject's affiliation at sign-off time
  credentialId: integer("credentialId"),                 // → credentials.id (signed competency)
  trainingId: integer("trainingId"),
  scope: varchar("scope", { length: 64 }),               // "COMPETENCE" | "RECURRENCY" ...
  decision: varchar("decision", { length: 16 }).notNull().default("VALIDATED"), // "VALIDATED" | "REJECTED"
  note: text("note"),
  signedAt: timestamp("signedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Signoff = typeof signoffs.$inferSelect;
export type InsertSignoff = typeof signoffs.$inferInsert;

// ─── APP SETTINGS (key/value, e.g. AI API keys set by the admin) ──────────────
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type AppSetting = typeof appSettings.$inferSelect;

// ─── Passport (person-owned, portable professional dossier) ───────────────────
// A USER's "ID / Passport" tab gathers uploaded documents (identity, diplomas,
// external certificates, logbook/experience PDFs) typed by `kind`. R-AERO trainings
// and issued certificates are aggregated read-only from existing tables — not stored
// here. `kind` is a varchar + Zod (NOT a pgEnum) per the project's enum discipline.
export const passportDocuments = pgTable("passport_documents", {
  id: serial("id").primaryKey(),
  personId: integer("personId").notNull(),                 // → users.id (owner)
  kind: varchar("kind", { length: 32 }).notNull(),         // ID|PASSPORT|DIPLOMA|CERTIFICATE|LICENSE|LOGBOOK|EXPERIENCE|OTHER
  title: varchar("title", { length: 255 }).notNull(),
  issuer: varchar("issuer", { length: 255 }),              // issuing authority / school / employer
  reference: varchar("reference", { length: 128 }),        // document number / reference
  country: varchar("country", { length: 64 }),
  issuedAt: timestamp("issuedAt"),
  expiresAt: timestamp("expiresAt"),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(), // storagePut url (/storage/...)
  fileName: varchar("fileName", { length: 255 }),
  contentType: varchar("contentType", { length: 128 }),
  fileSize: integer("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type PassportDocument = typeof passportDocuments.$inferSelect;

// ─── Landing-page content (admin-editable) ───────────────────────────────────
// Pricing offers shown on the landing page. Bilingual via `language`.
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 8 }).notNull().default("fr"), // "fr" | "en"
  name: varchar("name", { length: 128 }).notNull(),
  price: varchar("price", { length: 128 }),
  description: text("description"),
  features: jsonb("features").$type<string[]>().default([]),
  ctaLabel: varchar("ctaLabel", { length: 128 }),
  ctaHref: varchar("ctaHref", { length: 255 }).default("/devis"),
  highlight: boolean("highlight").default(false),
  sortOrder: integer("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type Offer = typeof offers.$inferSelect;

// FAQ entries shown on the landing page. Bilingual via `language`.
export const faqItems = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 8 }).notNull().default("fr"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type FaqItem = typeof faqItems.$inferSelect;
