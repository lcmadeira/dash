/* Euronext Lisbon session context used to distinguish market closure from feed failure. */
(function () {
  const LISBON_TZ = "Europe/Lisbon";

  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }

  function getLisbonMarketContext(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LISBON_TZ, year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).reduce((out, part) => { out[part.type] = part.value; return out; }, {});
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    const year = Number(parts.year);
    const easter = easterSunday(year);
    const goodFriday = new Date(easter); goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
    const easterMonday = new Date(easter); easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
    const dateOnly = value => value.toISOString().slice(0, 10);
    const holidays = new Set([
      `${year}-01-01`, `${year}-05-01`, `${year}-12-25`,
      dateOnly(goodFriday), dateOnly(easterMonday),
    ]);
    /* Official 2026 Euronext calendar includes these additional dates. */
    if (year === 2026) {
      ["2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25"].forEach(day => holidays.add(day));
    }
    if (parts.weekday === "Sat" || parts.weekday === "Sun" || holidays.has(date)) {
      return { state: "closed", date, label: "Mercado encerrado (fim de semana/feriado)" };
    }

    const shortDay = year === 2026 && (date === "2026-12-24" || date === "2026-12-31");
    if (shortDay && minute >= 8 * 60) return { state: "special-session", date, label: "Dia de sessão curta (fecho a confirmar)" };
    if (minute >= 8 * 60 && minute < 16 * 60 + 30) return { state: "open", date, label: "Sessão normal aberta" };
    return { state: "outside-session", date, label: "Fora do horário de negociação" };
  }

  window.getLisbonMarketContext = getLisbonMarketContext;
})();
