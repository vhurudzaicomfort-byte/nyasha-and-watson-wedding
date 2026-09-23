// The Event Desk service catalogue as data — the single source for the Word
// document and the WhatsApp pitch (mirrors the published catalogue page).
const BRAND = "Event Desk";
const TAGLINE = "Invitations, RSVPs, guest lists, check-in, gifts and supplier payments — for every kind of event.";

const JOURNEY = [
  ["Plan", "Event page, programme, venue, suppliers, budget."],
  ["Invite", "Personal links, digital cards, WhatsApp, SMS, email."],
  ["Respond", "RSVP or registration, approvals, tickets, reminders."],
  ["Manage", "Guest list, seating, gifts, payments, live dashboard."],
  ["Arrive", "QR passes, usher, self and automatic check-in."],
  ["After", "Reports, thank-yous, photos, feedback, certificates."],
];

// status: live | next | later
const FEATURES = [
  { group: "Event website & branding", items: [
    ["Branded event website", "Cover reveal, countdown, welcome note, venue with map, programme, dress code and colour palette.", "live"],
    ["Personalised welcome", "Greets each guest by name and shows how many people their invitation covers.", "live"],
    ["Downloadable programme", "Branded order of events as an image guests can save or share.", "live"],
    ["Add to calendar", "Google Calendar link and an .ics file for Apple and Outlook.", "live"],
    ["Self-service event builder", "Hosts enter names, date, venue, colours, programme and photos in a form — no code.", "next"],
    ["Themes per event type", "Ready-made looks for weddings, lobola, corporate, church, parties and memorials.", "next"],
    ["Custom web address", "An event subdomain or the host's own domain, e.g. tariroandtendai.co.zw.", "next"],
    ["Multi-day & multi-session schedules", "Conferences, conventions and festivals with sessions, rooms and speakers.", "next"],
    ["Languages", "English, Shona, Ndebele and others, switchable by the guest.", "later"],
    ["Photo & video gallery", "Pre-event photos and a post-event album guests add to by QR code.", "later"],
    ["Livestream link", "For guests abroad or unable to travel — hybrid events.", "later"],
  ] },
  { group: "Invitations", items: [
    ["Personal invite links", "One private link per invitation, tied to the guest record and their allowance.", "live"],
    ["Interactive digital invitation card", "JPG, clickable PDF, animated GIF and editable SVG; tap to RSVP or open the venue in Google Maps.", "live"],
    ["Personalised card per guest", "Guest's name in bold plus a QR code that opens their own invitation.", "live"],
    ["WhatsApp invite, one tap", "Pre-written message with the guest's personal link, sent from the organiser's phone.", "live"],
    ["Bulk WhatsApp, SMS & email invites", "Send to the whole list at once via WhatsApp Business and bulk SMS, with delivery status.", "next"],
    ["Save-the-dates", "An early teaser card and link before full invitations go out.", "next"],
    ["Automatic reminders", "RSVP deadline nudges, a week-before note and day-before directions.", "next"],
  ] },
  { group: "RSVP & registration", items: [
    ["Step-by-step RSVP", "Attending, maybe or declining; party size capped at the invitation's allowance; plus-one names and a message.", "live"],
    ["Many ways to reply, one record", "Submit online, or by WhatsApp, SMS, call or email — every reply lands in the portal.", "live"],
    ["Duplicate-proof matching", "Replies from the general link are matched to the right invitation by phone or name.", "live"],
    ["Approval queue", "People not on the list are told \"pending approval\"; the host approves, links or declines, and every decision is kept.", "live"],
    ["Change my response", "Guests see what they replied and can update it before the deadline.", "live"],
    ["Custom registration questions", "Company, job title, dietary needs, accessibility, T-shirt size, session choices.", "next"],
    ["Capacity limits & waitlist", "Close registration when full and move people up automatically.", "next"],
    ["Tickets & paid registration", "EcoCash, InnBucks, card and PayPal, with ticket tiers and QR tickets.", "next"],
    ["Promo codes & early-bird pricing", "Discounts, group bookings and sponsor allocations.", "later"],
  ] },
  { group: "Guest list management", items: [
    ["Guest records", "Individuals, couples and families; phone with country code, email, category, gender, notes.", "live"],
    ["Excel import with dropdowns", "Styled templates with validation; preview before saving; duplicates flagged for review.", "live"],
    ["Search & filters", "By RSVP status, category, gender and check-in.", "live"],
    ["Guest categories", "Bride's side, groom's side, church, friends, service providers.", "live"],
    ["Categories per event", "Each host defines their own — departments, delegations, church branches, family sides.", "next"],
    ["Seating plan", "Tables, drag-and-drop seating, table cards and a \"find my table\" lookup.", "next"],
    ["Dietary & accessibility tracking", "Headcount per meal type; special needs flagged for caterer and venue.", "next"],
    ["VIP & protocol lists", "Dignitaries, speakers and family elders — priority seating and reception.", "later"],
  ] },
  { group: "Check-in & access", items: [
    ["QR guest passes", "Printable or phone badge per guest, with party size and status.", "live"],
    ["Usher check-in", "Scan a pass with the phone camera or search by name at the door.", "live"],
    ["Self check-in, location-verified", "Guests check themselves in on arrival; GPS confirms they're at the venue.", "live"],
    ["Automatic check-in", "On the day, accepted guests are checked in when their phone arrives at the venue.", "live"],
    ["Live arrivals", "Who's here, how they checked in, and who's still expected.", "live"],
    ["Multiple gates & usher logins", "Several entrances checking in at once, each usher with their own access.", "next"],
    ["Offline check-in", "Keeps working without signal and syncs when back online — common at rural venues.", "later"],
    ["Zones & access levels", "VIP areas, backstage, sessions; wristband and badge printing.", "later"],
  ] },
  { group: "Gifts, contributions & money", items: [
    ["Gift register", "Cash and in-kind gifts, giver and phone, payment method; totals per currency (USD, ZWG, ZAR, GBP, EUR).", "live"],
    ["Gift import & reports", "Excel template with dropdowns; branded gift reports in Excel and PDF.", "live"],
    ["Online gifting & contributions", "Guests give by EcoCash, InnBucks, card or PayPal; recorded automatically.", "next"],
    ["Pledges", "Promised versus received, with reminders — churches, fundraisers, memorials, lobola.", "next"],
    ["Traditional items register", "Lobola and roora items — cattle, cash, clothing, groceries — per family and delegation.", "next"],
    ["Wishlist / registry", "Gift ideas guests can reserve so nothing is duplicated.", "next"],
    ["Thank-you tracker", "Know who has been thanked and send thank-you messages in bulk.", "later"],
  ] },
  { group: "Suppliers & budget", items: [
    ["Service provider register", "Supplier, category, contact, agreed fee and currency.", "live"],
    ["Payments & balances", "Record each payment; see paid, outstanding and Not Paid / Partially Paid / Fully Paid / Due Soon / Overdue.", "live"],
    ["Budget planner", "Planned versus actual spend per category, with alerts when over budget.", "next"],
    ["Contracts & documents", "Quotes, contracts and receipts attached to each supplier.", "later"],
    ["Supplier directory", "Vetted caterers, decorators, photographers and venues hosts can book.", "later"],
  ] },
  { group: "Day-of operations & communication", items: [
    ["Run-sheet for the team", "Minute-by-minute timeline with owners for planners, MCs and ushers.", "next"],
    ["Broadcast updates", "Venue or time changes sent to every confirmed guest at once.", "next"],
    ["Planner checklists", "Countdown tasks per event type.", "next"],
    ["Live announcements page", "Guests follow what's happening now — speeches, meals, next session.", "later"],
    ["Feedback surveys", "A short post-event survey sent to attendees.", "later"],
  ] },
  { group: "Reports & insights", items: [
    ["Live dashboard", "RSVP breakdown, headcount, pending approvals, gender mix, check-in methods, gifts and supplier balances.", "live"],
    ["Branded Excel & PDF reports", "RSVP, attending list, all invited, approval requests, check-in, gifts and supplier payments.", "live"],
    ["Catering headcount report", "Confirmed numbers by meal choice for the caterer.", "next"],
    ["Post-event report pack", "One document for the client: attendance, gifts, spend and highlights.", "next"],
    ["Attendance certificates", "Automatic certificates for trainings and CPD-accredited events.", "next"],
  ] },
  { group: "Accounts, security & trust", items: [
    ["Private organiser portal", "Password-protected management portal; guests only ever see their own details.", "live"],
    ["Many events, one platform", "Each event gets its own link, branding, data and admin login.", "next"],
    ["Roles & permissions", "Host, planner, usher and read-only viewer — each sees only what they need.", "next"],
    ["Data protection", "Privacy notice, consent and deletion after the event, in line with Zimbabwe's Cyber and Data Protection Act and South Africa's POPIA.", "next"],
    ["Proper database & backups", "Reliable storage for many events at once, with daily backups.", "next"],
    ["White-label for planners", "Planners and agencies run the platform under their own brand.", "later"],
    ["Activity log", "Who changed what, and when, across the team.", "later"],
  ] },
];

