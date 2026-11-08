// src/data/mappers.ts
var opt = (v) => v === null || v === void 0 ? void 0 : v;
function rowToCustomer(r) {
	const c = {
		id: String(r.id),
		name: String(r.name),
		phone: String(r.phone ?? ""),
		course: String(r.course ?? ""),
		status: r.status,
		source: r.source,
		createdAt: String(r.created_at)
	};
	if (opt(r.email)) c.email = String(r.email);
	if (opt(r.note)) c.note = String(r.note);
	if (opt(r.updated_at)) c.updatedAt = String(r.updated_at);
	if (opt(r.paid_at)) c.paidAt = String(r.paid_at);
	return c;
}
function rowToTransaction(r) {
	const t = {
		id: String(r.id),
		type: r.type,
		amount: Number(r.amount),
		method: r.method,
		category: r.category,
		note: String(r.note ?? ""),
		status: r.status,
		date: String(r.date)
	};
	if (opt(r.customer_id)) t.customerId = String(r.customer_id);
	if (opt(r.customer_name)) t.customerName = String(r.customer_name);
	if (opt(r.source)) t.source = r.source;
	if (opt(r.updated_at)) t.updatedAt = String(r.updated_at);
	if (opt(r.enrollment_id)) t.enrollmentId = String(r.enrollment_id);
	if (opt(r.teacher_id)) t.teacherId = String(r.teacher_id);
	if (opt(r.period)) t.period = String(r.period);
	if (r.provider === "payme" || r.provider === "click") t.provider = r.provider;
	if (opt(r.provider_ref)) t.providerRef = String(r.provider_ref);
	return t;
}
function rowToCourse(r) {
	const c = {
		id: String(r.id),
		name: String(r.name),
		type: r.type,
		durationMonths: Number(r.duration_months),
		monthlyPrice: Number(r.monthly_price),
		status: r.status,
		createdAt: String(r.created_at)
	};
	if (opt(r.updated_at)) c.updatedAt = String(r.updated_at);
	return c;
}
var hhmm = (value) => String(value ?? "").slice(0, 5);
var day = (value) => String(value ?? "").slice(0, 10);
function rowToGroup(r) {
	const g = {
		id: String(r.id),
		name: String(r.name),
		courseId: String(r.course_id),
		room: String(r.room ?? ""),
		days: Array.isArray(r.days) ? r.days : [],
		startTime: hhmm(r.start_time),
		endTime: hhmm(r.end_time),
		capacity: Number(r.capacity),
		startDate: day(r.start_date),
		status: r.status,
		createdAt: String(r.created_at)
	};
	if (opt(r.teacher_id)) g.teacherId = String(r.teacher_id);
	if (opt(r.end_date)) g.endDate = day(r.end_date);
	if (opt(r.updated_at)) g.updatedAt = String(r.updated_at);
	return g;
}
function rowToEnrollment(r) {
	const e = {
		id: String(r.id),
		customerId: String(r.customer_id),
		groupId: String(r.group_id),
		startDate: day(r.start_date),
		status: r.status,
		createdAt: String(r.created_at)
	};
	if (opt(r.end_date)) e.endDate = day(r.end_date);
	if (opt(r.price_override)) e.priceOverride = Number(r.price_override);
	if (opt(r.discount_percent)) e.discountPercent = Number(r.discount_percent);
	if (opt(r.paused_from)) e.pausedFrom = day(r.paused_from);
	if (opt(r.paused_to)) e.pausedTo = day(r.paused_to);
	if (opt(r.updated_at)) e.updatedAt = String(r.updated_at);
	return e;
}
// src/server/i18n-stub.ts
function tr(text, params) {
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (match, key) => key in params ? String(params[key]) : match);
}
tr("Du"), tr("Se"), tr("Cho"), tr("Pa"), tr("Ju"), tr("Sha"), tr("Ya");
tr("Dushanba"), tr("Seshanba"), tr("Chorshanba"), tr("Payshanba"), tr("Juma"), tr("Shanba"), tr("Yakshanba");
tr("Faol"), tr("Tugagan"), tr("Arxiv");
tr("O'qiyapti"), tr("Pauzada"), tr("Tugatgan"), tr("Ketgan");
function dayString(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDay(day) {
	const [y, m, d] = day.split("-").map(Number);
	return new Date(y, m - 1, d);
}
function addDays(day, days) {
	const date = parseDay(day);
	date.setDate(date.getDate() + days);
	return dayString(date);
}
function enrollmentActiveOn(enrollment, day) {
	if (enrollment.startDate > day) return false;
	if (enrollment.endDate && enrollment.endDate < day) return false;
	if (enrollment.status === "left" || enrollment.status === "finished") {
		if (!enrollment.endDate) return false;
	}
	if (enrollment.pausedFrom && enrollment.pausedFrom <= day && (!enrollment.pausedTo || enrollment.pausedTo >= day)) return false;
	if (enrollment.status === "paused" && !enrollment.pausedFrom) return false;
	return true;
}
function enrollmentMonthlyFee(enrollment, course) {
	const base = enrollment.priceOverride ?? course?.monthlyPrice ?? 0;
	const discount = Math.min(100, Math.max(0, enrollment.discountPercent ?? 0));
	return Math.round(base * (1 - discount / 100));
}
// src/utils/analytics.ts
function inPeriod(iso, period) {
	const time = new Date(iso).getTime();
	return time >= period.start.getTime() && time <= period.end.getTime();
}
// src/utils/attribution.ts
function attributeIncome(t, ctx) {
	if (t.type !== "income") return null;
	if (t.enrollmentId) {
		const linked = ctx.enrollments.find((e) => e.id === t.enrollmentId);
		if (linked) return linked;
	}
	if (!t.customerId) return null;
	const customer = ctx.customers.find((c) => c.id === t.customerId);
	if (!customer) return null;
	const day = dayString(new Date(t.date));
	return ctx.enrollments.filter((e) => e.customerId === customer.id && enrollmentActiveOn(e, day)).filter((e) => {
		const group = ctx.groups.find((g) => g.id === e.groupId);
		return ctx.courses.find((c) => c.id === group?.courseId)?.name === customer.course;
	}).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
}
function incomesByEnrollment(transactions, ctx) {
	const map = /* @__PURE__ */ new Map();
	for (const t of transactions) {
		if (t.type !== "income" || t.status !== "paid") continue;
		const enrollment = attributeIncome(t, ctx);
		if (!enrollment) continue;
		const list = map.get(enrollment.id) ?? [];
		list.push(t);
		map.set(enrollment.id, list);
	}
	return map;
}
// src/utils/debts.ts
var DEFAULT_DEBT_SETTINGS = {
	prorateFirstMonth: false,
	paymentDueDay: 10
};
function currentMonth(now = /* @__PURE__ */ new Date()) {
	return {
		start: new Date(now.getFullYear(), now.getMonth(), 1),
		end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
	};
}
function sumBy(transactions, match) {
	return transactions.reduce((sum, t) => sum + (match(t) ? t.amount : 0), 0);
}
var PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
var daysBetween = (from, to) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 864e5) + 1;
function monthOf(day) {
	return day.slice(0, 7);
}
function monthStartDay(period) {
	return `${period}-01`;
}
function monthEndDay(period) {
	const [y, m] = period.split("-").map(Number);
	return dayString(new Date(y, m, 0));
}
function nextPeriod(period) {
	const [y, m] = period.split("-").map(Number);
	return dayString(new Date(y, m, 1)).slice(0, 7);
}
function effectiveEnd(e) {
	if (e.endDate) return e.endDate;
	if (e.status === "left" || e.status === "finished") return (e.updatedAt ?? e.createdAt).slice(0, 10);
}
function monthExpected(e, period, fee, settings) {
	const from = monthStartDay(period);
	const to = monthEndDay(period);
	const end = effectiveEnd(e);
	const activeFrom = e.startDate > from ? e.startDate : from;
	const activeTo = end && end < to ? end : to;
	if (activeFrom > activeTo || fee <= 0) return 0;
	const monthDays = daysBetween(from, to);
	let activeDays = daysBetween(activeFrom, activeTo);
	const pauseFrom = e.pausedFrom ?? (e.status === "paused" ? (e.updatedAt ?? e.createdAt).slice(0, 10) : void 0);
	let paused = false;
	if (pauseFrom) {
		const pauseTo = e.pausedTo ?? "9999-12-31";
		const overlapFrom = pauseFrom > activeFrom ? pauseFrom : activeFrom;
		const overlapTo = pauseTo < activeTo ? pauseTo : activeTo;
		if (overlapFrom <= overlapTo) {
			paused = true;
			activeDays -= daysBetween(overlapFrom, overlapTo);
		}
	}
	if (activeDays <= 0) return 0;
	const firstMonth = period === monthOf(e.startDate);
	if (paused || firstMonth && settings.prorateFirstMonth) return Math.round(fee * activeDays / monthDays);
	return fee;
}
function dueDate(e, period, settings) {
	if (period === monthOf(e.startDate)) return e.startDate;
	const day = Math.min(28, Math.max(1, settings.paymentDueDay));
	return `${period}-${String(day).padStart(2, "0")}`;
}
function enrollmentLedger(e, payments, ctx, today) {
	const group = ctx.groups.find((g) => g.id === e.groupId);
	const course = ctx.courses.find((c) => c.id === group?.courseId);
	const fee = enrollmentMonthlyFee(e, course);
	const months = [];
	const end = effectiveEnd(e);
	const lastPeriod = [monthOf(today), end ? monthOf(end) : monthOf(today)].reduce((min, p) => p < min ? p : min);
	const paidBy = /* @__PURE__ */ new Map();
	const firstPeriod = monthOf(e.startDate);
	for (const t of payments) {
		const raw = t.period && PERIOD_RE.test(t.period) ? t.period : monthOf(dayString(new Date(t.date)));
		const period = raw < firstPeriod ? firstPeriod : raw;
		paidBy.set(period, (paidBy.get(period) ?? 0) + t.amount);
	}
	let expectedDue = 0;
	let expectedAll = 0;
	let duePeriod;
	let running = 0;
	const paid = payments.reduce((sum, t) => sum + t.amount, 0);
	for (let period = firstPeriod; period <= lastPeriod; period = nextPeriod(period)) {
		const expected = monthExpected(e, period, fee, ctx.settings);
		const monthPaid = paidBy.get(period) ?? 0;
		const due = today > dueDate(e, period, ctx.settings);
		expectedAll += expected;
		if (due) {
			expectedDue += expected;
			duePeriod = period;
		}
		running += monthPaid - expected;
		months.push({
			period,
			expected,
			paid: monthPaid,
			balance: running,
			due
		});
	}
	return {
		enrollment: e,
		group,
		course,
		fee,
		months,
		expectedDue,
		expectedAll,
		paid,
		balance: paid - expectedDue,
		duePeriod
	};
}
function studyMonthNumber(customer, now = /* @__PURE__ */ new Date()) {
	if (!customer.paidAt) return null;
	const start = new Date(customer.paidAt);
	return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
}
function legacyDebt(customer, courses, transactions, now) {
	if (customer.status !== "paid") return null;
	const course = courses.find((c) => c.name === customer.course);
	if (!course || course.monthlyPrice <= 0) return null;
	const studyMonth = studyMonthNumber(customer, now);
	if (course.durationMonths > 0 && studyMonth !== null && studyMonth > course.durationMonths) return null;
	const month = currentMonth(now);
	const own = transactions.filter((t) => t.type === "income" && t.customerId === customer.id);
	const paid = sumBy(own, (t) => t.status === "paid" && inPeriod(t.date, month));
	const pending = sumBy(own, (t) => t.status === "pending");
	const expected = course.monthlyPrice;
	const debt = Math.max(0, expected - paid);
	return {
		customer,
		course,
		label: course.name,
		monthly: expected,
		expected,
		paid,
		debt,
		advance: Math.max(0, paid - expected),
		dueNow: debt,
		pending,
		studyMonth,
		ledgers: []
	};
}
function prepare(customers, courses, transactions, ctx) {
	const groups = ctx.groups ?? [];
	const enrollments = ctx.enrollments ?? [];
	return {
		groups,
		enrollments,
		settings: ctx.settings ?? DEFAULT_DEBT_SETTINGS,
		byEnrollment: enrollments.length ? incomesByEnrollment(transactions, {
			enrollments,
			groups,
			courses,
			customers
		}) : /* @__PURE__ */ new Map()
	};
}
function rowFor(customer, courses, transactions, p, now) {
	const own = p.enrollments.filter((e) => e.customerId === customer.id);
	if (own.length === 0) return legacyDebt(customer, courses, transactions, now);
	const today = dayString(now);
	const ledgers = own.map((e) => enrollmentLedger(e, p.byEnrollment.get(e.id) ?? [], {
		groups: p.groups,
		courses,
		settings: p.settings
	}, today)).filter((l) => l.months.length > 0 || l.paid > 0);
	if (ledgers.length === 0) return null;
	const expected = ledgers.reduce((s, l) => s + l.expectedDue, 0);
	const paid = ledgers.reduce((s, l) => s + l.paid, 0);
	const all = ledgers.reduce((s, l) => s + l.expectedAll, 0);
	const balance = paid - expected;
	const active = ledgers.filter((l) => !effectiveEnd(l.enrollment) || (effectiveEnd(l.enrollment) ?? "") >= addDays(today, -31));
	const main = active[0] ?? ledgers[0];
	const course = main.course ?? courses.find((c) => c.name === customer.course) ?? {
		id: "",
		name: customer.course,
		type: "course",
		durationMonths: 0,
		monthlyPrice: 0,
		status: "active",
		createdAt: customer.createdAt
	};
	const pending = sumBy(transactions, (t) => t.type === "income" && t.customerId === customer.id && t.status === "pending");
	const names = [...new Set(ledgers.map((l) => l.group?.name ?? l.course?.name ?? "—"))];
	return {
		customer,
		course,
		group: ledgers.length === 1 ? main.group : void 0,
		label: names.join(", "),
		monthly: active.reduce((s, l) => s + l.fee, 0),
		expected,
		paid,
		debt: Math.max(0, -balance),
		advance: Math.max(0, balance),
		dueNow: Math.max(0, all - paid),
		pending,
		studyMonth: null,
		ledgers
	};
}
function computeDebts(customers, courses, transactions, now = /* @__PURE__ */ new Date(), ctx = {}) {
	const p = prepare(customers, courses, transactions, ctx);
	return customers.map((c) => rowFor(c, courses, transactions, p, now)).filter((row) => row !== null && row.debt > 0).sort((a, b) => b.debt - a.debt || a.customer.name.localeCompare(b.customer.name));
}
// src/utils/format.ts
var GROUP = "\xA0";
function groupDigits(integer) {
	return integer.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}
