/*
 * Werkstatt-Preisliste / Teileshop
 * Renders the filterable, sortable price list on werkstatt.html and teileshop.html.
 * The CSV comes from the list's data-csv attribute (default: "PAM PREISE CSV - Werkstatt.csv",
 * loaded by preise-csv.js). Edit the CSV to change prices - no HTML changes needed.
 */
document.addEventListener("DOMContentLoaded", function () {
    const PER_PAGE = 24;

    // Groups are shown in the order they first appear in the CSV
    const GROUP_ICONS = {
        "Bremsen": "fa-brake-warning",
        "Fahrwerk": "fa-car-tilt",
        "Getriebe": "fa-gears",
        "Karosserie": "fa-car-side",
        "Motor": "fa-engine",
        "Ölwechsel": "fa-oil-can",
        "Reifen": "fa-tire",
        "Maschinen": "fa-car-wrench",
        "Schraubwerkzeug": "fa-wrench",
        "Handwerkzeug": "fa-hammer",
        "Elektro": "fa-bolt",
        "Druckluft": "fa-wind",
        "Spezialwerkzeug": "fa-screwdriver-wrench",
        "Shop": "fa-cart-shopping",
        // Teileshop
        "Flüssigkeiten": "fa-oil-can",
        "Abgasanlage": "fa-pipe-section",
        "Befestigungsmaterial": "fa-screwdriver",
        "Beleuchtung": "fa-lightbulb",
        "Bohrer & Werkzeuge": "fa-screwdriver-wrench",
        "Chemie & Additive": "fa-flask",
        "Elektrik": "fa-car-battery",
        "Klebe- & Dichtmittel": "fa-fill-drip",
        "Rostschutz & Lack": "fa-spray-can",
        "Schmierstoffe": "fa-droplet",
        "Werkstattbedarf": "fa-toolbox"
    };
    const UNITS = { h: "Std.", d: "Tag" };

    const list = document.getElementById("werkzeug-liste");
    if (!list) return;
    const categoryList = document.getElementById("werkzeug-kategorien");
    const countText = document.getElementById("werkzeug-anzahl");
    const sortSelect = document.getElementById("werkzeug-sortierung");
    const pager = document.getElementById("werkzeug-seiten");

    let items = [];
    let page = 1;
    let activeGroup = "Alle";

    // "13,00/h" or "16,49 €" -> { value: 13, label: "13,00 €", unit: "Std." }
    function parsePrice(raw) {
        const [rawNum, unit] = raw.trim().split("/");
        const num = rawNum.replace("€", "").trim();
        return {
            value: parseFloat(num.replace(".", "").replace(",", ".")) || 0,
            label: num + " €",
            unit: UNITS[unit] || ""
        };
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function filtered() {
        const result = items.filter(it => activeGroup === "Alle" || it.group === activeGroup);
        switch (sortSelect.value) {
            case "preis-auf": result.sort((a, b) => a.price.value - b.price.value); break;
            case "preis-ab": result.sort((a, b) => b.price.value - a.price.value); break;
            case "name": result.sort((a, b) => a.name.localeCompare(b.name, "de")); break;
        }
        return result;
    }

    function renderItem(it) {
        const card = el("div", "gt-werkzeug-item");
        const icon = el("span", "gt-werkzeug-icon");
        icon.appendChild(el("i", "fa-solid " + (GROUP_ICONS[it.group] || "fa-screwdriver-wrench")));
        const content = el("div", "gt-werkzeug-content");
        content.appendChild(el("span", "gt-werkzeug-group", it.group));
        content.appendChild(el("h4", "", it.name));
        if (it.desc) content.appendChild(el("p", "gt-werkzeug-desc", it.desc));
        const price = el("div", "gt-werkzeug-price", it.price.label);
        if (it.price.unit) price.appendChild(el("small", "", "/ " + it.price.unit));
        card.append(icon, content, price);
        return card;
    }

    function renderPager(pages) {
        pager.innerHTML = "";
        if (pages <= 1) return;
        function add(label, target, current, isIcon) {
            const li = el("li");
            const a = el("a", "gt-page-numbers" + (current ? " current" : ""));
            a.href = "#werkzeug-liste";
            if (isIcon) a.appendChild(el("i", label));
            else a.textContent = String(label).padStart(2, "0");
            a.addEventListener("click", function (e) {
                e.preventDefault();
                page = target;
                render();
                list.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            li.appendChild(a);
            pager.appendChild(li);
        }
        if (page > 1) add("icon-icon-2", page - 1, false, true);
        for (let i = 1; i <= pages; i++) add(i, i, i === page);
        if (page < pages) add("icon-icon-1", page + 1, false, true);
    }

    function render() {
        const result = filtered();
        const pages = Math.max(1, Math.ceil(result.length / PER_PAGE));
        page = Math.min(page, pages);
        const start = (page - 1) * PER_PAGE;
        const shown = result.slice(start, start + PER_PAGE);

        list.innerHTML = "";
        if (!shown.length) {
            list.appendChild(el("p", "gt-werkzeug-empty", "Keine Artikel für diese Auswahl gefunden."));
        } else {
            shown.forEach(it => list.appendChild(renderItem(it)));
        }
        countText.textContent = result.length
            ? `Zeige ${start + 1}–${start + shown.length} von ${result.length} Artikeln`
            : "0 Artikel";
        renderPager(pages);
    }

    function syncCategoryList() {
        categoryList.querySelectorAll("li").forEach(li => {
            li.classList.toggle("active", li.dataset.gruppe === activeGroup);
        });
    }

    function update() {
        page = 1;
        render();
        syncCategoryList();
    }

    function buildFilters() {
        const counts = {};
        items.forEach(it => { counts[it.group] = (counts[it.group] || 0) + 1; });
        const groups = Object.keys(counts);


        // Category list: click shows only that group ("Alle" shows everything)
        categoryList.innerHTML = "";
        [["Alle", items.length]].concat(groups.map(g => [g, counts[g]])).forEach(([g, n]) => {
            const li = el("li");
            li.dataset.gruppe = g;
            const a = el("a", "", g);
            a.href = "#werkzeug-liste";
            // The whole row is clickable, not just the text
            li.addEventListener("click", function (e) {
                e.preventDefault();
                activeGroup = g;
                update();
            });
            li.append(a, el("span", "", String(n)));
            categoryList.appendChild(li);
        });
        syncCategoryList();
    }

    // Grid / list toggle
    document.querySelectorAll(".gt-shop-showing [data-view]").forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            document.querySelectorAll(".gt-shop-showing [data-view]").forEach(l => l.classList.toggle("active", l === link));
            list.classList.toggle("is-grid", link.dataset.view === "grid");
        });
    });

    // The theme turns the <select> into a nice-select widget, which reports changes through jQuery
    if (window.jQuery) jQuery(sortSelect).on("change", update);
    else sortSelect.addEventListener("change", update);

    PreiseCSV.load(list.dataset.csv)
        .then(rows => {
            items = rows.map(r => ({ name: r.name, price: parsePrice(r.preis), group: r.gruppe, desc: r.beschreibung }));
            buildFilters();
            render();
        })
        .catch(() => {
            countText.textContent = "";
            list.innerHTML = "";
            list.appendChild(el("p", "gt-werkzeug-empty", "Die Preisliste konnte nicht geladen werden."));
        });
});