const EVENTS = [
  ["Weddings", "White · church · traditional · court · destination", ["Invitation site, personal links, interactive card", "RSVP with party caps and approvals", "Gift register and supplier payments", "QR passes, self check-in, catering headcount", "Seating plan and table cards"]],
  ["Lobola & traditional ceremonies", "Lobola · roora · ilobolo · umembeso · kupereka", ["Invite-only delegations by family side", "Register of negotiated items: cattle, cash, clothing, groceries", "Controlled headcount and gate check-in", "Discreet — links only, no public page", "Formal printed record for both families"]],
  ["Pre-wedding & family celebrations", "Kitchen parties · bridal showers · engagements · anniversaries · vow renewals", ["Quick themed invite pages", "Gift wishlist and contributions", "RSVP and headcount for the venue", "Photo sharing by QR code"]],
  ["Corporate events", "Conferences · launches · AGMs · year-end functions · team building", ["Registration with company and job-title fields", "Approval of registrations, capacity and waitlist", "Name badges, multi-gate check-in, live attendance", "Attendance reports for HR and compliance", "Sponsor and vendor payment tracking"]],
  ["Trainings & workshops", "CPD courses · NGO and government workshops · seminars", ["Session sign-up and attendance per session", "Attendance certificates", "Per-diem and transport lists", "Donor-ready attendance reports"]],
  ["Church & faith gatherings", "Conventions · crusades · conferences · baptisms · dedications", ["Large-list registration by branch or region", "Pledges and offerings tracking", "Accommodation and transport lists", "Multi-day programmes"]],
  ["Parties & milestones", "Birthdays · 21sts · baby showers · christenings · graduations", ["Self-service invite page in minutes", "RSVP and gift wishlist", "Themed cards to share on WhatsApp", "Low-cost starter package"]],
  ["Memorials & remembrance", "Funerals · memorial services · tombstone unveilings · kurova guva", ["Service programme, venue and directions", "Condolence messages", "Contributions (chema) register with totals", "Attendance and transport coordination", "Quiet, respectful design"]],
  ["Galas, fundraisers & awards", "Charity dinners · prize-givings · award nights", ["Paid tickets and table bookings", "Pledges and donations with receipts", "Seating, VIP and protocol lists", "Sponsor recognition on the event page"]],
  ["Schools, alumni & reunions", "Class reunions · alumni dinners · family reunions · open days", ["Registration from old contact lists by Excel", "Contributions towards venue and catering", "Name badges with class or year", "Photo sharing afterwards"]],
  ["Festivals, concerts & expos", "Cultural festivals · shows · trade fairs · sports tournaments", ["Ticket tiers and QR tickets", "Multi-gate scanning at volume", "Exhibitor and vendor management", "Offline check-in for outdoor venues"]],
  ["Diaspora homecoming events", "Events at home planned from the UK, South Africa, US and beyond", ["Remote RSVP and live dashboard for hosts abroad", "Multi-currency gifts and supplier payments", "Livestream link for relatives who can't travel", "Local suppliers tracked with deadlines"]],
];