function formatNumber(value) {
	const rounded = Math.round(value);
	return `${rounded < 0 ? "-" : ""}${groupDigits(String(Math.abs(rounded)))}`;
}
new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0
});
// src/constants/mockData.ts
var COURSES = [
	"Ingliz tili (IELTS)",
	"Frontend dasturlash",
	"Python asoslari",
	"Matematika (DTM)",
	"Rus tili",
	"Grafik dizayn"
];
var DEFAULT_REMINDER_UZ = "Assalomu alaykum, {ism}! {markaz}: «{guruh}» guruhi bo'yicha {oy} oyi to'lovi — {summa}. Iltimos, to'lovni amalga oshiring. Savollar bo'lsa: {telefon}";
var DEFAULT_REMINDER_RU = "Здравствуйте, {ism}! {markaz}: оплата за {oy}, группа «{guruh}» — {summa}. Пожалуйста, внесите оплату. Вопросы: {telefon}";
var DEFAULT_SETTINGS = {
	orgName: "EduFlow Academy",
	logoText: "EA",
	logoImage: "",
	phone: "+998 71 200 00 00",
	address: "Toshkent sh., Chilonzor tumani",
	currency: "UZS",
	dateFormat: "dd.mm.yyyy",
	csvDelimiter: ";",
	adminLogin: "admin",
	profileName: "",
	profileRole: "Administrator",
	attendanceEditDays: 3,
	prorateFirstMonth: false,
	paymentDueDay: 10,
	reminderTemplateUz: DEFAULT_REMINDER_UZ,
	reminderTemplateRu: DEFAULT_REMINDER_RU,
	paymeMerchantId: "",
	clickServiceId: "",
	clickMerchantId: "",
	smsSender: "",
	autoReminders: false,
	autoRemindEveryDays: 7,
	autoRemindLang: "uz"
};
COURSES[0], COURSES[1], COURSES[2], COURSES[3], COURSES[4], COURSES[5];
// src/utils/guards.ts
var CURRENCIES = {
	UZS: true,
	USD: true
};
var DATE_FORMATS = {
	"dd.mm.yyyy": true,
	"dd/mm/yyyy": true,
	"yyyy-mm-dd": true
};
var DELIMITERS = {
	";": true,
	",": true
};
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function oneOf(allowed, value) {
	return typeof value === "string" && Object.hasOwn(allowed, value);
}
function isText(value) {
	return typeof value === "string" && value.trim().length > 0;
}
var LOGO_MAX_LENGTH = Math.ceil(819200 / 3) + 64;
var LOGO_PATTERN = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
function isLogoDataUrl(value) {
	return value.length <= LOGO_MAX_LENGTH && LOGO_PATTERN.test(value);
}
function isWholeNumber(value, min, max) {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function sanitizeSettings(value) {
	const raw = isRecord(value) ? value : {};
	return {
		orgName: isText(raw.orgName) ? raw.orgName : DEFAULT_SETTINGS.orgName,
		logoText: typeof raw.logoText === "string" ? raw.logoText.slice(0, 3) : DEFAULT_SETTINGS.logoText,
		logoImage: typeof raw.logoImage === "string" && isLogoDataUrl(raw.logoImage) ? raw.logoImage : "",
		phone: typeof raw.phone === "string" ? raw.phone : DEFAULT_SETTINGS.phone,
		address: typeof raw.address === "string" ? raw.address : DEFAULT_SETTINGS.address,
		currency: oneOf(CURRENCIES, raw.currency) ? raw.currency : DEFAULT_SETTINGS.currency,
		dateFormat: oneOf(DATE_FORMATS, raw.dateFormat) ? raw.dateFormat : DEFAULT_SETTINGS.dateFormat,
		csvDelimiter: oneOf(DELIMITERS, raw.csvDelimiter) ? raw.csvDelimiter : DEFAULT_SETTINGS.csvDelimiter,
		adminLogin: isText(raw.adminLogin) ? raw.adminLogin : DEFAULT_SETTINGS.adminLogin,
		profileName: typeof raw.profileName === "string" ? raw.profileName.trim().slice(0, 60) : DEFAULT_SETTINGS.profileName,
		profileRole: isText(raw.profileRole) ? raw.profileRole.trim().slice(0, 40) : DEFAULT_SETTINGS.profileRole,
		attendanceEditDays: isWholeNumber(raw.attendanceEditDays, 0, 60) ? raw.attendanceEditDays : DEFAULT_SETTINGS.attendanceEditDays,
		prorateFirstMonth: typeof raw.prorateFirstMonth === "boolean" ? raw.prorateFirstMonth : DEFAULT_SETTINGS.prorateFirstMonth,
		paymentDueDay: isWholeNumber(raw.paymentDueDay, 1, 28) ? raw.paymentDueDay : DEFAULT_SETTINGS.paymentDueDay,
		reminderTemplateUz: isText(raw.reminderTemplateUz) ? raw.reminderTemplateUz.slice(0, 1e3) : DEFAULT_REMINDER_UZ,
		reminderTemplateRu: isText(raw.reminderTemplateRu) ? raw.reminderTemplateRu.slice(0, 1e3) : DEFAULT_REMINDER_RU,
		paymeMerchantId: typeof raw.paymeMerchantId === "string" && /^[0-9a-f]{24}$/i.test(raw.paymeMerchantId) ? raw.paymeMerchantId : "",
		clickServiceId: typeof raw.clickServiceId === "string" && /^\d{1,10}$/.test(raw.clickServiceId) ? raw.clickServiceId : "",
		clickMerchantId: typeof raw.clickMerchantId === "string" && /^\d{1,10}$/.test(raw.clickMerchantId) ? raw.clickMerchantId : "",
		smsSender: typeof raw.smsSender === "string" && /^[\w.-]{2,11}$/.test(raw.smsSender) ? raw.smsSender : "",
		autoReminders: raw.autoReminders === true,
		autoRemindEveryDays: isWholeNumber(raw.autoRemindEveryDays, 3, 30) ? raw.autoRemindEveryDays : DEFAULT_SETTINGS.autoRemindEveryDays,
		autoRemindLang: raw.autoRemindLang === "ru" ? "ru" : "uz"
	};
}
// src/utils/phone.ts
var COUNTRY_CODE = "998";
var LOCAL_LENGTH = 9;
function phoneDigits(value) {
	let digits = value.replace(/\D/g, "");
	if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(3);
	return digits.slice(0, LOCAL_LENGTH);
}
// src/utils/paymentLinks.ts
function paymeCheckoutUrl(merchantId, phone, amountSom, lang = "uz") {
	const params = [
		`m=${merchantId}`,
		`ac.phone=${phoneDigits(phone)}`,
		`a=${Math.round(amountSom * 100)}`,
		`l=${lang}`
	];
	return `https://checkout.paycom.uz/${btoa(params.join(";"))}`;
}
function clickPayUrl(serviceId, merchantId, phone, amountSom) {
	return `https://my.click.uz/services/pay?${new URLSearchParams({
		service_id: serviceId,
		merchant_id: merchantId,
		amount: String(Math.round(amountSom)),
		transaction_param: phoneDigits(phone)
	}).toString()}`;
}
function paymentLink(s, phone, amountSom, lang = "uz") {
	if (amountSom <= 0 || phoneDigits(phone).length !== 9) return null;
	if (s.paymeMerchantId) return paymeCheckoutUrl(s.paymeMerchantId, phone, amountSom, lang);
	if (s.clickServiceId && s.clickMerchantId) return clickPayUrl(s.clickServiceId, s.clickMerchantId, phone, amountSom);
	return null;
}
// src/utils/reminders.ts
var MONTHS = {
	uz: [
		"yanvar",
		"fevral",
		"mart",
		"aprel",
		"may",
		"iyun",
		"iyul",
		"avgust",
		"sentabr",
		"oktabr",
		"noyabr",
		"dekabr"
	],
	ru: [
		"январь",
		"февраль",
		"март",
		"апрель",
		"май",
		"июнь",
		"июль",
		"август",
		"сентябрь",
		"октябрь",
		"ноябрь",
		"декабрь"
	]
};
function monthName(date, lang) {
	return MONTHS[lang][date.getMonth()];
}
function fillTemplate(template, values) {
	return template.replace(/\{(\w+)\}/g, (match, key) => {
		const value = values[key];
		return value === void 0 ? match : value;
	});
}
var LINK_LABEL = {
	uz: "To'lov havolasi:",
	ru: "Ссылка для оплаты:"
};
function withPaymentLink(template, text, link, lang, append) {
	if (!link || template.includes("{havola}") || !append) return text;
	return `${text}\n${LINK_LABEL[lang]} ${link}`;
}
// src/server/engine.ts
var alive = (rows) => rows.filter((r) => !r.deleted_at);
function money(amount, currency, lang) {
	if (currency === "USD") return `$${formatNumber(amount)}`;
	return `${formatNumber(amount)} ${lang === "ru" ? "сум" : "so'm"}`;
}
function debtorReminders(rows, options) {
	const settings = sanitizeSettings(rows.settings);
	const customers = alive(rows.customers).map(rowToCustomer);
	const ids = new Set(customers.map((c) => c.id));
	const debts = computeDebts(customers, alive(rows.courses).map(rowToCourse), alive(rows.transactions).map(rowToTransaction), options.now, {
		groups: alive(rows.groups).map(rowToGroup),
		enrollments: alive(rows.enrollments).map(rowToEnrollment).filter((e) => ids.has(e.customerId)),
		settings: {
			prorateFirstMonth: settings.prorateFirstMonth,
			paymentDueDay: settings.paymentDueDay
		}
	});
	const template = options.lang === "ru" ? settings.reminderTemplateRu : settings.reminderTemplateUz;
	return debts.map((row) => {
		const link = options.withLink ? paymentLink(settings, row.customer.phone, row.debt, options.lang) : null;
		const text = fillTemplate(template, {
			ism: row.customer.name,
			summa: money(row.debt, settings.currency, options.lang),
			kurs: row.course.name,
			guruh: row.label,
			oy: monthName(options.now, options.lang),
			markaz: settings.orgName,
			telefon: settings.phone,
			havola: link ?? ""
		});
		return {
			customerId: row.customer.id,
			name: row.customer.name,
			phone: row.customer.phone,
			debt: row.debt,
			label: row.label,
			text: withPaymentLink(template, text, link, options.lang, true)
		};
	});
}
function tashkentNow(utcMs) {
	return new Date(utcMs + 18e6);
}
export { debtorReminders, tashkentNow };
