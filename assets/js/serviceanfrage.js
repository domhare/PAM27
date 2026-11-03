/*
 * Serviceanfrage
 * Five-step request form on serviceanfrage.html: step navigation, per-step validation,
 * date/time picker based on the workshop's service hours and the summary on the right.
 * All steps live in one <form>, so everything is sent together on the last step.
 */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("serviceanfrage-form");
    if (!form) return;

    const steps = Array.from(form.querySelectorAll(".gt-booking-step"));
    const stepper = Array.from(document.querySelectorAll(".gt-service-steps li"));
    const layout = form.querySelector(".gt-booking-layout");
    const LAST = steps.length;

    // Service hours of KFZ-Service Buila (weekday 1 = Monday), slots every 30 minutes
    const HOURS = {
        1: [["09:00", "12:00"], ["13:00", "18:00"]],
        2: [["09:00", "12:00"], ["13:00", "18:00"]],
        3: [["09:00", "12:00"], ["13:00", "18:00"]],
        4: [["09:00", "12:00"], ["13:00", "18:00"]],
        5: [["09:00", "12:00"], ["13:00", "15:30"]]
    };
    // TEMPORARY: skip all step checks so every step can be clicked through while building the page.
    // Set back to false before going live.
    const SKIP_VALIDATION = true;

    const SLOT_MINUTES = 30;
    const MAX_IMAGES = 5;
    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    let current = 1;
    let reached = 1;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function field(name) {
        return form.elements[name];
    }

    function value(name) {
        const f = field(name);
        return f && f.value ? f.value.trim() : "";
    }

    function checkedValues(name) {
        return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
    }

    /* ---------- Steps ---------- */

    function showError(step, message) {
        const box = form.querySelector(`[data-error="${step}"]`);
        if (box) box.textContent = message || "";
    }

    function validate(step) {
        const pane = steps[step - 1];
        showError(step, "");
        if (SKIP_VALIDATION) return true;

        // Native checks for required fields and formats (e-mail, consent, ...)
        const invalid = Array.from(pane.querySelectorAll("input, select, textarea"))
            .find(f => !f.checkValidity());
        if (invalid) {
            invalid.reportValidity();
            return false;
        }

        if (step === 1 && !field("fahrzeugschein").files.length && !(value("hsn") && value("tsn"))) {
            showError(1, "Bitte laden Sie Ihren Fahrzeugschein hoch oder geben Sie HSN und TSN ein.");
            return false;
        }
        if (step === 2) {
            if (!checkedValues("servicewunsch[]").length) {
                showError(2, "Bitte wählen Sie mindestens einen Service aus.");
                return false;
            }
            const images = field("bilder[]").files;
            if (images.length > MAX_IMAGES) {
                showError(2, `Bitte laden Sie höchstens ${MAX_IMAGES} Bilder hoch.`);
                return false;
            }
            if (Array.from(images).some(f => f.size > MAX_IMAGE_BYTES)) {
                showError(2, "Ein Bild ist größer als 8 MB. Bitte wählen Sie ein kleineres Bild.");
                return false;
            }
        }
        if (step === 3 && !(value("wunschtermin_datum") && value("wunschtermin_uhrzeit"))) {
            showError(3, "Bitte wählen Sie ein Datum und eine Uhrzeit aus.");
            return false;
        }
        return true;
    }

    function go(step, scroll = true) {
        current = step;
        reached = Math.max(reached, step);
        steps.forEach((pane, i) => pane.classList.toggle("is-active", i + 1 === step));
        stepper.forEach((li, i) => {
            const n = i + 1;
            li.classList.toggle("is-active", n === step);
            li.classList.toggle("is-done", n < step || (n <= reached && n !== step));
            li.toggleAttribute("aria-current", n === step);
        });
        // The summary column is shown next to steps 2 to 4 only
        layout.classList.toggle("has-aside", step > 1 && step < LAST);
        renderSummary();
        if (scroll) document.querySelector(".gt-service-steps").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    form.addEventListener("click", function (e) {
        if (e.target.closest("[data-next]")) {
            if (validate(current)) go(current + 1);
        } else if (e.target.closest("[data-prev]")) {
            go(current - 1);
        } else {
            const edit = e.target.closest("[data-edit]");
            if (edit) {
                e.preventDefault();
                go(Number(edit.dataset.edit));
            }
        }
    });

    // Steps already visited can be reopened from the step counter
    stepper.forEach((li, i) => {
        li.addEventListener("click", function () {
            const n = i + 1;
            if (n < current || (n <= reached && validate(current))) go(n);
        });
    });

    /* ---------- Step 2: more services, character counter ---------- */

    const moreBtn = form.querySelector("[data-more]");
    moreBtn.addEventListener("click", function () {
        const open = form.querySelector(".gt-booking-services").classList.toggle("is-open");
        moreBtn.setAttribute("aria-expanded", open);
        moreBtn.querySelector("span").textContent = open ? "Weniger anzeigen" : "Mehr anzeigen";
    });

    const message = field("message");
    const counter = form.querySelector("[data-counter]");
    message.addEventListener("input", function () {
        counter.textContent = message.maxLength - message.value.length;
    });

    /* ---------- Step 3: calendar and time slots ---------- */

    const calendar = form.querySelector("[data-calendar]");
    const monthLabel = form.querySelector("[data-month-label]");
    const slotsBox = form.querySelector("[data-slots]");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let shownMonth = new Date(firstMonth);

    function iso(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function germanDate(isoDate) {
        const [y, m, d] = isoDate.split("-");
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function bookable(date) {
        return date > today && HOURS[date.getDay()];
    }

    function renderCalendar() {
        monthLabel.textContent = shownMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
        form.querySelector('[data-month="-1"]').disabled = shownMonth <= firstMonth;
        calendar.innerHTML = "";
        ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach(d => calendar.appendChild(el("span", "is-weekday", d)));

        const offset = (shownMonth.getDay() + 6) % 7;   // Monday first
        for (let i = 0; i < offset; i++) calendar.appendChild(el("span"));

        const days = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= days; d++) {
            const date = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), d);
            const btn = el("button", "", String(d));
            btn.type = "button";
            btn.dataset.date = iso(date);
            if (!bookable(date)) btn.disabled = true;
            if (btn.dataset.date === value("wunschtermin_datum")) btn.classList.add("is-selected");
            if (date.getTime() === today.getTime()) btn.classList.add("is-today");
            calendar.appendChild(btn);
        }
    }

    function minutes(time) {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    }

    function renderSlots(isoDate) {
        slotsBox.innerHTML = "";
        const [y, m, d] = isoDate.split("-").map(Number);
        const ranges = HOURS[new Date(y, m - 1, d).getDay()] || [];
        ranges.forEach(([from, to]) => {
            for (let t = minutes(from); t < minutes(to); t += SLOT_MINUTES) {
                const label = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
                const btn = el("button", label === value("wunschtermin_uhrzeit") ? "is-selected" : "", label);
                btn.type = "button";
                btn.dataset.time = label;
                slotsBox.appendChild(btn);
            }
        });
    }

    calendar.addEventListener("click", function (e) {
        const btn = e.target.closest("button[data-date]");
        if (!btn || btn.disabled) return;
        field("wunschtermin_datum").value = btn.dataset.date;
        field("wunschtermin_uhrzeit").value = "";
        renderCalendar();
        renderSlots(btn.dataset.date);
        renderSummary();
    });

    slotsBox.addEventListener("click", function (e) {
        const btn = e.target.closest("button[data-time]");
        if (!btn) return;
        field("wunschtermin_uhrzeit").value = btn.dataset.time;
        slotsBox.querySelectorAll("button").forEach(b => b.classList.toggle("is-selected", b === btn));
        renderSummary();
    });

    form.querySelectorAll("[data-month]").forEach(btn => {
        btn.addEventListener("click", function () {
            shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + Number(btn.dataset.month), 1);
            renderCalendar();
        });
    });

    /* ---------- Summary (right column and step 5) ---------- */

    function section(title, step, lines) {
        const box = el("div", "gt-booking-summary-item");
        const head = el("div", "gt-booking-summary-head");
        head.appendChild(el("h4", "", title));
        const edit = el("a", "", "Bearbeiten");
        edit.href = "#";
        edit.dataset.edit = step;
        head.appendChild(edit);
        box.appendChild(head);
        lines.filter(Boolean).forEach(line => {
            const row = el("p");
            if (Array.isArray(line)) {
                row.className = "has-value";
                row.append(el("span", "", line[0]), el("b", "", line[1]));
            } else {
                row.textContent = line;
            }
            box.appendChild(row);
        });
        return box;
    }

    function vehicleLines() {
        const scan = field("fahrzeugschein").files[0];
        const lines = [];
        if (value("hsn") || value("tsn")) lines.push(`HSN ${value("hsn") || "–"} / TSN ${value("tsn") || "–"}`);
        if (value("erstzulassung")) lines.push(`Erstzulassung ${value("erstzulassung")}`);
        if (value("kilometerstand")) lines.push(`${value("kilometerstand")} km`);
        if (scan) lines.push(`Fahrzeugschein: ${scan.name}`);
        return lines.length ? lines : ["Noch keine Angaben"];
    }

    function renderSummary() {
        const abgabe = form.querySelector('input[name="abgabe"]:checked');
        const services = checkedValues("servicewunsch[]");
        const date = value("wunschtermin_datum");
        const name = [value("anrede"), value("vorname"), value("nachname")].filter(Boolean).join(" ");

        form.querySelectorAll("[data-summary]").forEach(list => {
            const full = !!list.closest(".gt-booking-step");
            list.innerHTML = "";
            list.appendChild(section("Ihr Fahrzeug", 1, vehicleLines()));
            list.appendChild(section("Ihr Servicecenter", 3, ["KFZ-Service Buila", "Dillinger Weg 8-10, 86156 Augsburg"]));
            if (abgabe) {
                const price = abgabe.closest(".gt-booking-option").querySelector(".gt-booking-option-price");
                list.appendChild(section("Abgabe des Fahrzeugs", 2, [[abgabe.value, price ? price.textContent : ""]]));
            }
            if (services.length) {
                list.appendChild(section("Gewünschter Service", 2, services.map(s => [s, "Preisanfrage"])));
            }
            if (date) {
                const time = value("wunschtermin_uhrzeit");
                list.appendChild(section("Wunschtermin", 3, [germanDate(date) + (time ? `, ${time} Uhr` : "")]));
            }
            // Contact details and the message only appear in the full summary on the last step
            if (full) {
                list.appendChild(section("Ihre Kontaktdaten", 4, [name, value("telefon"), value("email")]));
                if (value("message")) list.appendChild(section("Ihre Nachricht", 2, [value("message")]));
            }
        });
    }

    form.addEventListener("change", renderSummary);

    /* ---------- Submit ---------- */

    form.addEventListener("submit", function (e) {
        for (let s = 1; s < LAST; s++) {
            if (!validate(s)) {
                e.preventDefault();
                go(s);
                validate(s);
                return;
            }
        }
        // No mail handler is connected yet: keep the visitor's data on the page instead of reloading it
        if (form.getAttribute("action") === "#") {
            e.preventDefault();
            showError(LAST, "Der Versand ist noch nicht eingerichtet. Bitte rufen Sie uns an: (0821) 455-366-36.");
        }
    });

    renderCalendar();
    go(1, false);
});