const NATURES = [
  ["Access", "Private, invite-only · Public, open registration", "Personal links and approval queue for private events; open sign-up with capacity limits for public ones."],
  ["Cost to attend", "Free · Ticketed · Donation-based", "RSVP for free events; paid tickets and online contributions for the rest."],
  ["Duration", "One day · Multi-day · Multi-session", "A single programme, or a schedule with sessions and per-session attendance."],
  ["Format", "In person · Hybrid · Virtual", "Venue, check-in and maps in person; livestream links for hybrid and virtual."],
  ["Scale", "Intimate (under 50) · Medium · Large (1,000+)", "Excel import, bulk messaging and multi-gate check-in scale to large crowds."],
  ["Character", "Traditional & cultural · Religious · Corporate · Social · Solemn", "Themes and wording per type; a quiet, respectful look for memorials."],
  ["Reach", "Local · National · Diaspora", "Country-code phones, multi-currency money, remote dashboards for hosts abroad."],
  ["Frequency", "One-off · Annual · Recurring", "Copy last year's event, keep attendee history, compare years."],
  ["Who runs it", "Host alone · Family committee · Professional planner · Company", "Roles and permissions so each helper sees only their part."],
];

const ROLES = [
  ["Hosts", "The couple, family or company — full view of replies, gifts, money and arrivals.", "live"],
  ["Guests", "Receive invitations, RSVP, download cards and programmes, check themselves in.", "live"],
  ["Ushers & door staff", "Scan passes and check people in from a phone.", "live"],
  ["Event planners", "Run many clients' events from one account — under their own brand later.", "next"],
  ["Family committees", "Treasurer sees money, secretary sees the guest list, and so on.", "next"],
  ["Suppliers & venues", "See confirmed headcounts and timings relevant to them.", "later"],
];

