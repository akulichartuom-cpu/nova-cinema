/*
 * NOVA CINEMA — общая логика каталога бара.
 * Используется и в приложении гостя (shop.html), и в панели наполнения (admin.html),
 * чтобы цена/время сборки комбо считались одинаково в обоих местах.
 *
 * Формат каталога:
 * {
 *   products: [{ id, name, desc, price, prep, icon, available }],
 *   combos:   [{ id, name, icon, items:[{id,qty}], discountType:'amount'|'percent', discountValue, available }]
 * }
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "nova_catalog_draft";

  var DEFAULT_CATALOG = {
    products: [
      { id: "cola-05", name: "Кола 0.5", desc: "Газированный напиток, 0.5 л", price: 4.5, prep: 1, icon: "🥤", available: true },
      { id: "popcorn-caramel", name: "Попкорн карамель", desc: "Средний стакан, 1.5 л", price: 7, prep: 2, icon: "🍿", available: true },
      { id: "popcorn-cheese", name: "Попкорн сыр", desc: "Средний стакан, 1.5 л", price: 7.5, prep: 2, icon: "🧀", available: true },
      { id: "nachos", name: "Начос", desc: "Кукурузные чипсы + сырный соус", price: 9, prep: 3, icon: "🌽", available: true }
    ],
    combos: [
      {
        id: "combo-classic",
        name: "Комбо «Классика»",
        icon: "🎬",
        items: [{ id: "popcorn-caramel", qty: 1 }, { id: "cola-05", qty: 1 }],
        discountType: "amount",
        discountValue: 2,
        available: true
      }
    ]
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function comboBaseSum(combo, productsById) {
    return combo.items.reduce(function (s, it) {
      var p = productsById[it.id];
      return s + (p ? p.price * it.qty : 0);
    }, 0);
  }

  function comboDiscountAmount(combo, base) {
    var value = Number(combo.discountValue) || 0;
    var raw = combo.discountType === "percent" ? (base * value / 100) : value;
    return Math.min(Math.max(raw, 0), base);
  }

  function comboFinalPrice(combo, productsById) {
    var base = comboBaseSum(combo, productsById);
    return round2(base - comboDiscountAmount(combo, base));
  }

  function comboPrep(combo, productsById) {
    return combo.items.reduce(function (s, it) {
      var p = productsById[it.id];
      return s + (p ? p.prep * it.qty : 0);
    }, 0);
  }

  function comboComposition(combo, productsById) {
    return combo.items.map(function (it) {
      var p = productsById[it.id];
      var name = p ? p.name : "?";
      return it.qty > 1 ? name + " ×" + it.qty : name;
    }).join(" + ");
  }

  // Комбо доступно гостю только если само включено И все компоненты в наличии.
  function comboAvailable(combo, productsById) {
    if (combo.available === false) return false;
    if (!combo.items.length) return false;
    return combo.items.every(function (it) {
      var p = productsById[it.id];
      return p && p.available !== false;
    });
  }

  // Добавляет вычисляемые поля (цена/время/состав/доступность) поверх сырых данных.
  function enrich(catalog) {
    var productsById = {};
    catalog.products.forEach(function (p) { productsById[p.id] = p; });
    catalog.combos.forEach(function (c) {
      c.baseSum = round2(comboBaseSum(c, productsById));
      c.discountAmount = round2(comboDiscountAmount(c, c.baseSum));
      c.price = comboFinalPrice(c, productsById);
      c.prep = comboPrep(c, productsById);
      c.composition = comboComposition(c, productsById);
      c.effectiveAvailable = comboAvailable(c, productsById);
    });
    return catalog;
  }

  function validateShape(data) {
    return data && Array.isArray(data.products) && Array.isArray(data.combos);
  }

  function fetchPublishedCatalog(url) {
    return fetch(url || "products.json", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { return validateShape(data) ? enrich(clone(data)) : null; })
      .catch(function () { return null; }); // file:// или сеть недоступны
  }

  function readDraft() {
    try {
      var draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return validateShape(draft) ? enrich(clone(draft)) : null;
    } catch (e) { return null; }
  }

  // Для гостевого приложения (shop.html): важнее опубликованный products.json —
  // это то, что реально закоммичено и видно всем гостям.
  async function loadCatalog(url) {
    var published = await fetchPublishedCatalog(url);
    if (published) return published;
    var draft = readDraft();
    if (draft) return draft;
    return enrich(clone(DEFAULT_CATALOG));
  }

  // Для панели наполнения (admin.html): важнее черновик в этом браузере —
  // иначе несохранённые правки потеряются при обновлении страницы.
  async function loadCatalogForEditing(url) {
    var draft = readDraft();
    if (draft) return draft;
    var published = await fetchPublishedCatalog(url);
    if (published) return published;
    return enrich(clone(DEFAULT_CATALOG));
  }

  function saveDraft(catalog) {
    try {
      var raw = { products: catalog.products, combos: catalog.combos.map(function (c) {
        return { id: c.id, name: c.name, icon: c.icon, items: c.items, discountType: c.discountType, discountValue: c.discountValue, available: c.available };
      }) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    } catch (e) {}
  }

  function money(n, currency) { return round2(n).toFixed(2) + " " + (currency || "BYN"); }

  global.NovaCatalog = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_CATALOG: DEFAULT_CATALOG,
    clone: clone,
    newId: newId,
    round2: round2,
    money: money,
    comboBaseSum: comboBaseSum,
    comboDiscountAmount: comboDiscountAmount,
    comboFinalPrice: comboFinalPrice,
    comboPrep: comboPrep,
    comboComposition: comboComposition,
    comboAvailable: comboAvailable,
    enrich: enrich,
    validateShape: validateShape,
    fetchPublishedCatalog: fetchPublishedCatalog,
    readDraft: readDraft,
    loadCatalog: loadCatalog,
    loadCatalogForEditing: loadCatalogForEditing,
    saveDraft: saveDraft
  };
})(window);
