// Smart matching of what a guest types against the guest list.
//
// The couple's list is written the way people talk about guests, not as tidy
// first/last names: "Nigel & Tafadzwa", "Andrew & Wife", "Mai Makichi & Husband",
// "Elder Mazuruse Bindura & Wife", "Baba Tadiwa (Andrew) & Wife". Guests type
// "Engineer Nigel Gasa", "Promise Tungamirai Makichi", "Mr and Mrs Wachekwa".
//
// The rule: every recognisable name word the guest types must belong to the
// same invitation, and at least one must.
//   - titles, kinship and joining words are ignored (Mr, Mrs, Engineer, Elder,
//     Baba, Mai, Sekuru, Wife, Husband, and, &, family, …)
//   - "recognisable" = the word appears somewhere on the guest list (allowing a
//     small typo on longer names); words the list never uses (a middle name, a
//     surname the couple didn't write down) don't count for or against
//   - but when the list gives an invitation a surname, the typed name must include it
//   - an initial must fit one of that invitation's names ("A" ~ "Albert")
//   - "Jr"/"Junior" typed means the invitation must say Jr too
//   - if more than one invitation fits, nobody is picked: ask for phone/email
// Phone (last 9 digits) and email are exact and always win.
//
// Used by api/rsvp.js (public RSVP), api/admin/guests.js and the portal (approvals). Node + browser.
(function (root) {
  "use strict";

  var DROP = ("mr mrs ms miss mx master dr doc doctor eng engr engineer prof professor rev reverend pastor ps bishop apostle prophet " +
    "prophetess evangelist elder deacon deaconess overseer sir madam mme dame lady lord hon honourable honorable capt captain col colonel " +
    "maj major gen general sgt lt lieutenant cpl adv advocate attorney judge justice chief sister sis brother bro sr snr senior " +
    "mother father mum mom dad aunt auntie aunty uncle cousin grandma grandpa gogo sekuru mbuya ambuya baba mai amai tete mainini " +
    "maiguru babamukuru babamunini mukoma muzukuru mukwasha muroora vamwene the and plus with family fam household guest guests " +
    "partner wife husband spouse fiance fiancee son daughter kids children child").split(" ");
  var DROPSET = {};
  DROP.forEach(function (w) { DROPSET[w] = true; });
  var JR = { jr: true, jnr: true, junior: true };

  function words(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  }
  // "n" is "and" only between titles ("Mr n Mrs"); elsewhere it's an initial ("Eng N Gasa").
  function nameTokens(s) {
    var w = words(s);
    return w.filter(function (x, i) {
      if (x === "n") return !(i > 0 && i < w.length - 1 && DROPSET[w[i - 1]] && DROPSET[w[i + 1]]);
      return !DROPSET[x];
    });
  }

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur, i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // same word, or a small typo on a longer word (5+ letters: 1 slip, 8+: 2)
  function near(a, b) {
    if (a === b) return true;
    var L = Math.max(a.length, b.length);
    if (Math.min(a.length, b.length) < 5) return false;
    return lev(a, b) <= (L >= 8 ? 2 : 1);
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  // same number however it was typed (+263…, 0…, 00…, no prefix, other countries):
  // compare the last 9 digits, or fewer for countries with shorter numbers (min 7)
  function samePhone(a, b) {
    var x = digits(a), y = digits(b), n = Math.min(9, x.length, y.length);
    return n >= 7 && x.slice(-n) === y.slice(-n);
  }

  // How many people a typed name stands for when it says so: "Mr and Mrs X",
  // "Mr & Mrs X", "X & Wife", "Chipo and Tafadzwa Dube" → 2. Otherwise null.
  function impliedPartySize(s) {
    var w = words(s), t = w.join(" ");
    if (/\b(mr|dr|eng|engr|engineer|pastor|rev|prof|bishop|elder|apostle|baba)\s+(and|n)\s+(mrs|dr|ms|mai|amai)\b/.test(t)) return 2;
    if (/\b(mrs|ms|mai)\s+(and|n)\s+(mr|dr|baba)\b/.test(t)) return 2;
    if (/\b(and|plus|with)\s+(wife|husband|spouse|partner|fiance|fiancee)\b/.test(t)) return 2;
    if (/\bcouple\b/.test(t)) return 2;
    var i = w.indexOf("and");
    if (i > 0 && i < w.length - 1) {
      var left = w.slice(0, i).filter(function (x) { return !DROPSET[x]; }), right = w.slice(i + 1).filter(function (x) { return !DROPSET[x]; });
      if (left.length && right.length) return 2;
    }
    return null;
  }

  function guestTokens(g) {
    var t = nameTokens([g.firstName, g.lastName, g.familyName].join(" "));
    var sur = nameTokens([g.lastName, g.familyName].join(" ")).filter(function (x) { return !JR[x] && x.length > 1; });
    return { all: t.filter(function (x) { return !JR[x]; }), sur: sur, jr: t.some(function (x) { return JR[x]; }) };
  }

  // Build once per list: each guest's name words, and the list's vocabulary.
  function index(guests) {
    var live = (guests || []).filter(function (g) { return !g.removedAt; });
    var vocab = {};
    var rows = live.map(function (g) {
      var t = guestTokens(g);
      t.all.forEach(function (w) { if (w.length > 1) vocab[w] = (vocab[w] || 0) + 1; });
      return { guest: g, tokens: t.all, sur: t.sur, jr: t.jr };
    });
    return { rows: rows, vocab: vocab, words: Object.keys(vocab) };
  }

  // The list words a typed word stands for (exact, else close spellings).
  function listWordsFor(word, idx) {
    if (idx.vocab[word]) return [word];
    if (word.length < 5) return [];
    return idx.words.filter(function (v) { return near(word, v); });
  }

  function nameCandidates(name, idx) {
    var typed = nameTokens(name);
    var wantJr = typed.some(function (x) { return JR[x]; });
    typed = typed.filter(function (x) { return !JR[x]; });
    var full = typed.filter(function (x) { return x.length > 1; }), initials = typed.filter(function (x) { return x.length === 1; });
    // each recognisable typed word → the list words it may stand for
    var required = full.map(function (w) { return listWordsFor(w, idx); }).filter(function (alts) { return alts.length; });
    if (!required.length) return [];
    return idx.rows.filter(function (r) {
      if (wantJr && !r.jr) return false;
      if (!required.every(function (alts) { return alts.some(function (a) { return r.tokens.indexOf(a) !== -1; }); })) return false;
      // when the list gives this invitation a surname, the typed name must include it
      // ("Farai Ncube" is not "Farai Banda"); labels without a surname ("Nigel & Tafadzwa") are exempt
      if (r.sur.length && !r.sur.some(function (s) { return full.some(function (w) { return near(w, s); }); })) return false;
      if (initials.length) {
        var used = {};
        required.forEach(function (alts) { alts.forEach(function (a) { used[a] = true; }); });
        var others = r.tokens.filter(function (t) { return !used[t]; });
        // an initial has to fit one of this invitation's other names (when it has any)
        if (others.length && !initials.some(function (i) { return others.some(function (t) { return t.charAt(0) === i; }); })) return false;
      }
      return true;
    }).map(function (r) {
      // tie-break: fewer unexplained names on the invitation = closer fit
      var used = {};
      required.forEach(function (alts) { alts.forEach(function (a) { if (r.tokens.indexOf(a) !== -1) used[a] = true; }); });
      return { guest: r.guest, matched: Object.keys(used).length, extra: r.tokens.length - Object.keys(used).length, jrBonus: wantJr && r.jr };
    });
  }

  // Find the invitation a typed name / phone / email belongs to.
  //   returns { guest, by } | { ambiguous: [guests] } | null
  function findGuest(guests, q, idx) {
    q = q || {};
    var live = (guests || []).filter(function (g) { return !g.removedAt; });
    if (q.phone) {
      var byPhone = live.filter(function (g) { return samePhone(g.phone, q.phone); });
      if (byPhone.length === 1) return { guest: byPhone[0], by: "phone" };
    }
    if (q.email) {
      var em = String(q.email).trim().toLowerCase();
      var byEmail = live.filter(function (g) { return g.email && String(g.email).trim().toLowerCase() === em; });
      if (byEmail.length === 1) return { guest: byEmail[0], by: "email" };
    }
    if (!q.name) return null;
    var c = nameCandidates(q.name, idx || index(live));
    if (!c.length) return null;
    if (c.length === 1) return { guest: c[0].guest, by: "name" };
    return { ambiguous: c.map(function (x) { return x.guest; }).slice(0, 6) };
  }

  // Ranked suggestions for the portal's approvals (never applied automatically).
  function suggest(guests, q, limit) {
    var live = (guests || []).filter(function (g) { return !g.removedAt; }), out = [];
    live.forEach(function (g) {
      if (q.phone && samePhone(g.phone, q.phone)) out.push({ guest: g, by: "phone" });
      else if (q.email && g.email && String(g.email).trim().toLowerCase() === String(q.email).trim().toLowerCase()) out.push({ guest: g, by: "email" });
    });
    if (q.name) nameCandidates(q.name, index(live))
      .sort(function (a, b) { return b.matched - a.matched || a.extra - b.extra; })
      .forEach(function (x) { if (!out.some(function (o) { return o.guest.id === x.guest.id; })) out.push({ guest: x.guest, by: "name" }); });
    return out.slice(0, limit || 5);
  }

  var api = { findGuest: findGuest, suggest: suggest, index: index, impliedPartySize: impliedPartySize, nameTokens: nameTokens, samePhone: samePhone };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WNGuestMatch = api;
})(typeof window !== "undefined" ? window : this);