const PACKAGES = [
  ["Starter", "Parties and small gatherings", "$30 – $50", ["Themed invite page", "RSVP and headcount", "Shareable card", "Self-service setup"]],
  ["Essential", "Small weddings, family events", "$75 – $120", ["Everything in Starter", "Guest list with Excel import", "Personal invite links", "Reports"]],
  ["Premium", "Weddings and lobola", "$180 – $300", ["Everything in Essential", "Interactive card, all formats", "Approval queue, WhatsApp invites", "Check-in and QR passes", "Gift register, supplier payments"]],
  ["Corporate", "Conferences, launches, trainings", "$400+", ["Registration with custom fields", "Badges, multi-gate check-in", "Attendance reports and certificates", "Sponsor and vendor tracking"]],
  ["Planner licence", "Planners, venues, agencies", "$60 – $150 / month", ["Unlimited events", "Client logins per event", "Own branding (later)", "Priority support"]],
];

const ADDONS = [
  ["Custom card & monogram design", "$25 – $80", "A bespoke invitation card, monogram and colour story."],
  ["Custom web address", "$15 + domain", "The event on its own .co.zw or .com address."],
  ["Printed QR passes & table cards", "per piece", "Printed and delivered badges, place cards and table numbers."],
  ["On-site check-in team", "$50 – $150 / day", "Trained ushers with phones or tablets at the gate."],
  ["Reminder campaigns", "per message bundle", "RSVP-deadline and day-before WhatsApp or SMS reminders."],
  ["Guest-list clean-up", "$20 – $50", "We turn messy lists into a clean, deduplicated register."],
  ["Post-event report pack", "$20", "Attendance, gifts, spend and thank-you list in one document."],
  ["Livestream set-up", "quoted", "A streaming link on the event page for guests abroad."],
  ["Photo sharing wall", "$20 – $40", "Guests upload photos by QR code into one album."],
  ["Rush set-up", "+25%", "Event live within 24 hours."],
];

const REVENUE = [
  ["Per-event packages", "Hosts pay once per event."],
  ["Planner subscriptions", "Monthly licences for planners, venues and agencies."],
  ["Add-on services", "Design, printing, check-in staff, reminders."],
  ["Payment processing margin", "A small fee on tickets, online gifts and contributions paid through the platform."],
  ["Supplier directory listings", "Suppliers pay to be listed or featured to hosts (later)."],
  ["Corporate retainers", "Companies and churches with regular events."],
];

const LAUNCH = [
  ["Many events on one platform", "Separate link, branding, data and admin login per event — today's system serves one wedding."],
  ["Proper database with backups", "Replaces the single-file storage and removes the risk of losing a guest list."],
  ["Self-service event builder and themes", "Hosts or our team set up an event through a form in minutes, not by editing code."],
  ["Online payments", "EcoCash, InnBucks, card and PayPal — clients pay us, and guests can buy tickets or give gifts."],
  ["Bulk WhatsApp and SMS", "WhatsApp Business API and a bulk SMS provider for invites and reminders."],
  ["Roles and usher logins", "Host, planner, usher and viewer access."],
  ["Data protection and terms", "Privacy notice, consent, retention and deletion; client terms of service."],
  ["Brand, demo and sales kit", "A business name, a demo event, a rate card and a planner pitch."],
];

const STATUS_LABEL = { live: "Live", next: "Build next", later: "Later" };

module.exports = { BRAND, TAGLINE, JOURNEY, FEATURES, EVENTS, NATURES, ROLES, PACKAGES, ADDONS, REVENUE, LAUNCH, STATUS_LABEL };
